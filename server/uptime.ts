import fetch from 'node-fetch';
import { log } from './vite';

// Replit URL'sini process.env'den al veya varsayılan kullan
const REPLIT_URL = process.env.REPLIT_URL || 'http://localhost:5000';

let pingInterval: NodeJS.Timeout | null = null;
let lastPingTime = 0;
let pingFailures = 0;
const MAX_FAILURES = 3;
const PING_INTERVAL = 2 * 60 * 1000; // 2 dakika (300000 ms -> 5 dakika yerine)
const BACKUP_SERVICES = [
  'https://uptimerobot.com/', 
  'https://cron-job.org/'
];

/**
 * Uygulamanın uptime'ını korumak için geliştirilmiş ping servisi
 * - Daha sık ping kontrolleri
 * - Başarısız pingleri tekrar dener
 * - Rate-limiting'e karşı koruma
 * - Yedekli ping işlemi
 */
export function startUptimeService() {
  // Zaten bir interval varsa çıkış yap
  if (pingInterval) {
    return;
  }

  // Yeterli zaman geçtiyse ping at, rate limiting'e karşı koruma
  const safePing = async () => {
    const now = Date.now();
    // Son pingten bu yana en az 10 saniye geçmişse ping at
    if (now - lastPingTime < 10000) {
      log('Ping sıklığı çok yüksek, rate limiting koruması devrede', 'uptime');
      return;
    }
    
    lastPingTime = now;
    
    try {
      // Asıl ping işlemi, timeout ile
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 saniye timeout
      
      const response = await fetch(`${REPLIT_URL}/ping`, { 
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' } 
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        log(`Uptime ping başarılı: ${new Date().toISOString()}`, 'uptime');
        pingFailures = 0; // Başarılı olduğunda hata sayacını sıfırla
      } else {
        pingFailures++;
        log(`Uptime ping başarısız (${response.status}): ${new Date().toISOString()} - Hata Sayısı: ${pingFailures}`, 'uptime');
        
        // Belirli sayıda başarısız ping olduğunda yedek servisleri kullan
        if (pingFailures >= MAX_FAILURES) {
          retryWithBackup();
        }
      }
    } catch (error) {
      pingFailures++;
      log(`Uptime ping hatası: ${error} - Hata Sayısı: ${pingFailures}`, 'uptime');
      
      // Belirli sayıda hata olduğunda yedek servisleri kullan
      if (pingFailures >= MAX_FAILURES) {
        retryWithBackup();
      }
    }
  };
  
  // Yedek servislerle ping dene
  const retryWithBackup = async () => {
    log('Yedek ping servisleri deneniyor...', 'uptime');
    
    try {
      // Hem ana URL'i ping et, hem de yedek servislere bağlan
      await Promise.all([
        fetch(REPLIT_URL, { 
          method: 'HEAD',
          headers: { 'Cache-Control': 'no-cache' } 
        }).catch(() => null),
        ...BACKUP_SERVICES.map(url => 
          fetch(url, { method: 'HEAD' }).catch(() => null)
        )
      ]);
      
      log('Yedek ping servisleri tamamlandı', 'uptime');
    } catch (error) {
      log(`Yedek ping servisleri hatası: ${error}`, 'uptime');
    }
  };

  // Ping interval'i başlat
  pingInterval = setInterval(safePing, PING_INTERVAL);
  
  // Başlangıçta hemen bir ping at
  safePing();
  
  log(`Geliştirilmiş uptime servisi başlatıldı: ${REPLIT_URL}`, 'uptime');
}

/**
 * Uptime servisini durdur
 */
export function stopUptimeService() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
    log('Uptime servisi durduruldu', 'uptime');
  }
}