import fetch from 'node-fetch';
import { log } from './vite';

// Replit URL'si (otomatik olarak çalışma zamanında oluşur)
const REPLIT_URL = process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : null;

let pingInterval: NodeJS.Timeout | null = null;

/**
 * Uygulamanın uptime'ını korumak için kendi kendine ping atan fonksiyon
 */
export function startUptimeService() {
  // URL yoksa veya zaten bir interval varsa çıkış yap
  if (!REPLIT_URL || pingInterval) {
    return;
  }

  // 1 dakikada bir ping at (60000 ms) - daha sık aralıklarla
  pingInterval = setInterval(async () => {
    try {
      const response = await fetch(`${REPLIT_URL}/ping`);
      if (response.ok) {
        log(`Uptime ping başarılı: ${new Date().toISOString()}`, 'uptime');
      } else {
        log(`Uptime ping başarısız (${response.status}): ${new Date().toISOString()}`, 'uptime');
        // Başarısız olduğunda tekrar ping at
        setTimeout(async () => {
          try {
            await fetch(`${REPLIT_URL}/ping`);
          } catch (e) {
            log(`Uptime tekrar ping hatası: ${e}`, 'uptime');
          }
        }, 10000); // 10 saniye sonra tekrar dene
      }
    } catch (error) {
      log(`Uptime ping hatası: ${error}`, 'uptime');
      // Hata durumunda tekrar ping at
      setTimeout(async () => {
        try {
          await fetch(`${REPLIT_URL}/ping`);
        } catch (e) {
          log(`Uptime tekrar ping hatası: ${e}`, 'uptime');
        }
      }, 10000); // 10 saniye sonra tekrar dene
    }
  }, 60000); // 1 dakika

  log(`Uptime servisi başlatıldı: ${REPLIT_URL}`, 'uptime');
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