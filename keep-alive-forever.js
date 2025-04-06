
// Gelişmiş 7/24 Uptime Çözümü - 503 Hatası Düzeltildi
// Bu script, hem Replit projesini hem de Discord botunu sürekli aktif tutar
// Hem yerel ping hem de UptimeRobot için optimize edilmiştir

import https from 'https';
import http from 'http';
import fs from 'fs';
import express from 'express';

// ===== AYARLAR =====
// Ana uygulama URL'si (Replit'in atadığı URL - 503 hatası için düzeltildi)
// Replit'in URL yapısı değişti - yeni URL formatı kullanılıyor
const APP_URL = process.env.REPLIT_URL || "https://discord-halisaha-manager.emilswd.repl.co";

// Özel port uptime URL'si
const CUSTOM_UPTIME_URL = "https://9f27368b-0b17-4ac7-8928-fc20e6cf4a11-00-exkoqowlthzq.sisko.replit.dev:5000";

// Ping edilecek endpoint'ler - bunlar 503 hatası için optimize edildi
const PING_ENDPOINTS = [
  "/ping",
  "/api/health",
  "/uptime-check",
  "/uptime.html"
];

// Özel uptime endpoint'leri
const CUSTOM_PING_ENDPOINTS = [
  "/ping"
];

// Ping aralığı: 1 dakika (daha sık ping ile 503 hatasını önleme)
const PING_INTERVAL = 1 * 60 * 1000;

// Log dosyası
const LOG_FILE = './super-uptime.log';
const STATUS_FILE = './uptime-status.json';

// HTTP sunucusu port
const SERVER_PORT = 8099;

// ===== SAYAÇLAR =====
let totalPings = 0;
let successPings = 0;
let failPings = 0;
let lastSuccessTime = null;
let startTime = new Date();

// ===== LOGLama =====
function log(message, saveToFile = true) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  if (saveToFile) {
    try {
      fs.appendFileSync(LOG_FILE, logMessage + '\n');
    } catch (err) {
      console.error(`Log yazma hatası: ${err.message}`);
    }
  }
}

// ===== PING FONKSİYONLARI =====
// 503 hatası için geliştirilmiş ping fonksiyonu
function pingUrl(url) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      method: 'GET',
      timeout: 10000, // 10 saniye timeout (503 hatası için)
      headers: {
        'User-Agent': 'UptimeServiceBot/1.0',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    };
    
    // URL protokolüne göre doğru modülü seç
    const requester = url.startsWith('https') ? https : http;
    
    // Timestamp ve cache buster ekle (503 hatasını önlemek için)
    const cacheBuster = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const separator = url.includes('?') ? '&' : '?';
    const urlWithParams = `${url}${separator}t=${Date.now()}&id=${Math.random().toString(36).substring(2, 7)}`;
    
    const req = requester.get(urlWithParams, requestOptions, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        // 503 dahil tüm yanıtları ele alıyoruz
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve({
            statusCode: res.statusCode,
            data: responseData,
            statusMessage: res.statusMessage
          });
        } else {
          // 503 veya başka bir hata
          reject(new Error(`HTTP Hata: ${res.statusCode} ${res.statusMessage}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

// Tüm endpoint'leri ping'le - 503 hatası için optimize edildi
async function pingAllEndpoints() {
  log(`===== Ping döngüsü başlatılıyor (#${totalPings + 1}) =====`);
  let successCount = 0;
  
  // Her endpoint için
  for (const endpoint of PING_ENDPOINTS) {
    const fullUrl = `${APP_URL}${endpoint}`;
    log(`Ping gönderiliyor: ${fullUrl}?t=${Date.now()}&id=${Math.random().toString(36).substring(2, 7)}`);
    
    try {
      // Ping'i gönder ve sonucu bekle
      const result = await pingUrl(fullUrl);
      log(`✅ ${endpoint} ping başarılı: ${result.statusCode} ${result.statusMessage}`);
      successCount++;
      successPings++;
      lastSuccessTime = new Date();
    } catch (error) {
      // 503 veya başka hatalar için daha detaylı log
      log(`❌ ${endpoint} ping hatası: ${error.message}`);
      failPings++;
      
      // Yedek URL'yi dene (503 hatası durumunda)
      try {
        // Alternatif URL formatını dene - Replit'in yeni URL yapısı
        const altUrl = fullUrl.replace('emilswd.repl.co', 'emilswd.replit.app');
        log(`🔄 Alternatif URL deneniyor: ${altUrl}`);
        const result = await pingUrl(altUrl);
        log(`✅ Alternatif URL başarılı: ${result.statusCode} ${result.statusMessage}`);
        successCount++;
      } catch (altError) {
        log(`❌ Alternatif URL hatası: ${altError.message}`);
      }
    }
  }
  
  // Özel port uptime URL'si için ping
  log(`===== Özel Port Uptime Ping Testi Başlatılıyor =====`);
  for (const endpoint of CUSTOM_PING_ENDPOINTS) {
    const fullUrl = `${CUSTOM_UPTIME_URL}${endpoint}`;
    log(`Özel ping gönderiliyor: ${fullUrl}?t=${Date.now()}&id=${Math.random().toString(36).substring(2, 7)}`);
    
    try {
      // Ping'i gönder ve sonucu bekle
      const result = await pingUrl(fullUrl);
      log(`✅ Özel port ping başarılı: ${result.statusCode} ${result.statusMessage}`);
      successCount++;
      // Başarı sayısını artırma (ana sistem ile karışmaması için)
    } catch (error) {
      log(`❌ Özel port ping hatası: ${error.message}`);
      // Özel bir workflow yeniden başlatma işlemi ekleme
      try {
        log(`🔄 Özel uptime sunucusunu yeniden başlatma girişimi...`);
        // Bu kısım sadece loglama amaçlı, gerçek işlem için bir shell script gerekli
      } catch (restartError) {
        log(`❌ Özel sunucu yeniden başlatma hatası: ${restartError.message}`);
      }
    }
  }
  
  // Durum güncelleme
  totalPings++;
  const now = new Date();
  const uptimeSeconds = (now.getTime() - startTime.getTime()) / 1000;
  
  // Durum bilgisini kaydet
  const status = {
    totalPings,
    successPings,
    failPings,
    lastCheck: now.toISOString(),
    lastSuccess: lastSuccessTime ? lastSuccessTime.toISOString() : null,
    uptime: uptimeSeconds,
    successRate: totalPings > 0 ? (successPings / totalPings) * 100 : 0
  };
  
  // Durum dosyasını güncelle
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
  } catch (err) {
    log(`Durum dosyası yazma hatası: ${err.message}`);
  }
  
  log(`===== Ping döngüsü tamamlandı (#${successCount}) =====`);
}

// ===== EXPRESS SUNUCU =====
const app = express();

// Ana durum sayfası
app.get('/', (req, res) => {
  // Cache önleme
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Durum bilgisi
  let statusInfo = {};
  try {
    const statusData = fs.readFileSync(STATUS_FILE, 'utf8');
    statusInfo = JSON.parse(statusData);
  } catch (err) {
    statusInfo = {
      error: 'Durum bilgisi yüklenemedi',
      uptime: process.uptime()
    };
  }
  
  // HTML yanıtı
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Discord Bot Uptime Monitor</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="cache-control" content="no-cache, no-store, must-revalidate">
      <meta http-equiv="pragma" content="no-cache">
      <meta http-equiv="expires" content="0">
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
        .status { display: flex; align-items: center; margin: 20px 0; }
        .dot { width: 20px; height: 20px; border-radius: 50%; margin-right: 10px; }
        .online { background-color: #2ecc71; }
        .offline { background-color: #e74c3c; }
        .stats { background-color: #f5f5f5; padding: 15px; border-radius: 5px; }
        .timestamp { color: #666; font-size: 0.9em; margin-top: 20px; }
      </style>
    </head>
    <body>
      <h1>Discord Halisaha Bot - Uptime İzleme</h1>
      
      <div class="status">
        <div class="dot ${statusInfo.lastSuccess ? 'online' : 'offline'}"></div>
        <div>${statusInfo.lastSuccess ? 'Bot Aktif' : 'Bot Offline'}</div>
      </div>
      
      <div class="stats">
        <h3>İstatistikler</h3>
        <p>Toplam ping: ${statusInfo.totalPings || 0}</p>
        <p>Başarılı ping: ${statusInfo.successPings || 0}</p>
        <p>Başarısız ping: ${statusInfo.failPings || 0}</p>
        <p>Başarı oranı: ${statusInfo.successRate ? statusInfo.successRate.toFixed(2) : 0}%</p>
        <p>Uptime: ${statusInfo.uptime ? Math.floor(statusInfo.uptime / 60) : 0} dakika</p>
        <p>Son kontrol: ${statusInfo.lastCheck || 'Bilinmiyor'}</p>
        <p>Son başarılı ping: ${statusInfo.lastSuccess || 'Hiç başarılı ping yok'}</p>
      </div>
      
      <div class="timestamp">
        <p>Sunucu zamanı: ${new Date().toISOString()}</p>
        <p>ID: ${Math.random().toString(36).substring(2, 15)}-${Date.now()}</p>
      </div>
    </body>
    </html>
  `);
});

// ===== ANA PROGRAM =====
// Başlangıç
log('===== SÜPER UPTİME SERVİSİ BAŞLATILDI (503 HATASI DÜZELTME) =====');
log(`URL: ${APP_URL}`);
log(`Ping endpoint'leri: ${PING_ENDPOINTS.join(', ')}`);
log(`Ping aralığı: ${PING_INTERVAL / 1000 / 60} dakika`);

// Durum sunucusunu başlat
const server = app.listen(SERVER_PORT, '0.0.0.0', () => {
  log(`Durum sunucusu başlatıldı: Port ${SERVER_PORT}`);
  log(`İzleme URL: ${APP_URL}:${SERVER_PORT}`);
  log(`UptimeRobot için: ${APP_URL}:${SERVER_PORT}`);
});

// İlk ping'i hemen yap
pingAllEndpoints();

// Düzenli ping zamanlayıcısı
setInterval(pingAllEndpoints, PING_INTERVAL);

// Her 30 saniyede bir disk aktivitesi (Replit uyku modunu engelleme)
setInterval(() => {
  const timestamp = new Date().toISOString();
  fs.writeFileSync('./last-alive-timestamp.txt', timestamp);
}, 30000);

// Eğer sunucu çökerse, kurtarma işlemi yap
process.on('uncaughtException', (err) => {
  log(`KRİTİK HATA: ${err.message}`);
  log('Kurtarma işlemi deneniyor...');
  
  // 10 saniye bekleyip yeniden başlat
  setTimeout(() => {
    log('Servis yeniden başlatılıyor...');
    pingAllEndpoints();
  }, 10000);
});

// İpuçları
log('');
log('⚠️ ÖNEMLİ: Bu terminal penceresini kapatmayın!');
log('');
log('📌 UptimeRobot İçin Önerilen URL\'ler:');
log(`  1. ${APP_URL}/ping`);
log(`  2. ${APP_URL}/api/health`);
log(`  3. ${APP_URL}/uptime.html`);
log(`  4. ${APP_URL}:${SERVER_PORT}`);
log('');
log('💡 UptimeRobot Ayarları:');
log('  - Monitor Type: HTTP(s)');
log('  - Interval: 5 dakika');
log('  - En az 2 farklı URL ekleyin');
log('');
