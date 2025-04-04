import { createServer, Server } from 'http';
import { log } from './vite';
import * as fs from 'fs';
import fetch from 'node-fetch';

// Replit URL'si - çevre değişkeninden al ya da alternatif kaynaklardan
const REPLIT_URL = process.env.REPLIT_URL || process.env.REPL_URL || 'https://discord-halisaha-manager.emilswd.repl.co';
const BACKUP_SERVER_PORT = 8066; // Ana port ile çakışmayan bir yedek port

// Servis durumunu izleyen veri yapısı
const serviceStatus = {
  isRunning: true,
  lastSuccessfulPing: new Date(),
  uptime: process.uptime(),
  pingStats: {
    total: 0,
    successful: 0,
    failed: 0,
  },
  recoveryAttempts: 0,
  lastUpdate: new Date(),
  memoryUsage: process.memoryUsage(),
};

let pingIntervals: NodeJS.Timeout[] = [];
let backupServer: Server | null = null;

// Log işlevini gelişmiş bir şekilde yazdır ve dosyaya kaydet
function logToFile(message: string, source = 'uptime') {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} [${source}] ${message}`;

  log(message, source);

  try {
    // Uptime loglarını bir dosyada sakla (isteğe bağlı)
    fs.appendFileSync('uptime.log', logMessage + '\n');
  } catch (error) {
    // Dosyaya yazma hatası durumunda sessizce devam et
  }
}

/**
 * Servis durumunu döndür
 */
export function getEnhancedServiceStatus() {
  return {
    ...serviceStatus,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Gelişmiş uptime servisini başlat
 */
export async function startEnhancedUptimeService() {
  // Önceki ping aralıklarını temizle
  pingIntervals.forEach(clearInterval);
  pingIntervals = [];

  // Yedek sunucuyu kapat (varsa)
  if (backupServer) {
    try {
      backupServer.close();
    } catch (error) {
      // Hata durumunda sessizce devam et
    }
    backupServer = null;
  }

  serviceStatus.isRunning = true;
  serviceStatus.recoveryAttempts = 0;
  serviceStatus.lastUpdate = new Date();
  serviceStatus.pingStats = {
    total: 0,
    successful: 0,
    failed: 0,
  };

  logToFile('🚀 Süper gelişmiş uptime servisi başlatılıyor...', 'enhanced');

  // Kontrol aralığı (ms cinsinden)
  const CHECK_INTERVAL = 5 * 60 * 1000; // 5 dakika

  // Kontrol edilecek endpoint'ler
  const endpoints = [
    '/ping',
    '/api/health',
    '/uptime-check',
    '/uptime-status',
  ];

  // Her endpoint için otomatik ping işlemi başlat
  endpoints.forEach(endpoint => {
    const interval = setInterval(async () => {
      try {
        const url = `${REPLIT_URL}${endpoint}`;
        const response = await fetch(url);

        serviceStatus.pingStats.total++;

        if (response.ok) {
          serviceStatus.pingStats.successful++;
          serviceStatus.lastSuccessfulPing = new Date();

          // Sadece 10 denemede bir log at (aşırı log oluşturmamak için)
          if (serviceStatus.pingStats.total % 10 === 0) {
            // Başarı oranını hesapla
            const successRate = (serviceStatus.pingStats.successful / serviceStatus.pingStats.total) * 100;
            logToFile(`✅ Endpoint kontrolü başarılı: ${endpoint} - Başarı oranı: %${successRate.toFixed(2)}`, 'enhanced');

            // Bellek kullanımını güncelle
            serviceStatus.memoryUsage = process.memoryUsage();
            serviceStatus.lastUpdate = new Date();
          }
        }
      } catch (error) {
        serviceStatus.pingStats.failed++;

        // Başarı oranını hesapla
        const successRate = (serviceStatus.pingStats.successful / serviceStatus.pingStats.total) * 100;
        logToFile(`❌ Endpoint kontrolü başarısız: ${endpoint} - Başarı oranı: %${successRate.toFixed(2)}`, 'enhanced');

        // Bellek kullanımını güncelle
        serviceStatus.memoryUsage = process.memoryUsage();
        serviceStatus.lastUpdate = new Date();
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
          stats: getEnhancedServiceStatus()
        }));
      } else {
        // Diğer istekler için basit yanıt
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Discord Bot - Enhanced Uptime Backup Service');
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
      logToFile('🧹 Bellek temizlendi', 'enhanced');
    }
  } catch (error) {
    // Hata durumunda sessizce devam et
  }

  // Endpoint kontrolleri
  let allEndpointsFailing = true;

  // Her endpoint'i kontrol et
  for (const endpoint of endpoints) {
    try {
      const url = `${REPLIT_URL}${endpoint}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

      if (response.ok) {
        allEndpointsFailing = false;
        logToFile(`✅ Endpoint hayatta: ${endpoint}`, 'enhanced');
        break;
      }
    } catch (error) {
      logToFile(`❌ Endpoint erişilemez: ${endpoint}`, 'enhanced');
    }
  }

  // Tüm endpoint'ler başarısız ise yeniden başlatmayı dene
  if (allEndpointsFailing) {
    logToFile('⚠️ Tüm endpoint\'ler yanıt vermiyor!', 'enhanced');

    // Yedek endpoint'i etkinleştir
    if (!backupServer) {
      startEnhancedUptimeService();
    }

    return false;
  }

  return true;
}


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

// İstatistik bilgilerini döndüren yardımcı fonksiyon
export function getEnhancedUptimeStatus() {
  return {
    isRunning: serviceStatus.isRunning || false,
    uptime: process.uptime(),
    pingStats: serviceStatus.pingStats || { total: 0, successful: 0, failed: 0 },
    recoveryAttempts: serviceStatus.recoveryAttempts || 0,
    lastSuccessfulPing: serviceStatus.lastSuccessfulPing || new Date(),
    lastUpdate: serviceStatus.lastUpdate || new Date(),
    memoryUsage: serviceStatus.memoryUsage || process.memoryUsage()
  };
}