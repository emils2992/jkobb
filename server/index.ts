// Ana başlangıç dosyası - Bu dosya projenin giriş noktasıdır
import express from "express";
import { createServer } from "http";
import { log } from "./vite";
import { pool } from "./db";
import { registerRoutes } from "./routes";
import { startSimpleUptimeService } from "./uptime-simple";
import { initDatabase } from "./db";
import { initDiscordBot } from "./discord";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import path from "path";
import { setupStaticServer } from './public-server';

console.log('PostgreSQL veritabanı depolaması kullanılıyor');

// Basit express uygulaması oluştur
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

// Sağlık kontrolü için endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Ping endpoint
app.get('/ping', (req, res) => {
  res.status(200).send('Pong!');
});

// Uptime kontrol noktası
app.get('/uptime-check', (req, res) => {
  res.status(200).json({
    status: 'online',
    timestamp: new Date().toISOString(),
    server: 'Discord Halısaha Bot'
  });
});

// 5000 portunu hızlıca aç, sonra diğer işlemleri başlat
(async () => {
  try {
    // İlk olarak serveri başlat
    const server = createServer(app);
    
    // Portu aç, 5000 portu Replit'te standart
    server.listen(5000, '0.0.0.0', async () => {
      log('Port 5000 açıldı, server başlatılıyor...');
      
      try {
        // Veritabanını başlat
        await initDatabase();
        log('Veritabanı başarıyla başlatıldı');
        
        // API rotalarını tanımla
        const httpServer = await registerRoutes(app);
        
        // Uptime servisi başlat
        startSimpleUptimeService();
        log('Uptime servisi başlatıldı');
        
        // Vite ayarları - Frontend'i servis et
        try {
          const { setupVite, serveStatic } = await import('./vite');
          if (app.get("env") === "development") {
            await setupVite(app, server);
            log('Vite başarıyla ayarlandı');
          } else {
            serveStatic(app);
            log('Statik dosyalar başarıyla servis edildi');
          }
        } catch (error) {
          console.error('Vite ayarlama hatası:', error);
        }
        
        // Basit ping endpointleri - bunlar her durumda erişilebilir olmalı
        app.get('/ping', (req, res) => {
          res.status(200).send('Pong!');
        });
        
        // Uptime check endpoint'i
        app.get('/uptime-check', (req, res) => {
          res.status(200).json({
            status: 'online',
            timestamp: new Date().toISOString(),
            server: 'Discord Halısaha Bot'
          });
        });
        
        // Vite ayarları - Frontend'i servis et
        try {
          // Öncelikle API rotalarımızı tanımla
          const apiRoutes = ['/api', '/ping', '/uptime-check', '/health'];
          
          // API isteği ise pas geç
          app.use((req, res, next) => {
            const isApiRequest = apiRoutes.some(route => req.path.startsWith(route));
            if (isApiRequest) {
              return next();
            }
            
            // API olmayan istekler için devam et
            next();
          });
          
          // Vite'ı ayarla
          const { setupVite, serveStatic } = await import('./vite');
          if (app.get("env") === "development") {
            await setupVite(app, server);
            log('Vite başarıyla ayarlandı ve React uygulaması (development) servis ediliyor');
          } else {
            serveStatic(app);
            log('React uygulaması (production) statik olarak servis ediliyor');
          }
        } catch (error) {
          console.error('Vite ayarlama hatası:', error);
        }
        
        // Discord bot'u son olarak başlat (bu uzun sürebilir)
        setTimeout(async () => {
          try {
            await initDiscordBot();
            log('Discord bot başarıyla başlatıldı');
          } catch (error) {
            console.error('Discord bot başlatma hatası:', error);
          }
        }, 2000);
      } catch (error) {
        console.error('Server başlatma hatası:', error);
      }
    });
  } catch (err) {
    console.error('Kritik başlatma hatası:', err);
    process.exit(1);
  }
})();