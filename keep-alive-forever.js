// Gelişmiş 7/24 Uptime Çözümü
// Bu script, hem Replit projesini hem de Discord botunu sürekli aktif tutar
// Hem yerel ping hem de UptimeRobot için optimize edilmiştir

import https from 'https';
import http from 'http';
import fs from 'fs';
import { exec } from 'child_process';

// ===== AYARLAR =====
// Ana uygulama URL'si (Replit'in atadığı URL)
const APP_URL = "https://discord-halisaha-manager.emilswd.repl.co";

// Ping edilecek endpoint'ler
const PING_ENDPOINTS = [
  "/ping",
  "/api/health",
  "/uptime-check",
  "/always-online.html"
];

// Ping aralığı: 2 dakika
const PING_INTERVAL = 2 * 60 * 1000;

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

// ===== DURUM GÜNCELLEME =====
function updateStatusFile() {
  const uptime = Math.floor((new Date() - startTime) / 1000);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = uptime % 60;
  
  const status = {
    botName: "Discord Halisaha Bot",
    status: lastSuccessTime ? "online" : "checking",
    uptime: `${hours}s ${minutes}dk ${seconds}sn`,
    totalPings,
    successPings,
    failPings,
    successRate: totalPings > 0 ? Math.round(successPings / totalPings * 100) + '%' : '0%',
    lastSuccessTime: lastSuccessTime ? lastSuccessTime.toISOString() : null,
    nextPingTime: new Date(Date.now() + PING_INTERVAL).toISOString(),
    targetUrl: APP_URL,
    pingEndpoints: PING_ENDPOINTS,
    pingInterval: PING_INTERVAL / 1000 / 60 + ' dakika',
    serverTime: new Date().toISOString(),
    randomId: Math.random().toString(36).substring(2, 10)
  };
  
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
  } catch (err) {
    log(`Durum dosyası yazma hatası: ${err.message}`);
  }
  
  return status;
}

// ===== PİNG FONKSİYONU =====
async function pingAllEndpoints() {
  log(`===== Ping döngüsü başlatılıyor (#${totalPings + 1}) =====`);
  
  // Tüm endpoint'leri ping et
  for (const endpoint of PING_ENDPOINTS) {
    await pingEndpoint(endpoint);
  }
  
  // Durum dosyasını güncelle
  updateStatusFile();
  
  log(`===== Ping döngüsü tamamlandı (#${totalPings}) =====\n`);
}

// Bir endpointi ping et
async function pingEndpoint(endpoint) {
  totalPings++;
  const now = new Date();
  
  // Cache busting için rastgele parametreler ekle
  const url = `${APP_URL}${endpoint}?t=${now.getTime()}&id=${Math.random().toString(36).substring(2, 8)}`;
  
  log(`Ping gönderiliyor: ${url}`);
  
  return new Promise((resolve) => {
    // URL protokolüne göre http veya https kullan
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(url, { 
      rejectUnauthorized: false,
      headers: {
        'User-Agent': 'DiscordBot-UptimeService/1.0',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      timeout: 30000
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          successPings++;
          lastSuccessTime = new Date();
          log(`✅ ${endpoint} ping başarılı! Durum kodu: ${res.statusCode}`);
        } else {
          failPings++;
          log(`❌ ${endpoint} ping başarısız! Durum kodu: ${res.statusCode}`);
        }
        resolve();
      });
    });
    
    req.on('error', (err) => {
      failPings++;
      log(`❌ ${endpoint} ping hatası: ${err.message}`);
      resolve();
    });
    
    req.on('timeout', () => {
      req.destroy();
      failPings++;
      log(`❌ ${endpoint} ping zaman aşımı (30 saniye)`);
      resolve();
    });
  });
}

// ===== DURUM SUNUCUSU =====
// Durum bilgisini gösteren basit bir HTTP sunucusu
const server = http.createServer((req, res) => {
  // Cache önleyici header'lar
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Güncel durum bilgisini al
  const status = updateStatusFile();
  
  // İstek yoluna göre yanıt ver
  if (req.url.startsWith('/status.json')) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(status));
  } else {
    // HTML yanıtı
    res.setHeader('Content-Type', 'text/html');
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Discord Bot - Süper Uptime Servis</title>
        <meta charset="UTF-8">
        <meta http-equiv="cache-control" content="no-cache">
        <meta http-equiv="pragma" content="no-cache">
        <meta http-equiv="expires" content="0">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 20px; 
            max-width: 800px; 
            margin: 0 auto; 
            line-height: 1.6;
            background-color: #f9f9f9;
          }
          h1 { color: #5865F2; }
          .status { 
            padding: 20px; 
            background-color: white; 
            border-radius: 10px; 
            margin: 20px 0; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .online { color: #2ecc71; font-weight: bold; }
          .checking { color: #f39c12; font-weight: bold; }
          .offline { color: #e74c3c; font-weight: bold; }
          .stat { margin: 10px 0; }
          .timestamp { color: #666; font-size: 0.9em; }
          .footer { margin-top: 40px; font-size: 0.9em; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <h1>Discord Bot Uptime Merkezi</h1>
        <div class="status">
          <p>Bot Durumu: <span class="${status.status === 'online' ? 'online' : 'checking'}">${status.status === 'online' ? 'ONLINE' : 'KONTROL EDİLİYOR'}</span></p>
          <p class="stat">Çalışma Süresi: ${status.uptime}</p>
          <p class="stat">Toplam Ping: ${status.totalPings}</p>
          <p class="stat">Başarılı Ping: ${status.successPings}</p>
          <p class="stat">Başarısız Ping: ${status.failPings}</p>
          <p class="stat">Başarı Oranı: ${status.successRate}</p>
          <p class="stat">Ping Aralığı: ${status.pingInterval}</p>
          <p class="timestamp">Son Başarılı Bağlantı: ${status.lastSuccessTime || 'Henüz yok'}</p>
          <p class="timestamp">Sunucu Zamanı: ${status.serverTime}</p>
          <p class="timestamp">Sonraki Ping: ${status.nextPingTime}</p>
          <p class="timestamp">Oturum ID: ${status.randomId}</p>
        </div>
        <p>Bu servis Discord botunuzu <strong>7/24</strong> aktif tutmak için özel olarak tasarlanmıştır.</p>
        <p>Birden fazla URL'ye düzenli olarak ping atarak botun uyku moduna geçmesini engeller.</p>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Discord Halisaha Bot Uptime Servisi</p>
        </div>
      </body>
      </html>
    `);
  }
});

// ===== ANA PROGRAM =====
// Başlangıç
log('===== SÜPER UPTİME SERVİSİ BAŞLATILDI =====');
log(`URL: ${APP_URL}`);
log(`Ping endpoint'leri: ${PING_ENDPOINTS.join(', ')}`);
log(`Ping aralığı: ${PING_INTERVAL / 1000 / 60} dakika`);

// Durum sunucusunu başlat
server.listen(SERVER_PORT, '0.0.0.0', () => {
  log(`Durum sunucusu başlatıldı: Port ${SERVER_PORT}`);
  log(`İzleme URL: ${APP_URL.replace(/\/$/, '')}:${SERVER_PORT}`);
  log(`UptimeRobot için: ${APP_URL.replace(/\/$/, '')}:${SERVER_PORT}`);
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
  
  // Bir süre bekleyip yeniden başlat
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
log(`  3. ${APP_URL}/always-online.html`);
log(`  4. ${APP_URL}:${SERVER_PORT}`);
log('');
log('💡 UptimeRobot Ayarları:');
log('  - Monitor Type: HTTP(s)');
log('  - Interval: 5 dakika');
log('  - En az 2 farklı URL ekleyin');
log('');