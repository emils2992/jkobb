// Bu script, Discord botunuzu 7/24 aktif tutmak için tasarlanmıştır
// Belirtilen URL'ye düzenli ping atarak botun kapanmasını engeller

const https = require('https');
const http = require('http');
const fs = require('fs');

// Ping atılacak URL
const TARGET_URL = "https://9f27368b-0b17-4ac7-8928-fc20e6cf4a11-00-exkoqowlthzq.sisko.replit.dev:5000/ping";

// Log dosyası
const LOG_FILE = './bot-uptime.log';

// Ping aralığı (5 dakika = 300000 ms)
const PING_INTERVAL = 5 * 60 * 1000;

// Ping sayacı
let pingCount = 0;
let successCount = 0;
let failCount = 0;

// Log fonksiyonu
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  // Log dosyasına yaz
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// URL'ye ping at
function pingUrl() {
  pingCount++;
  const now = new Date();
  
  // Her ping isteğine eşsiz bir parametre ekle (cache sorununu önlemek için)
  const pingUrl = `${TARGET_URL}?t=${now.getTime()}&id=${Math.random().toString(36).substring(2, 10)}`;
  
  log(`Ping #${pingCount} gönderiliyor: ${pingUrl}`);
  
  // URL protokolüne göre http veya https seç
  const client = pingUrl.startsWith('https') ? https : http;
  
  // Ping isteği gönder
  const req = client.get(pingUrl, { rejectUnauthorized: false }, (res) => {
    let data = '';
    
    // Yanıt verisini topla
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    // Yanıt tamamlandığında
    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        successCount++;
        log(`✅ Ping #${pingCount} başarılı! HTTP ${res.statusCode}`);
      } else {
        failCount++;
        log(`❌ Ping #${pingCount} başarısız. HTTP ${res.statusCode}`);
      }
      
      // Durum dosyasını güncelle
      updateStatusFile({
        lastPing: now.toISOString(),
        status: res.statusCode >= 200 && res.statusCode < 400 ? 'success' : 'fail',
        statusCode: res.statusCode
      });
    });
  });
  
  // Hata durumu
  req.on('error', (error) => {
    failCount++;
    log(`❌ Ping #${pingCount} başarısız: ${error.message}`);
    
    // Durum dosyasını güncelle
    updateStatusFile({
      lastPing: now.toISOString(),
      status: 'error',
      error: error.message
    });
  });
  
  // Timeout
  req.setTimeout(30000, () => {
    req.destroy();
    failCount++;
    log(`❌ Ping #${pingCount} zaman aşımına uğradı (30 saniye)`);
    
    // Durum dosyasını güncelle
    updateStatusFile({
      lastPing: now.toISOString(),
      status: 'timeout'
    });
  });
}

// Durum bilgisini güncelle
function updateStatusFile(lastPingInfo) {
  const status = {
    botName: "Discord Halisaha Bot",
    uptime: process.uptime(),
    totalPings: pingCount,
    successPings: successCount,
    failPings: failCount,
    successRate: pingCount > 0 ? (successCount / pingCount * 100).toFixed(2) + '%' : '0%',
    lastPing: lastPingInfo,
    nextPingTime: new Date(Date.now() + PING_INTERVAL).toISOString(),
    targetUrl: TARGET_URL,
    pingInterval: PING_INTERVAL / 1000 / 60 + ' dakika',
    serverTime: new Date().toISOString()
  };
  
  try {
    fs.writeFileSync('./bot-status.json', JSON.stringify(status, null, 2));
  } catch (err) {
    log(`Durum dosyası yazma hatası: ${err.message}`);
  }
}

// Basit HTTP sunucusu
const server = http.createServer((req, res) => {
  // Durum bilgisini hazırla
  const status = {
    botName: "Discord Halisaha Bot",
    status: "online",
    uptime: process.uptime(),
    totalPings: pingCount,
    successPings: successCount,
    pingSuccessRate: pingCount > 0 ? (successCount / pingCount * 100).toFixed(2) + '%' : '0%',
    targetUrl: TARGET_URL,
    pingInterval: PING_INTERVAL / 1000 / 60 + ' dakika',
    serverTime: new Date().toISOString(),
    randomId: Math.random().toString(36).substring(2, 10)
  };
  
  // Cache önleyici header'lar
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Talep URL'sine göre yanıt ver
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
        <title>Discord Bot Uptime</title>
        <meta http-equiv="cache-control" content="no-cache">
        <meta http-equiv="pragma" content="no-cache">
        <meta http-equiv="expires" content="0">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
          h1 { color: #5865F2; }
          .status { padding: 15px; background-color: #f5f5f5; border-radius: 5px; margin: 20px 0; }
          .online { color: green; font-weight: bold; }
          .stat { margin: 10px 0; }
          .timestamp { color: #666; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <h1>Discord Bot Uptime Servisi</h1>
        <div class="status">
          <p>Bot Durumu: <span class="online">ONLINE</span></p>
          <p class="stat">Toplam Ping: ${status.totalPings}</p>
          <p class="stat">Başarılı Ping: ${status.successPings}</p>
          <p class="stat">Başarı Oranı: ${status.pingSuccessRate}</p>
          <p class="stat">Ping Aralığı: ${status.pingInterval}</p>
          <p class="stat">Bot Çalışma Süresi: ${Math.floor(status.uptime / 60)} dakika</p>
          <p class="timestamp">Sunucu Zamanı: ${status.serverTime}</p>
          <p class="timestamp">Random ID: ${status.randomId}</p>
        </div>
        <p>Bu servis Discord botunuzu 7/24 aktif tutmak için tasarlanmıştır.</p>
        <p>Verilen URL'ye düzenli olarak ping atarak botun uyku moduna geçmesini engeller.</p>
      </body>
      </html>
    `);
  }
});

// Ping servisi için küçük bir HTTP sunucusu başlat
const SERVER_PORT = 3500;
server.listen(SERVER_PORT, '0.0.0.0', () => {
  log(`Ping izleme sunucusu başlatıldı: Port ${SERVER_PORT}`);
  log(`İzleme URL: https://discord-halisaha-manager.emilswd.repl.co:${SERVER_PORT}`);
});

// Başlangıç mesajı
log('Discord Bot Uptime Servisi başlatıldı');
log(`Hedef URL: ${TARGET_URL}`);
log(`Ping aralığı: ${PING_INTERVAL / 1000 / 60} dakika`);

// İlk ping'i hemen yap
pingUrl();

// Belirtilen aralıklarla ping atmaya devam et
setInterval(pingUrl, PING_INTERVAL);

// Replit'in kapanmasını engellemek için ek önlem - her dakika disk aktivitesi yap
setInterval(() => {
  const now = new Date().toISOString();
  fs.writeFileSync('./last-alive.txt', now);
  
  // Her 30 dakikada bir log mesajı
  if (new Date().getMinutes() % 30 === 0) {
    log(`Bot hala aktif - ${now}`);
  }
}, 60000);

// İpuçları
log('');
log('⚠️ ÖNEMLİ: Bu terminal penceresini kapatmayın!');
log('');
log('📌 UptimeRobot için şu URL\'i kullanın:');
log(`  https://discord-halisaha-manager.emilswd.repl.co:${SERVER_PORT}`);
log('');
log('💡 UptimeRobot ayarları:');
log('  - Monitor Type: HTTP(s)');
log('  - Interval: 5 minutes');
log('');