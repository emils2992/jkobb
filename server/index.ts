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

  // Replit'de her zaman Vite'ı çalıştır
  // Bu değişiklik Replit'in development modunda düzgün çalışmasını sağlar
  await setupVite(app, server);

  // Replit'in beklediği port olan 5000'i kullan veya env değişkeninden al
  let port = process.env.PORT ? parseInt(process.env.PORT) : 5000; // Replit 5000 portunu bekliyor, ancak env'den de alabiliriz
  
  // Temel uptime/health endpoint'leri için genişletilmiş rotalar
  app.get('/', (req, res) => {
    // HTML sayfasına yönlendir, bu sayede server çalışır durumda olsa da
    // doğrudan Vite'a ulaşamayanlar bu sayfayı görebilir
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Discord Bot - Epic Lig Yönetim Sistemi</title>
        <style>
            body {
                font-family: 'Inter', sans-serif;
                background-color: #36393F;
                color: #DCDDDE;
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                text-align: center;
            }
            .container {
                max-width: 800px;
                padding: 2rem;
                background-color: #2F3136;
                border-radius: 8px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            }
            h1 {
                color: #5865F2;
                margin-bottom: 1rem;
            }
            p {
                margin-bottom: 1.5rem;
                line-height: 1.6;
            }
            .status {
                display: inline-block;
                padding: 0.5rem 1rem;
                background-color: #43B581;
                border-radius: 4px;
                margin-top: 1rem;
                font-weight: bold;
            }
            .links {
                margin-top: 2rem;
            }
            a {
                color: #00AFF4;
                text-decoration: none;
            }
            a:hover {
                text-decoration: underline;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Epic Lig Discord Bot</h1>
            <p>Discord bot sistemi aktif olarak çalışıyor. Bot, Discord sunucunuzda antrenman kayıtlarını, rating rollerini ve diğer işlevleri yönetmek için kullanılabilir.</p>
            
            <div class="status">Bot Aktif ✓</div>
            
            <div class="links">
                <p>
                    <strong>Yönetim Paneline Git:</strong> <a href="/dashboard">Dashboard</a><br>
                    <strong>Discord Sunucusuna Git:</strong> <a href="https://discord.gg/epiclig" target="_blank">Epic Lig Discord</a>
                </p>
            </div>
            
            <p><small>Son Güncelleme: ${new Date().toLocaleString('tr-TR')}</small></p>
        </div>
    </body>
    </html>
    `;
    res.status(200).send(htmlContent);
  });
  
  app.get('/ping', (req, res) => {
    res.status(200).send('Pong!');
  });
  
  app.get('/uptime-check', (req, res) => {
    res.status(200).json({ status: 'online', time: new Date().toISOString() });
  });
  
  const startServer = async () => {
    // Dinamik port deneme mekanizması ile sunucu başlatma
    const tryStartServer = (currentPort: number, maxRetries = 5) => {
      if (maxRetries <= 0) {
        log(`❌ Maksimum port deneme sayısına ulaşıldı, sunucu başlatılamıyor.`);
        return;
      }

      try {
        // Önce sunucuyu başlat, diğer işlemleri paralel olarak yap
        server.listen(currentPort, "0.0.0.0", () => {
          log(`✅ Server çalışıyor: port ${currentPort} (http://0.0.0.0:${currentPort})`);
          
          // Replit URL'sini al ve UptimeRobot için ping endpoint'lerini logla
          const replHost = process.env.REPL_SLUG ? `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : null;
          const baseUrl = replHost ? `https://${replHost}` : (process.env.REPL_URL || process.env.REPLIT_URL || `http://0.0.0.0:${currentPort}`);
          log(`🌐 Dış erişim URL'si: ${baseUrl}`);
          
          // UptimeRobot için URL'leri logla
          log(`🔔 UptimeRobot için ping URL'leri:`);
          log(`   • ${baseUrl}/ping`);
          log(`   • ${baseUrl}/uptime-check`);
          log(`   • ${baseUrl}/api/health`);
          
          // Veritabanı ve Discord bot başlatma işlemlerini paralel olarak yap
          // Sunucu çalışmaya başladığı için bu işlemler arka planda yapılabilir
          (async () => {
            try {
              // Veritabanını başlat
              log('Veritabanını başlatmayı deniyor...');
              await initDatabase();
              log('Veritabanı başarıyla başlatıldı');
              
              // Discord botu başlat
              if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_CLIENT_ID) {
                log('Discord bot başlatılıyor - Token ve Client ID mevcut');
                initDiscordBot().catch(err => {
                  console.error('Discord bot başlatılamadı, ancak sunucu çalışmaya devam edecek', err);
                });
              } else {
                console.log('DISCORD_BOT_TOKEN veya DISCORD_CLIENT_ID bulunamadı. Bot başlatılmayacak.');
              }
              
              // Uptime ve Keepalive servislerini başlat
              startUptimeService();
              startEnhancedKeepAliveService();
              startEnhancedUptimeService(); // Süper gelişmiş uptime servisi
              log('Tüm uptime servisleri başlatıldı - Sistem sürekli çalışmaya hazır');
            } catch (error) {
              console.error('Error in initialization:', error);
            }
          })();
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
