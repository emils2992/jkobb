import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
// Eğer doğru CLIENT_ID sağlanırsa, bu satırın yorumunu kaldırın
import { initDiscordBot } from "./discord";
import { initDatabase } from "./db";
import { pool } from "./db";
// import { startUptimeService } from "./uptime"; // Kaldırıldı - yeni uptime servisi kullanılıyor
// import { startEnhancedKeepAliveService } from "./keepalive"; // Kaldırıldı - yeni uptime servisi kullanılıyor
// import { startEnhancedUptimeService } from "./enhanced-uptime"; // Kaldırıldı - yeni uptime servisi kullanılıyor
import ConnectPgSimple from "connect-pg-simple";
// Özel ping rotalarını import et
import { addPublicPingRoutes } from "./public-ping";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Replit proxy'lerini güven - X-Forwarded-For header hatası için gerekli
app.set('trust proxy', 1);

// API istekleri için hız sınırlayıcı - yüksek yük altında performansı korur
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 dakika
  max: 120, // Her IP'den dakikada maksimum 120 istek (daha yüksek limit)
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Çok fazla istek gönderildi, lütfen bir süre bekleyin." }
});

// Sadece /api endpointleri için limitleme uygula
app.use('/api', apiLimiter);

// Session setup
const PgStore = ConnectPgSimple(session);
app.use(session({
  store: new PgStore({
    pool,
    tableName: 'session', // Uses the session table we created
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'discord-manager-secret-key', 
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours 
  }
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Dinamik port kullanımı - hata durumunda yeni port deneyin
  let port = 3030; // Uptime servisleri için sabit bir port
  
  // Gelişmiş özel ping rotalarını ekle - UptimeRobot için optimize edilmiş
  addPublicPingRoutes(app);
  
  const startServer = async () => {
    // Dinamik port deneme mekanizması ile sunucu başlatma
    const tryStartServer = (currentPort: number, maxRetries = 5) => {
      if (maxRetries <= 0) {
        log(`❌ Maksimum port deneme sayısına ulaşıldı, sunucu başlatılamıyor.`);
        return;
      }

      try {
        server.listen(currentPort, "0.0.0.0", async () => {
          log(`✅ Server çalışıyor: port ${currentPort} (http://0.0.0.0:${currentPort})`);
          
          // Replit URL'sini al ve UptimeRobot için ping endpoint'lerini logla
          const baseUrl = process.env.REPLIT_URL || 
                          'https://discord-halisaha-manager.emilswd.repl.co';
          log(`🌐 Dış erişim URL'si: ${baseUrl}`);
          
          // UptimeRobot için URL'leri logla
          log(`🔔 UptimeRobot için ping URL'leri:`);
          log(`   • ${baseUrl}/ping`);
          log(`   • ${baseUrl}/uptime-check`);
          log(`   • ${baseUrl}/api/health`);
          
          try {
            // Veritabanını başlat
        await initDatabase();
        log('Veritabanı başarıyla başlatıldı');
        
        // Discord botu başlat
        await initDiscordBot();
        log('Discord bot başlatılıyor - Client ID mevcut');
        
        // Not: Artık uptime servisleri ayrı süreçler olarak çalışacak
        // Eski uptime servisleri kaldırıldı, yeni script temiz bir çözüm sunuyor
        log('Yeni uptime çözümü hazır - keep-bot-online.js ve ping-target-bot.js dosyaları ayrı olarak çalıştırılabilir');
        log('Dikkat: Sistemi 7/24 aktif tutmak için UptimeRobot ayrıca ayarlanmalıdır (UPTIME_GUIDE.md dosyasına bakınız)');
      } catch (error) {
        console.error('Error in initialization:', error);
      }
    });
  } catch (err: any) {
    if (err.code === 'EADDRINUSE') {
      log(`Port ${currentPort} meşgul, port ${currentPort + 1} deneniyor...`);
      // Bir sonraki portu dene
      tryStartServer(currentPort + 1, maxRetries - 1);
    } else {
      console.error('Server error:', err);
    }
  }
};

    // İlk portu kullanarak sunucuyu başlatmayı dene
    tryStartServer(port);
  };

  startServer(); // Sunucuyu başlat
})();
