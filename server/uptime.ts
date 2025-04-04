import fetch from 'node-fetch';
import { log } from './vite';
import * as fs from 'fs';

// Replit URL'si
const REPLIT_URL = process.env.REPLIT_URL || "https://discord-halisaha-manager.emilswd.repl.co";
const KEEPALIVE_FILE = './keepalive.json';

let pingInterval: NodeJS.Timeout | null = null;
let fileWriteInterval: NodeJS.Timeout | null = null;

/**
 * Basitleştirilmiş uptime servisi
 */
export function startUptimeService() {
  // Zaten çalışan servis varsa durdur
  if (pingInterval || fileWriteInterval) {
    stopUptimeService();
  }

  log('Uptime servisi başlatılıyor...', 'uptime');

  // KeepAlive dosyası yönetimi - 30 saniyede bir
  fileWriteInterval = setInterval(() => {
    try {
      const data = {
        lastPing: new Date().toISOString(),
        status: 'active',
        uptime: process.uptime(),
        timestamp: Date.now()
      };

      fs.writeFileSync(KEEPALIVE_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
      log(`KeepAlive dosyası yazılamadı: ${err}`, 'uptime');
    }
  }, 30000);

  // Kendi kendine ping - 2 dakikada bir
  pingInterval = setInterval(async () => {
    try {
      const response = await fetch(`${REPLIT_URL}/ping?t=${Date.now()}`);

      if (response.ok) {
        log(`Ping başarılı: ${new Date().toISOString()}`, 'uptime');
      } else {
        log(`Ping başarısız (${response.status}): ${new Date().toISOString()}`, 'uptime');
      }
    } catch (error) {
      log(`Ping hatası: ${error}`, 'uptime');
    }
  }, 120000);

  log(`Uptime servisi başlatıldı: ${REPLIT_URL}`, 'uptime');
}

/**
 * Uptime servisini durdur
 */
export function stopUptimeService() {
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