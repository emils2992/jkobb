import fetch from 'node-fetch';
import { log } from './vite';
import { createServer } from 'http';
import * as fs from 'fs';

// Replit URL'si - çevre değişkeninden al ya da hardcoded değeri kullan
const REPLIT_URL = process.env.REPLIT_URL || "https://edd4ab32-9e68-45ea-9c30-ea0f7fd51d1d-00-xrddyi4151w7.pike.replit.dev";

let pingInterval: NodeJS.Timeout | null = null;
let healthCheckInterval: NodeJS.Timeout | null = null;
let keepAliveInterval: NodeJS.Timeout | null = null;
let fileWriteInterval: NodeJS.Timeout | null = null;
let isHealthy = true;
const keepAliveFile = './keepalive.json';

/**
 * Uygulamanın uptime'ını korumak için kendi kendine ping atan gelişmiş fonksiyon
 */
export function startUptimeService() {
  // Zaten çalışan servis varsa durdur ve yeniden başlat
  if (pingInterval) {
    stopUptimeService();
  }

  // KeepAlive dosya sistemi - sistem üzerinde periyodik aktivite sağlayarak uptime'ı korur
  // Bu sistem, tarayıcı kapansa bile uygulamayı aktif tutar
  fileWriteInterval = setInterval(() => {
    try {
      const timestamp = new Date().toISOString();
      const data = {
        lastPing: timestamp,
        status: 'active',
        uptime: process.uptime(),
        timestamp: Date.now()
      };
      
      // Dosyaya yaz - bu aktivite, Node.js uygulamasını uyanık tutar
      fs.writeFileSync(keepAliveFile, JSON.stringify(data, null, 2));
      
      // 20 saniyede bir konsola log at
      if (Math.floor(Date.now() / 1000) % 20 === 0) {
        log(`KeepAlive dosyası güncellendi: ${timestamp}`, 'uptime');
      }
    } catch (err) {
      log(`KeepAlive dosyası yazılamadı: ${err}`, 'uptime');
    }
  }, 5000); // 5 saniyede bir dosyaya yaz (sık disk aktivitesi sunucuyu uyanık tutar)

  // 30 saniyede bir ping at (daha sık ping ile uptime güvenliği arttırılıyor)
  pingInterval = setInterval(async () => {
    try {
      const response = await fetch(`${REPLIT_URL}/ping`);
      
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
      const homeResponse = await fetch(REPLIT_URL);
      
      if (homeResponse.ok) {
        log('Ana sayfa erişilebilir durumda', 'uptime');
        
        // Düzenli aralıklarla keepalive dosyasını oku, bu da uygulamayı uyanık tutar
        try {
          if (fs.existsSync(keepAliveFile)) {
            const keepAliveData = fs.readFileSync(keepAliveFile, 'utf8');
            const data = JSON.parse(keepAliveData);
            const lastPingTime = new Date(data.lastPing);
            const now = new Date();
            const diffMinutes = (now.getTime() - lastPingTime.getTime()) / (1000 * 60);
            
            // Son ping üzerinden 5 dakikadan fazla geçtiyse uyarı logla
            if (diffMinutes > 5) {
              log(`UYARI: Son keepalive aktivitesi ${diffMinutes.toFixed(1)} dakika önce`, 'uptime');
              // Dosyayı güncelle
              fs.writeFileSync(keepAliveFile, JSON.stringify({
                lastPing: now.toISOString(),
                status: 'recovered',
                uptime: process.uptime(),
                timestamp: Date.now()
              }, null, 2));
            }
          }
        } catch (fileErr) {
          log(`Keepalive dosyası okuma hatası: ${fileErr}`, 'uptime');
        }
      } else {
        log(`Ana sayfa erişim hatası (${homeResponse.status})`, 'uptime');
        // Ana sayfa hata veriyorsa ping atmayı tekrar dene
        retryPing();
      }

      // Özel uptime kontrol endpoint'ini kontrol et
      const uptimeResponse = await fetch(`${REPLIT_URL}/uptime-check`);
      
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
      const response = await fetch(`${REPLIT_URL}${endpoint}`);
      
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
  
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
  
  if (fileWriteInterval) {
    clearInterval(fileWriteInterval);
    fileWriteInterval = null;
  }
  
  log('Uptime servisi durduruldu', 'uptime');
}