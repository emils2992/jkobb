import fetch from 'node-fetch';
import { log } from './vite';
import * as fs from 'fs';

// Replit URL'si - çevre değişkeninden al ya da sağlanan hardcoded değeri kullan
const REPLIT_URL = process.env.REPLIT_URL || "https://edd4ab32-9e68-45ea-9c30-ea0f7fd51d1d-00-xrddyi4151w7.pike.replit.dev";
const KEEPALIVE_FILE = './keepalive.json';

let pingInterval: NodeJS.Timeout | null = null;
let fileWriteInterval: NodeJS.Timeout | null = null;

/**
 * Basitleştirilmiş uptime servisi - yalnızca dosya yazma ve ping atma özellikleriyle
 */
export function startSimpleUptimeService() {
  // Zaten çalışıyorsa durdur
  if (pingInterval || fileWriteInterval) {
    stopSimpleUptimeService();
  }

  log('Basit uptime servisi başlatılıyor...', 'uptime');
  
  // 30 saniyede bir dosyaya yazarak disk aktivitesi sağla
  fileWriteInterval = setInterval(() => {
    try {
      const timestamp = new Date().toISOString();
      const data = {
        lastPing: timestamp,
        uptime: process.uptime(),
        timestamp: Date.now()
      };
      
      fs.writeFileSync(KEEPALIVE_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Dosya yazma hatası:', error);
    }
  }, 30000); // 30 saniyede bir
  
  // 10 dakikada bir kendi kendine ping at
  pingInterval = setInterval(async () => {
    try {
      const timestamp = Date.now();
      const response = await fetch(`${REPLIT_URL}/ping?t=${timestamp}`);
      
      if (response.ok) {
        log(`Başarılı ping: ${new Date().toISOString()}`, 'uptime');
      } else {
        log(`Ping hatası (${response.status}): ${new Date().toISOString()}`, 'uptime');
      }
    } catch (error) {
      log(`Ping hatası: ${error}`, 'uptime');
    }
  }, 600000); // 10 dakikada bir
  
  log('Basit uptime servisi başlatıldı', 'uptime');
}

/**
 * Uptime servisini durdur
 */
export function stopSimpleUptimeService() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  
  if (fileWriteInterval) {
    clearInterval(fileWriteInterval);
    fileWriteInterval = null;
  }
  
  log('Uptime servisi durduruldu', 'uptime');
}