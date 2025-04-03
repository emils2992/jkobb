import fetch from 'node-fetch';
import { CronJob } from 'cron';
import { log } from './vite';
import * as fs from 'fs';
import { createServer } from 'http';
import { URLS } from './external-pings';

// Replit URL'si - çevre değişkeninden al ya da dinamik olarak tespit et
const REPLIT_URL = process.env.REPLIT_URL || getReplicUrl();
const KEEPALIVE_FILE = './keepalive.json';
const UPTIME_LOG = './uptime.log';

// Interval ve süreler
const INTERNAL_PING_INTERVAL = 60 * 1000; // 1 dakika
const FILE_WRITE_INTERVAL = 30 * 1000; // 30 saniye
const EXTERNAL_PING_CRON = '*/10 * * * *'; // Her 10 dakikada bir
const HEALTH_CHECK_INTERVAL = 2 * 60 * 1000; // 2 dakika
const MEMORY_CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 dakika
const BACKUP_SERVER_PORT = 8088;

// Servis referansları
let internalPingInterval: NodeJS.Timeout | null = null;
let fileWriteInterval: NodeJS.Timeout | null = null;
let healthCheckInterval: NodeJS.Timeout | null = null;
let memoryCleanupInterval: NodeJS.Timeout | null = null;
let externalPingCron: CronJob | null = null;
let backupServer: any = null;

// Durum takibi
let serviceStatus = {
  isRunning: false,
  isHealthy: true,
  startTime: new Date(),
  lastSuccessfulPing: new Date(),
  pingCount: 0,
  successCount: 0,
  failureCount: 0,
  recoveryAttempts: 0,
  memoryUsage: process.memoryUsage(),
  lastUpdate: new Date()
};

// URL tespit fonksiyonu
function getReplicUrl() {
  try {
    // Ortam değişkenlerinden al
    if (process.env.REPLIT_URL) return process.env.REPLIT_URL;
    
    // Dinamik olarak tespit et
    const hostname = fs.existsSync('./.hostname') ? 
      fs.readFileSync('./.hostname', 'utf8').trim() : 
      'replit-app';
    
    return `https://${hostname}`;
  } catch (error) {
    log(`URL tespit hatası: ${error}`, 'uptime');
    return 'https://edd4ab32-9e68-45ea-9c30-ea0f7fd51d1d-00-xrddyi4151w7.pike.replit.dev';
  }
}

// Logger fonksiyonu
function logToFile(message: string, source: string = 'uptime') {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - [${source}] ${message}\n`;
  
  // Konsola log
  log(message, source);
  
  // Dosyaya log
  try {
    fs.appendFileSync(UPTIME_LOG, logMessage);
    
    // Log dosyası çok büyükse (1MB üzerinde) dosyayı temizle
    const stats = fs.statSync(UPTIME_LOG);
    if (stats.size > 1024 * 1024) {
      // Son 100 satırı tut
      const lines = fs.readFileSync(UPTIME_LOG, 'utf8').split('\n');
      const lastLines = lines.slice(Math.max(0, lines.length - 100));
      fs.writeFileSync(UPTIME_LOG, lastLines.join('\n'));
      log('Log dosyası temizlendi', source);
    }
  } catch (error) {
    console.error(`Log dosyası yazma hatası: ${error}`);
  }
}

/**
 * Süper gelişmiş uptime servisi - Replit projelerinin 7/24 aktif kalması için
 * Bu sistem birden fazla mekanizma kullanarak uygulamanın uyanık kalmasını sağlar
 * Internet bağlantısı kopsa bile sunucu aktif tutulur
 */
export function startEnhancedUptimeService() {
  // Zaten çalışıyorsa durdurup yeniden başlat
  if (serviceStatus.isRunning) {
    stopEnhancedUptimeService();
  }

  serviceStatus = {
    isRunning: true,
    isHealthy: true,
    startTime: new Date(),
    lastSuccessfulPing: new Date(),
    pingCount: 0,
    successCount: 0,
    failureCount: 0,
    recoveryAttempts: 0,
    memoryUsage: process.memoryUsage(),
    lastUpdate: new Date()
  };

  logToFile('🚀 Süper gelişmiş uptime servisi başlatılıyor...', 'enhanced');

  // 1. Dosya sistemi aktivitesi - Düzenli yazma işlemleri
  fileWriteInterval = setInterval(() => {
    try {
      serviceStatus.lastUpdate = new Date();
      serviceStatus.memoryUsage = process.memoryUsage();
      
      const data = {
        status: serviceStatus.isHealthy ? 'healthy' : 'recovering',
        lastUpdate: serviceStatus.lastUpdate.toISOString(),
        uptime: {
          server: process.uptime(),
          service: (Date.now() - serviceStatus.startTime.getTime()) / 1000
        },
        stats: {
          pingCount: serviceStatus.pingCount,
          successRate: serviceStatus.pingCount > 0 ? 
            (serviceStatus.successCount / serviceStatus.pingCount * 100).toFixed(2) + '%' : 
            '100%',
          failureCount: serviceStatus.failureCount,
          recoveryAttempts: serviceStatus.recoveryAttempts
        },
        memory: {
          rss: Math.round(serviceStatus.memoryUsage.rss / 1024 / 1024) + 'MB',
          heapTotal: Math.round(serviceStatus.memoryUsage.heapTotal / 1024 / 1024) + 'MB',
          heapUsed: Math.round(serviceStatus.memoryUsage.heapUsed / 1024 / 1024) + 'MB'
        },
        timestamp: Date.now()
      };
      
      fs.writeFileSync(KEEPALIVE_FILE, JSON.stringify(data, null, 2));
      
      // Her 10 yazma işleminde bir log (sık log oluşturma)
      if (serviceStatus.pingCount % 10 === 0) {
        logToFile(`📝 Durum dosyası güncellendi - Başarı oranı: ${data.stats.successRate}`, 'enhanced');
      }
    } catch (error) {
      logToFile(`❌ Durum dosyası yazma hatası: ${error}`, 'enhanced');
    }
  }, FILE_WRITE_INTERVAL);

  // 2. Dahili ping sistemi - Uygulama kendini düzenli olarak kontrol eder
  internalPingInterval = setInterval(async () => {
    try {
      serviceStatus.pingCount++;
      
      // Farklı endpoint'leri rastgele tercih et (cache etkisini azaltmak için)
      const endpoints = ['/ping', '/api/health', '/uptime-check', '/', '/login', '/dashboard'];
      const randomEndpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      const timestamp = Date.now();
      
      const response = await fetch(`${REPLIT_URL}${randomEndpoint}?t=${timestamp}`);
      
      if (response.ok) {
        serviceStatus.successCount++;
        serviceStatus.lastSuccessfulPing = new Date();
        serviceStatus.isHealthy = true;
      } else {
        serviceStatus.failureCount++;
        logToFile(`⚠️ Ping başarısız (${response.status}) - ${randomEndpoint}`, 'enhanced');
        await recoverService();
      }
    } catch (error) {
      serviceStatus.failureCount++;
      logToFile(`❌ Ping hatası: ${error}`, 'enhanced');
      await recoverService();
    }
  }, INTERNAL_PING_INTERVAL);

  // 3. Sağlık kontrol sistemi - Daha kapsamlı sağlık kontrolü
  healthCheckInterval = setInterval(async () => {
    try {
      // Ana sayfa erişilebilirliği
      try {
        const response = await fetch(REPLIT_URL);
        if (!response.ok) {
          logToFile(`⚠️ Ana sayfa erişim hatası (${response.status})`, 'enhanced');
          await recoverService();
        } else {
          if (!serviceStatus.isHealthy) {
            logToFile('✅ Uygulama düzeldi! Ana sayfa erişilebilir.', 'enhanced');
            serviceStatus.isHealthy = true;
          }
        }
      } catch (error) {
        logToFile(`❌ Ana sayfa kontrol hatası: ${error}`, 'enhanced');
        await recoverService();
      }
      
      // Bellek durumu kontrolü - Bellek fazla yüksekse temizle
      const memoryUsage = process.memoryUsage();
      const rssInMB = memoryUsage.rss / 1024 / 1024;
      
      if (rssInMB > 500) { // 500 MB üzerinde bellek kullanımı
        logToFile(`⚠️ Yüksek bellek kullanımı: ${rssInMB.toFixed(2)}MB - Temizleme başlatılıyor`, 'enhanced');
        try {
          if (typeof (global as any).gc === 'function') {
            (global as any).gc();
            logToFile('🧹 Garbage collector çalıştırıldı', 'enhanced');
          }
        } catch (e) {
          // GC hatası - yoksay
        }
      }
    } catch (error) {
      logToFile(`❌ Sağlık kontrol hatası: ${error}`, 'enhanced');
    }
  }, HEALTH_CHECK_INTERVAL);

  // 4. Bellek temizleme - Düzenli GC çağrısı
  memoryCleanupInterval = setInterval(() => {
    try {
      if (typeof (global as any).gc === 'function') {
        (global as any).gc();
        const newMemoryUsage = process.memoryUsage();
        const rssInMB = Math.round(newMemoryUsage.rss / 1024 / 1024);
        logToFile(`🧹 Periyodik bellek temizliği gerçekleştirildi - RSS: ${rssInMB}MB`, 'enhanced');
        serviceStatus.memoryUsage = newMemoryUsage;
      }
    } catch (error) {
      // GC hatası - yoksay
    }
  }, MEMORY_CLEANUP_INTERVAL);

  // 5. Dış ping servisleri - Cron job ile düzenli olarak ping at
  externalPingCron = new CronJob(EXTERNAL_PING_CRON, async () => {
    try {
      logToFile('🔄 Harici ping servisleri çalıştırılıyor...', 'enhanced');
      
      // Tüm harici ping servislerine istek gönder
      let successCount = 0;
      for (const url of URLS) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            successCount++;
          }
        } catch (error) {
          // Harici servis hatası - yoksay
        }
      }
      
      logToFile(`✅ Harici ping tamamlandı - ${successCount}/${URLS.length} başarılı`, 'enhanced');
    } catch (error) {
      logToFile(`❌ Harici ping hatası: ${error}`, 'enhanced');
    }
  });
  
  externalPingCron.start();

  // 6. Yedek HTTP sunucusu - İkinci bir port üzerinden aktif
  try {
    backupServer = createServer((req, res) => {
      const path = req.url?.split('?')[0] || '/';
      
      // API benzeri yanıtlar ver
      if (path === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'online',
          service: 'enhanced-uptime-backup',
          timestamp: new Date().toISOString(),
          stats: {
            uptime: process.uptime(),
            memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
            success_rate: serviceStatus.pingCount > 0 ? 
              (serviceStatus.successCount / serviceStatus.pingCount * 100).toFixed(2) + '%' : 
              '100%'
          }
        }));
      } else {
        // Basit bir HTML sayfası gönder
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Enhanced Uptime Service</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
    h1 { color: #0066cc; }
    .status { padding: 20px; background: #f0f8ff; border-radius: 8px; }
    .online { color: green; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Enhanced Uptime Service</h1>
  <div class="status">
    <p>Status: <span class="online">ONLINE</span></p>
    <p>Service uptime: ${Math.floor(process.uptime() / 3600)} hours, ${Math.floor((process.uptime() % 3600) / 60)} minutes</p>
    <p>Timestamp: ${new Date().toISOString()}</p>
  </div>
</body>
</html>`);
      }
    });
    
    backupServer.listen(BACKUP_SERVER_PORT, '0.0.0.0', () => {
      logToFile(`🔄 Yedek HTTP sunucusu başlatıldı - Port: ${BACKUP_SERVER_PORT}`, 'enhanced');
    });
  } catch (error) {
    logToFile(`❌ Yedek sunucu başlatma hatası: ${error}`, 'enhanced');
  }

  logToFile(`✅ Süper gelişmiş uptime servisi çalışıyor: ${REPLIT_URL}`, 'enhanced');
  return true;
}

/**
 * Servis düzeltme - Servis düşerse kurtarmak için çeşitli stratejiler uygula
 */
async function recoverService() {
  const endpoints = [
    '/ping', 
    '/api/health', 
    '/uptime-check', 
    '/', 
    '/login',
    '/dashboard',
    '/status'
  ];
  
  serviceStatus.recoveryAttempts++;
  logToFile('🔄 Kurtarma prosedürü başlatılıyor...', 'enhanced');
  
  // Bellek temizliği
  try {
    if (typeof (global as any).gc === 'function') {
      (global as any).gc();
      logToFile('🧹 GC çalıştırıldı', 'enhanced');
    }
  } catch (error) {
    // GC hatası - yoksay
  }
  
  // Her endpoint için 3 deneme yap, 3 saniye aralıklarla
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const endpoint of endpoints) {
      try {
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Cache busting için zaman damgası ekle
        const timestamp = Date.now();
        const response = await fetch(`${REPLIT_URL}${endpoint}?recovery=true&attempt=${attempt}&t=${timestamp}`);
        
        if (response.ok) {
          logToFile(`✅ Kurtarma başarılı - Endpoint: ${endpoint}, Deneme: ${attempt + 1}`, 'enhanced');
          serviceStatus.isHealthy = true;
          serviceStatus.lastSuccessfulPing = new Date();
          return true;
        }
      } catch (error) {
        logToFile(`❌ Kurtarma hatası - Endpoint: ${endpoint}, Deneme: ${attempt + 1}`, 'enhanced');
      }
    }
  }
  
  logToFile('⚠️ Kurtarma denemeleri başarısız - Servisi yeniden başlatmadan devam ediliyor', 'enhanced');
  return false;
}

/**
 * Uptime servisini durdur
 */
export function stopEnhancedUptimeService() {
  logToFile('🛑 Uptime servisi durduruluyor...', 'enhanced');
  
  // İnterval'ları temizle
  if (internalPingInterval) {
    clearInterval(internalPingInterval);
    internalPingInterval = null;
  }
  
  if (fileWriteInterval) {
    clearInterval(fileWriteInterval);
    fileWriteInterval = null;
  }
  
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
  
  if (memoryCleanupInterval) {
    clearInterval(memoryCleanupInterval);
    memoryCleanupInterval = null;
  }
  
  // Cron job'u durdur
  if (externalPingCron) {
    externalPingCron.stop();
    externalPingCron = null;
  }
  
  // Yedek sunucuyu kapat
  if (backupServer) {
    try {
      backupServer.close();
      backupServer = null;
    } catch (error) {
      logToFile(`❌ Yedek sunucu kapatma hatası: ${error}`, 'enhanced');
    }
  }
  
  serviceStatus.isRunning = false;
  logToFile('✅ Uptime servisi durduruldu', 'enhanced');
  return true;
}

// Durum bilgisini al
export function getUptimeStatus() {
  return {
    ...serviceStatus,
    uptime: process.uptime(),
    memoryUsageMB: {
      rss: Math.round(serviceStatus.memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(serviceStatus.memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(serviceStatus.memoryUsage.heapUsed / 1024 / 1024)
    }
  };
}