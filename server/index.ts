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

  // Önceki tüm süreçleri öldür ve ardından yeni sunucuyu başlat
  // Ana port 5000, eğer meşgulse 5001 veya başka bir port denenecek
  let port = 5000;
  const startServer = async () => {
    try {
      // Önce mevcut süreçleri temizle
      try {
        const { exec } = require('child_process');
        exec('fuser -k 5000/tcp', (err: any, stdout: any, stderr: any) => {
          if (err) console.log('Port 5000 zaten boş veya temizlenemedi');
        });
      } catch (e) {
        console.log('Port temizleme işlemi başarısız oldu, devam ediliyor');
      }
      
      // Kısa bir bekleme süresi ekle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      server.listen({
        port,
        host: "0.0.0.0", // Tüm ağ arayüzlerinden erişilebilir olmasını sağlar
        reusePort: true,
      }, async () => {
    log(`serving on port ${port} (http://0.0.0.0:${port})`);
      log(`Dış erişim URL'si: ${process.env.REPLIT_URL || 'https://edd4ab32-9e68-45ea-9c30-ea0f7fd51d1d-00-xrddyi4151w7.pike.replit.dev'}`);
      
      try {
        // Veritabanını başlat
        await initDatabase();
        log('Veritabanı başarıyla başlatıldı');
        
        // Discord bot geçici olarak devre dışı bırakıldı
        // await initDiscordBot();
        log('Discord bot devre dışı bırakıldı - Client ID sağlanmadığı için');
        
        // Uptime ve Keepalive servislerini başlat
        startUptimeService();
        startEnhancedKeepAliveService();
        log('Uptime ve Keepalive servisleri başlatıldı - Sistem sürekli çalışmaya hazır');
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
