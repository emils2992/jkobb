import fetch from 'node-fetch';
import { log } from './vite';

// Replit URL'sini doğrudan environment variable'dan al
const REPLIT_URL = process.env.REPLIT_URL || 
                  (process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : null);

let pingInterval: NodeJS.Timeout | null = null;
let healthCheckInterval: NodeJS.Timeout | null = null;
let isHealthy = true;

/**
 * Uygulamanın uptime'ını korumak için kendi kendine ping atan gelişmiş fonksiyon
 */
export function startUptimeService() {
  // URL yoksa çıkış yap
  if (!REPLIT_URL) {
    log('REPLIT_URL bulunamadı. Uptime servisi başlatılamıyor.', 'uptime');
    return;
  }

  // Zaten çalışan servis varsa durdur ve yeniden başlat (güvenlik için)
  if (pingInterval) {
    stopUptimeService();
  }

  // 30 saniyede bir ping at (daha sık ping ile uptime güvenliği arttırılıyor)
  pingInterval = setInterval(async () => {
    try {
      const response = await fetch(`${REPLIT_URL}/ping`, {
        timeout: 8000, // 8 saniye timeout ile ağ gecikmelerine karşı önlem
        headers: { 'Cache-Control': 'no-cache, no-store' } // Önbellek sorunlarını önlemek için
      });
      
      if (response.ok) {
        if (!isHealthy) {
          log(`Uygulama tekrar sağlıklı duruma geldi: ${new Date().toISOString()}`, 'uptime');
          isHealthy = true;
        } else {
          log(`Uptime ping başarılı: ${new Date().toISOString()}`, 'uptime');
        }
      } else {
        isHealthy = false;
        log(`Uptime ping başarısız (${response.status}): ${new Date().toISOString()}`, 'uptime');
        // Başarısız olduğunda hemen tekrar ping at
        retryPing();
      }
    } catch (error) {
      isHealthy = false;
      log(`Uptime ping hatası: ${error}`, 'uptime');
      // Hata durumunda hemen tekrar ping at
      retryPing();
    }
  }, 30000); // 30 saniye

  // Sağlık durumu kontrol sistemi - daha kapsamlı kontrol
  healthCheckInterval = setInterval(async () => {
    try {
      // Ana endpoint'i kontrol et (web sitesinin sağlık durumu için)
      const homeResponse = await fetch(REPLIT_URL, {
        timeout: 10000,
        headers: { 'Cache-Control': 'no-cache, no-store' }
      });
      
      if (homeResponse.ok) {
        log('Ana sayfa erişilebilir durumda', 'uptime');
      } else {
        log(`Ana sayfa erişim hatası (${homeResponse.status})`, 'uptime');
        // Ana sayfa hata veriyorsa pingi zorlayarak sistemi yeniden başlatmaya yönlendir
        retryPing();
      }

      // Özel uptime kontrol endpoint'ini kontrol et
      const uptimeResponse = await fetch(`${REPLIT_URL}/uptime-check`, {
        timeout: 8000,
        headers: { 'Cache-Control': 'no-cache, no-store' }
      });
      
      if (!uptimeResponse.ok) {
        log(`Uptime kontrol endpoint'i erişim hatası (${uptimeResponse.status})`, 'uptime');
        retryPing();
      }
    } catch (error) {
      log(`Sağlık kontrolü hatası: ${error}`, 'uptime');
      retryPing();
    }
  }, 120000); // 2 dakikada bir kapsamlı kontrol

  log(`Gelişmiş uptime servisi başlatıldı: ${REPLIT_URL}`, 'uptime');
}

/**
 * Tekrar ping atarak sistemi ayakta tutmaya çalış
 */
async function retryPing() {
  // Farklı endpoint'leri deneyerek sistemi ayakta tutmaya çalış
  const endpoints = ['/ping', '/uptime-check', '/api/health', '/'];
  
  for (const endpoint of endpoints) {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Kısa bir bekleme
      const response = await fetch(`${REPLIT_URL}${endpoint}`, {
        timeout: 5000,
        headers: { 'Cache-Control': 'no-cache, no-store' }
      });
      
      if (response.ok) {
        log(`Yeniden pinglenebilir durum: ${endpoint}`, 'uptime');
        break; // Başarılı bir ping elde edildiğinde döngüden çık
      }
    } catch (e) {
      log(`Tekrar ping hatası (${endpoint}): ${e}`, 'uptime');
      // Hatayı yakala ve sonraki endpoint'i dene
    }
  }
}

/**
 * Uptime servisini durdur
 */
export function stopUptimeService() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
  
  log('Uptime servisi durduruldu', 'uptime');
}