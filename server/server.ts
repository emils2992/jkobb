import express, { Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startSimpleUptimeService } from "./uptime-simple";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { initDatabase } from "./db";
import { initDiscordBot } from "./discord";

// Express uygulamasını kur
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session ayarları
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
    maxAge: 24 * 60 * 60 * 1000 
  }
}));

// Log middleware'i
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

// Temel sağlık kontrolü
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Ana sayfa route'u ekleyelim
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: './public' });
});

// Ping endpoint for UptimeRobot
app.get('/ping', (req, res) => {
  res.status(200).send('Pong!');
});

// Uptime check endpoint
app.get('/uptime-check', (req, res) => {
  res.status(200).json({
    status: 'online',
    timestamp: new Date().toISOString(),
    server: 'Discord Halısaha Bot'
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Hata yakalama middleware'i
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
  console.error(err);
});

// Main app setup
(async () => {
  try {
    // Önce veritabanını başlat
    await initDatabase();
    log('Veritabanı başarıyla başlatıldı');

    // Önce serveri başlat ve portu aç
    const port = 5000;
    const server = await registerRoutes(app);
    
    // Discord botu başlat
    setTimeout(async () => {
      try {
        await initDiscordBot();
        log('Discord bot başlatıldı');
      } catch (error) {
        console.error('Discord bot başlatma hatası:', error);
      }
    }, 2000); // 2 saniye sonra başlat
    
    // Uptime servisi başlat
    startSimpleUptimeService();
    log('Basit uptime servisi başlatıldı');
    
    // Vite ayarları
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }
    
    // En son sunucuyu başlat
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`Server başlatıldı, port: ${port}`);
    });
  } catch (err) {
    console.error('Server başlatma hatası:', err);
    process.exit(1);
  }
})();