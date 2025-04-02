import fetch from 'node-fetch';
import { CronJob } from 'cron';
import { log } from './vite';
import * as fs from 'fs';
import { createServer } from 'http';
import { URLS } from './external-pings';

// TypeScript için global gc tanımlaması yok - runtime checking kullanılacak

// Replit URL'si - çevre değişkeninden al ya da sağlanan hardcoded değeri kullan
const REPLIT_URL = process.env.REPLIT_URL || "https://edd4ab32-9e68-45ea-9c30-ea0f7fd51d1d-00-xrddyi4151w7.pike.replit.dev";
const KEEPALIVE_FILE = './keepalive.json';
const INTERNAL_PING_INTERVAL = 5 * 60 * 1000; // 5 dakika
const EXTERNAL_PING_INTERVAL = '*/15 * * * *'; // Her 15 dakikada bir cron job (daha sık)
const LOG_FILE = './uptime.log';

// Zamanlanmış görevleri ve interval'ları saklamak için değişkenler
let internalPingInterval: NodeJS.Timeout | null = null;
let keepAliveFileInterval: NodeJS.Timeout | null = null;
let externaPingCron: CronJob | null = null;
let backupServer: any = null;

// Son durum bilgisi
let isHealthy = true;
let lastStatus = {
  lastCheck: new Date(),
  pingCount: 0,
  successCount: 0,
  failureCount: 0,
  uptimePercentage: 100,
};

/**
 * Uygulamanın uptime'ını sağlamak için gelişmiş keep-alive servisi
 * Bu servis, tarayıcı kapansa bile projenin aktif kalmasını sağlar
 */
export function startEnhancedKeepAliveService() {
  // Logger
  function logToFile(message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} - ${message}\n`;
    
    // Konsola log
    log(message, 'keepalive');
    
    // Dosyaya log
    try {
      fs.appendFileSync(LOG_FILE, logMessage);
    } catch (error) {
      console.error('Log dosyasına yazma hatası:', error);
    }
  }

  // Zaten çalışıyorsa, önce durdur
  stopEnhancedKeepAliveService();

  logToFile('Gelişmiş Keep-Alive servisi başlatılıyor...');

  // 1. Bellek koruma - Periyodik hafıza temizleme 
  try {
    // V8 garbage collector - try/catch block for safety
    setInterval(() => {
      try {
        // Runtime check if GC is available
        if (typeof (global as any).gc === 'function') {
          (global as any).gc();
          logToFile('Çöp toplama (GC) çalıştırıldı');
        }
      } catch (error) {
        // Just ignore errors
      }
    }, 30 * 60 * 1000); // 30 dakikada bir
  } catch (error) {
    logToFile(`GC setup error: ${error}`);
  }

  // 2. Dosya sistemi aktivitesi - Düzenli disk erişimi uygulama aktif tutar
  keepAliveFileInterval = setInterval(() => {
    try {
      const now = new Date();
      const data = {
        lastPing: now.toISOString(),
        status: isHealthy ? 'active' : 'recovering',
        uptime: process.uptime(),
        timestamp: now.getTime(),
        stats: lastStatus,
        memory: process.memoryUsage(),
      };
      
      fs.writeFileSync(KEEPALIVE_FILE, JSON.stringify(data, null, 2));
      
      // Log dosyası büyümesin diye her 100 işlemde bir bilgi logla
      if (lastStatus.pingCount % 100 === 0) {
        logToFile(`Keep-alive dosyası güncellendi - Ping sayısı: ${lastStatus.pingCount}, Başarı oranı: %${lastStatus.uptimePercentage.toFixed(2)}`);
      }
    } catch (error) {
      logToFile(`Keep-alive dosya hatası: ${error}`);
    }
  }, 30 * 1000); // 30 saniyede bir

  // 3. İç ping servisi - Uygulama kendini sürekli kontrol eder
  internalPingInterval = setInterval(async () => {
    try {
      lastStatus.pingCount++;
      lastStatus.lastCheck = new Date();
      
      // Rastgele endpoint seç (cache busting)
      const timestamp = Date.now();
      const response = await fetch(`${REPLIT_URL}/ping?t=${timestamp}`);
      
      if (response.ok) {
        lastStatus.successCount++;
        if (!isHealthy) {
          logToFile(`Uygulama düzeldi - HTTP ${response.status}`);
          isHealthy = true;
        }
      } else {
        lastStatus.failureCount++;
        isHealthy = false;
        logToFile(`Ping başarısız - HTTP ${response.status}`);
        
        // Hemen bir dizi farklı endpoint dene (daha agresif recovery)
        await recoverService();
      }
      
      // Başarı yüzdesini güncelle
      lastStatus.uptimePercentage = (lastStatus.successCount / lastStatus.pingCount) * 100;
      
    } catch (error) {
      lastStatus.failureCount++;
      isHealthy = false;
      logToFile(`Ping hatası: ${error}`);
      
      // Hata durumunda hemen kurtarma prosedürünü başlat
      await recoverService();
      
      // Başarı yüzdesini güncelle
      lastStatus.uptimePercentage = (lastStatus.successCount / lastStatus.pingCount) * 100;
    }
  }, INTERNAL_PING_INTERVAL);

  // 4. Cron job ile harici ping - Düzenli olarak uygulama kendini ping atar
  externaPingCron = new CronJob(EXTERNAL_PING_INTERVAL, async () => {
    try {
      // CRON zamanında ping göndermek için 3 farklı endpoint'i dene
      const endpoints = ['/ping', '/api/health', '/uptime-check'];
      let success = false;
      
      for (const endpoint of endpoints) {
        try {
          const timestamp = Date.now();
          const response = await fetch(`${REPLIT_URL}${endpoint}?t=${timestamp}`);
          
          if (response.ok) {
            logToFile(`Cron ping başarılı: ${endpoint}`);
            success = true;
            break;
          }
        } catch (e) {
          logToFile(`Cron ping başarısız (${endpoint}): ${e}`);
        }
      }
      
      if (!success) {
        logToFile('TÜM CRON PING DENEMELERİ BAŞARISIZ - Kurtarma başlatılıyor');
        await recoverService();
      }
    } catch (error) {
      logToFile(`Cron job hatası: ${error}`);
    }
  });
  
  // Cron job'u başlat
  externaPingCron.start();
  logToFile(`Cron job başlatıldı - Schedule: ${EXTERNAL_PING_INTERVAL}`);

  // 5. Yedek HTTP sunucusu - İkinci bir port üzerinden hizmet vererek uygulamayı aktif tutar
  try {
    backupServer = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'active',
        timestamp: new Date().toISOString(),
        service: 'keepalive-backup',
        stats: lastStatus
      }));
    });
    
    // 8099 portundan yedek servis başlat
    backupServer.listen(8099, '0.0.0.0', () => {
      logToFile('Yedek HTTP sunucusu 8099 portunda başlatıldı');
    });
  } catch (error) {
    logToFile(`Yedek sunucu hatası: ${error}`);
  }

  logToFile(`Gelişmiş Keep-Alive servisi başlatıldı: ${REPLIT_URL}`);
  return true;
}

/**
 * Tüm servisleri durdur
 */
export function stopEnhancedKeepAliveService() {
  // İç ping interval'ını durdur
  if (internalPingInterval) {
    clearInterval(internalPingInterval);
    internalPingInterval = null;
  }
  
  // Dosya yazma interval'ını durdur
  if (keepAliveFileInterval) {
    clearInterval(keepAliveFileInterval);
    keepAliveFileInterval = null;
  }
  
  // Cron job'u durdur
  if (externaPingCron) {
    externaPingCron.stop();
    externaPingCron = null;
  }
  
  // Yedek sunucuyu kapat
  if (backupServer) {
    try {
      backupServer.close();
      backupServer = null;
    } catch (error) {
      console.error('Yedek sunucu kapatma hatası:', error);
    }
  }
  
  log('Gelişmiş Keep-Alive servisi durduruldu', 'keepalive');
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
    '/dashboard'
  ];
  
  log('Kurtarma prosedürü başlatılıyor...', 'keepalive');
  
  // Belleği temizlemeye çalış
  try {
    if (typeof (global as any).gc === 'function') {
      (global as any).gc();
    }
  } catch (e) {
    // GC hatası yoksay
  }
  
  // Her endpoint için 3 deneme yap
  let overallSuccess = false;
  
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const endpoint of endpoints) {
      try {
        // Her denemede biraz bekle
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Cache busting için zaman damgası ekle
        const timestamp = Date.now();
        const response = await fetch(`${REPLIT_URL}${endpoint}?recovery=true&attempt=${attempt}&t=${timestamp}`);
        
        if (response.ok) {
          log(`Kurtarma başarılı - Endpoint: ${endpoint}, Deneme: ${attempt + 1}`, 'keepalive');
          overallSuccess = true;
          return true;
        }
      } catch (error) {
        log(`Kurtarma hatası - Endpoint: ${endpoint}, Deneme: ${attempt + 1}, Hata: ${error}`, 'keepalive');
      }
    }
  }
  
  if (!overallSuccess) {
    log('TÜM KURTARMA DENEMELERİ BAŞARISIZ', 'keepalive');
  }
  
  return overallSuccess;
}