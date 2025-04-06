// Bu dosya, projenin 7/24 çalışmasını sağlayan özel bir uptime sistemidir
// UptimeRobot ve benzeri servislerle kolayca entegre olur

import http from 'http';
import * as fs from 'fs';

// Log dosyası
const LOG_FILE = './ping-uptime.log';
const BACKUP_PORT = 9988; // Alternatif yedek port - değiştirildi çakışma olmasın diye

// TypeScript için global tanımlamalar
declare global {
  namespace NodeJS {
    interface Global {
      gc?: () => void; 
    }
  }
}

// Log fonksiyonu
function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}\n`;
  console.log(`[UPTIME] ${message}`);
  
  try {
    fs.appendFileSync(LOG_FILE, logMessage);
    
    // Log dosyası büyüdüğünde kırp
    const stats = fs.statSync(LOG_FILE);
    if (stats.size > 1024 * 1024) { // 1MB
      const data = fs.readFileSync(LOG_FILE, 'utf8');
      const lines = data.split('\n');
      const lastLines = lines.slice(-100); // Son 100 satırı tut
      fs.writeFileSync(LOG_FILE, lastLines.join('\n'));
    }
  } catch (err) {
    console.error('Log yazma hatası:', err);
  }
}

// Disk aktivitesi oluştur - Bu projeyi uyanık tutar
function createDiskActivity() {
  setInterval(() => {
    try {
      const timestamp = new Date().toISOString();
      fs.writeFileSync('./ping-keepalive.json', JSON.stringify({
        timestamp,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        status: 'active'
      }, null, 2));
    } catch (err) {
      log(`Disk aktivite hatası: ${err}`);
    }
  }, 30 * 1000); // 30 saniyede bir
}

// Ana sunucu
function createPingServer() {
  const server = http.createServer((req, res) => {
    const url = req.url || '/';
    
    // Farklı ping endpoint'leri için yanıt ver
    if (url.includes('/ping') || url.includes('/uptime-check') || url.includes('/health') || url === '/') {
      // UptimeRobot'un "pause" sorununu çözmek için
      // UptimeRobot bazen cevapları cache'leyip, "paused" durumuna geçebiliyor
      // Cache'lemeyi engellemek için rastgele içerik ve HTML formatı kullanıyoruz
      
      // Rastgele ID ve timestamp oluştur (her cevap benzersiz olsun)
      const randomId = Math.random().toString(36).substring(2, 15);
      const timestamp = Date.now();
      
      // HTML formatında yanıt ver (UptimeRobot'un "paused" olmasını engeller)
      if (url.includes('/ping-html') || url.includes('/html')) {
        res.writeHead(200, { 
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Surrogate-Control': 'no-store'
        });
        res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Discord Bot Uptime</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="cache-control" content="max-age=0, no-cache, no-store, must-revalidate">
  <meta http-equiv="pragma" content="no-cache">
  <meta http-equiv="expires" content="0">
</head>
<body>
  <h2>Discord Bot: ONLINE</h2>
  <p>Status: <span style="color:green;font-weight:bold">ACTIVE</span></p>
  <p>Uptime: ${Math.floor(process.uptime() / 3600)} hours, ${Math.floor((process.uptime() % 3600) / 60)} minutes</p>
  <p>Random ID: ${randomId}</p>
  <p>Timestamp: ${timestamp}</p>
  <p style="display:none">${new Date().toISOString()}</p>
</body>
</html>`);
      } 
      // JSON formatında yanıt ver (normal durum)
      else {
        res.writeHead(200, { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Surrogate-Control': 'no-store'
        });
        res.end(JSON.stringify({
          status: 'online',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          message: 'Discord Bot 7/24 aktif',
          random_id: randomId,
          ts: timestamp
        }));
      }
      
      // Her 50 istekte bir log (sık log oluşturmamak için)
      if (Math.random() < 0.02) {
        log(`Ping isteği alındı: ${url}`);
      }
    } else {
      // Bilinmeyen endpoint
      res.writeHead(404);
      res.end('Not found');
    }
  });
  
  // Port çakışması olmayacak bir port seç
  server.listen(BACKUP_PORT, '0.0.0.0', () => {
    log(`Ping sunucusu çalışıyor - Port: ${BACKUP_PORT}`);
  });
  
  return server;
}

// Ana sistem başlat
function startUptimeSystem() {
  log('🚀 Özel uptime sistemi başlatılıyor...');
  
  // Disk aktivitesi başlat
  createDiskActivity();
  
  // Ping sunucusu başlat
  const server = createPingServer();
  
  // İzleme sistemi - 15 dakikada bir kontrol
  setInterval(() => {
    // Memory sızıntılarını kontrol et
    const memoryUsage = process.memoryUsage();
    const heapUsed = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    
    if (heapUsed > 200) { // 200MB'dan fazla bellek kullanımı
      log(`⚠️ Yüksek bellek kullanımı algılandı: ${heapUsed}MB - GC çağrılıyor`);
      try {
        if (global.gc) {
          global.gc();
          log('✅ Garbage collection çalıştırıldı');
        }
      } catch (err) {
        // GC çağrılamadı - yoksay
      }
    }
    
    // Sağlık kontrolü
    log(`Health check - Uptime: ${Math.floor(process.uptime() / 3600)} saat, Memory: ${heapUsed}MB`);
  }, 15 * 60 * 1000); // 15 dakika
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    log('SIGTERM sinyali alındı, kapatılıyor...');
    server.close(() => {
      log('Uptime sunucusu kapatıldı');
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    log('SIGINT sinyali alındı, kapatılıyor...');
    server.close(() => {
      log('Uptime sunucusu kapatıldı');
      process.exit(0);
    });
  });
  
  log('✅ Uptime sistemi aktif');
  return server;
}

// Burada otomatik başlatmayı kaldırıyoruz, bunun yerine export ettiğimiz fonksiyon kullanılacak
// const server = startUptimeSystem();

// Graceful shutdown işleyicilerini startUptimeSystem içine taşıyoruz
// Böylece server değişkeni tanımsız hatası almayız

// UptimeRobot ve benzeri servisler için export
export { startUptimeSystem };