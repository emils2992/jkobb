import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
// Eğer doğru CLIENT_ID sağlanırsa, bu satırın yorumunu kaldırın
import { initDiscordBot } from "./discord";
import { initDatabase } from "./db";
import { pool } from "./db";
import { startUptimeService } from "./uptime";
import { startEnhancedKeepAliveService } from "./keepalive";
import { startEnhancedUptimeService } from "./enhanced-uptime";
import ConnectPgSimple from "connect-pg-simple";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// API istekleri için hız sınırlayıcı - yüksek yük altında performansı korur
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 dakika
  max: 60, // Her IP'den dakikada maksimum 60 istek
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

  // Basitleştirilmiş server başlatma kodu
  // Sabit port kullan ve process hataları için basit bir çözüm ekle
  const PORT = 5002; // Tamamen yeni bir port kullanıyoruz
  
  // Temel uptime/health endpoint'leri
  app.get('/', (req, res) => {
    res.status(200).send('Discord Bot Server Running');
  });
  
  app.get('/ping', (req, res) => {
    res.status(200).send('Pong!');
  });
  
  app.get('/uptime-check', (req, res) => {
    res.status(200).json({ status: 'online', time: new Date().toISOString() });
  });
  
  const startServer = async () => {
    // Önce mevcut süreçleri zorla kapatmayı denemeyeceğiz
    // Bu yaklaşım daha güvenli
    try {
      server.listen(PORT, "0.0.0.0", async () => {
        log(`✅ Server çalışıyor: port ${PORT} (http://0.0.0.0:${PORT})`);
        log(`🌐 Dış erişim URL'si: ${process.env.REPLIT_URL || 'https://discord-halisaha-manager.emilswd.repl.co'}`);
      
      try {
        // Veritabanını başlat
        await initDatabase();
        log('Veritabanı başarıyla başlatıldı');
        
        // Discord botu başlat
        await initDiscordBot();
        log('Discord bot başlatılıyor - Client ID mevcut');
        
        // Uptime ve Keepalive servislerini başlat
        startUptimeService();
        startEnhancedKeepAliveService();
        startEnhancedUptimeService(); // Süper gelişmiş uptime servisi
        log('Tüm uptime servisleri başlatıldı - Sistem sürekli çalışmaya hazır (internet bağlantısı kopsa bile)');
      } catch (error) {
        console.error('Error in initialization:', error);
      }
    });
  } catch (err: any) {
    if (err.code === 'EADDRINUSE') {
      log(`Port ${port} is busy, trying port ${port + 1}...`);
      port = port + 1; // Alternatif port dene
      startServer(); // Yeniden başlatma denemesi
    } else {
      console.error('Server error:', err);
    }
  }
};

startServer(); // Sunucuyu başlat
})();
