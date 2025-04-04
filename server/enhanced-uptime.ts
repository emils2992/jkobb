import fetch from 'node-fetch';
import { log } from './vite';
import { createServer } from 'http';
import * as fs from 'fs';

// Replit URL'si - çevre değişkeninden al ya da sabit değeri kullan
const REPLIT_URL = process.env.REPLIT_URL || "https://discord-halisaha-manager.emilswd.repl.co";
const UPTIME_LOG = './uptime.log';
const BACKUP_SERVER_PORT = 8099; // Yedek sunucu için port
const CHECK_INTERVAL = 2 * 60 * 1000; // 2 dakika
const URLS = [REPLIT_URL];

// Sunucu durumu izleme
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

let pingIntervals: NodeJS.Timeout[] = [];
let backupServer: any = null;

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

  // Belirli aralıklarla sistemi ping'leme
  URLS.forEach(url => {
    const interval = setInterval(async () => {
      try {
        serviceStatus.pingCount++;
        const timestamp = Date.now();
        const response = await fetch(`${url}/ping?t=${timestamp}`, { timeout: 10000 });

        if (response.ok) {
          serviceStatus.successCount++;
          serviceStatus.lastSuccessfulPing = new Date();
          if (!serviceStatus.isHealthy) {
            logToFile(`✅ Servis tekrar sağlıklı duruma geldi: ${url}`, 'enhanced');
            serviceStatus.isHealthy = true;
          }
        } else {
          serviceStatus.failureCount++;
          serviceStatus.isHealthy = false;
          logToFile(`⚠️ Ping başarısız - HTTP ${response.status}: ${url}`, 'enhanced');
          await recoverService();
        }
      } catch (error) {
        serviceStatus.failureCount++;
        serviceStatus.isHealthy = false;
        logToFile(`❌ Ping hatası: ${error}`, 'enhanced');
        await recoverService();
      } finally {
        // Her 30 ping'de bir durum güncellemesi logla
        if (serviceStatus.pingCount % 30 === 0) {
          const uptime = Math.floor((Date.now() - serviceStatus.startTime.getTime()) / 1000 / 60);
          const successRate = (serviceStatus.successCount / serviceStatus.pingCount) * 100;
          logToFile(`📊 Durum: Çalışma süresi ${uptime} dk, Başarı oranı: %${successRate.toFixed(2)}`, 'enhanced');

          // Bellek kullanımını güncelle
          serviceStatus.memoryUsage = process.memoryUsage();
          serviceStatus.lastUpdate = new Date();
        }
      }
    }, CHECK_INTERVAL);

    pingIntervals.push(interval);
  });

  // Bellek yönetimi
  const memoryInterval = setInterval(() => {
    try {
      // Garbage collector'ı çalıştırmaya çalış
      if (typeof (global as any).gc === 'function') {
        (global as any).gc();
        logToFile('🧹 Bellek temizlendi', 'enhanced');
      }

      // Bellek kullanımını logla
      const memoryUsage = process.memoryUsage();
      const heapUsed = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const rss = Math.round(memoryUsage.rss / 1024 / 1024);

      // Sadece yüksek bellek kullanımında log at
      if (heapUsed > 200 || rss > 300) {
        logToFile(`⚠️ Yüksek bellek kullanımı: Heap ${heapUsed}MB, RSS ${rss}MB`, 'enhanced');
      }

      serviceStatus.memoryUsage = memoryUsage;
    } catch (error) {
      // Hata durumunda sessizce devam et
    }
  }, 10 * 60 * 1000); // 10 dakikada bir

  pingIntervals.push(memoryInterval);

  // Yedek HTTP sunucusu - ikinci bir port üzerinden yedek hizmet ver
  try {
    backupServer = createServer((req, res) => {
      const url = req.url || '/';

      // Sağlık kontrolü URL'leri için JSON yanıt ver
      if (url.includes('/ping') || 
          url.includes('/health') || 
          url.includes('/uptime') || 
          url.includes('/status')) {

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'active',
          service: 'enhanced-uptime-backup',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          stats: getUptimeStatus()
        }));
      } else {
        // Diğer istekler için basit yanıt
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Discord Bot - Enhanced Uptime Backup Service');
      }
    });

    backupServer.listen(BACKUP_SERVER_PORT, '0.0.0.0', () => {
      logToFile(`✅ Yedek HTTP sunucusu başlatıldı - Port: ${BACKUP_SERVER_PORT}`, 'enhanced');
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
          return true;
        }
      } catch (error) {
        logToFile(`❌ Kurtarma hatası - Endpoint: ${endpoint}, Deneme: ${attempt + 1}, Hata: ${error}`, 'enhanced');
      }
    }
  }

  logToFile('⚠️ Tüm kurtarma denemeleri başarısız oldu', 'enhanced');
  return false;
}

/**
 * Uptime servisini durdur
 */
export function stopEnhancedUptimeService() {
  // Tüm interval'ları temizle
  pingIntervals.forEach(interval => clearInterval(interval));
  pingIntervals = [];

  // Yedek sunucuyu kapat
  if (backupServer) {
    try {
      backupServer.close();
      backupServer = null;
    } catch (error) {
      console.error('Yedek sunucu kapatma hatası:', error);
    }
  }

  serviceStatus.isRunning = false;
  logToFile('🛑 Süper gelişmiş uptime servisi durduruldu', 'enhanced');
  return true;
}

/**
 * Uptime durumunu döndür
 */
export function getUptimeStatus() {
  const uptime = Math.floor((Date.now() - serviceStatus.startTime.getTime()) / 1000 / 60);
  const successRate = serviceStatus.pingCount > 0 
    ? (serviceStatus.successCount / serviceStatus.pingCount) * 100 
    : 100;

  return {
    isRunning: serviceStatus.isRunning,
    isHealthy: serviceStatus.isHealthy,
    startTime: serviceStatus.startTime,
    uptime: `${uptime} dakika`,
    lastSuccessfulPing: serviceStatus.lastSuccessfulPing,
    pingCount: serviceStatus.pingCount,
    successCount: serviceStatus.successCount,
    failureCount: serviceStatus.failureCount,
    recoveryAttempts: serviceStatus.recoveryAttempts,
    successRate: `%${successRate.toFixed(2)}`,
    memoryUsage: {
      heapUsed: `${Math.round(serviceStatus.memoryUsage.heapUsed / 1024 / 1024)} MB`,
      rss: `${Math.round(serviceStatus.memoryUsage.rss / 1024 / 1024)} MB`
    },
    lastUpdate: serviceStatus.lastUpdate
  };
}