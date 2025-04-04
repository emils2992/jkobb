import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initDiscordBot } from "./discord";
import { initDatabase } from "./db";
import { pool } from "./db";
import { startUptimeService } from "./uptime";
import ConnectPgSimple from "connect-pg-simple";

// Hata yakalama için global handler
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Replit proxy'lerini güven
app.set('trust proxy', 1);

// API istekleri için hız sınırlayıcı
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 dakika
  max: 120, // Her IP'den dakikada maksimum 120 istek
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
    tableName: 'session',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'discord-manager-secret-key', 
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
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

// Basit health check endpoint'leri
app.get('/ping', (req, res) => {
  res.status(200).send('Pong!');
});

app.get('/uptime-check', (req, res) => {
  res.status(200).json({ 
    status: 'online', 
    timestamp: new Date().toISOString(),
    server: 'Discord Halısaha Bot'
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/', (req, res) => {
  res.status(200).send('Discord Bot Server Running');
});

(async () => {
  try {
    // Veritabanını başlat
    await initDatabase();
    console.log('Veritabanı başarıyla başlatıldı');

    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      console.error('Server error:', err);
    });

    // Development ortamında Vite'ı kur
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Sunucuyu başlat
    const port = 5000;
    server.listen(port, "0.0.0.0", async () => {
      console.log(`✅ Server çalışıyor: port ${port} (http://0.0.0.0:${port})`);

      try {
        // Discord botu başlat
        await initDiscordBot();
        console.log('Discord bot başarıyla başlatıldı');

        // Basit uptime servisi başlat
        startUptimeService();
        console.log('Uptime servisi başlatıldı');
      } catch (error) {
        console.error('Başlatma hatası:', error);
      }
    });
  } catch (error) {
    console.error('Server başlatma hatası:', error);
  }
})();