
// MAX Uptime Service - 9+ Saat Garantili Discord Bot Uptime Çözümü
const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 5000;
const LOG_FILE = './max-uptime.log';

// ===== AYARLAR =====
const REPLIT_URL = process.env.REPLIT_URL || "https://discord-halisaha-manager.emilswd.repl.co";
const PING_INTERVAL = 180000; // 3 dakika
const QUICK_PING_INTERVAL = 45000; // 45 saniye
const DISK_ACTIVITY_INTERVAL = 20000; // 20 saniye
const ENDPOINTS = [
  "/ping", 
  "/always-online.html", 
  "/uptime.html", 
  "/uptime-check",
  "/api/health"
];

// ===== İSTATİSTİKLER =====
let stats = {
  startTime: new Date(),
  totalPings: 0,
  successPings: 0,
  failPings: 0,
  lastPing: null,
  lastSuccess: null,
  uptimeSeconds: 0
};

// ===== LOGLAMA =====
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  try {
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
    
    // Log dosyası çok büyükse, eski logları temizle
    const stats = fs.statSync(LOG_FILE);
    if (stats.size > 10 * 1024 * 1024) { // 10MB üzerindeyse
      const oldLogs = fs.readFileSync(LOG_FILE, 'utf8');
      const newLogs = oldLogs.split('\n').slice(-1000).join('\n'); // Son 1000 satırı tut
      fs.writeFileSync(LOG_FILE, newLogs);
    }
  } catch (error) {
    console.error(`Log dosyası hatası: ${error.message}`);
  }
}

// ===== PİNG FONKSİYONLARI =====
function pingUrl(url) {
  return new Promise((resolve, reject) => {
    // Cache busting için zaman damgası ve rastgele ID ekle
    const cacheBuster = `t=${Date.now()}&id=${Math.random().toString(36).substring(2, 10)}`;
    const pingUrl = url.includes('?') ? `${url}&${cacheBuster}` : `${url}?${cacheBuster}`;
    
    const requester = pingUrl.startsWith('https') ? https : http;
    
    const req = requester.get(pingUrl, {
      timeout: 15000, // 15 saniye timeout
      headers: {
        'User-Agent': 'MAX-UptimeService/1.0',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          success: res.statusCode >= 200 && res.statusCode < 400,
          data: data
        });
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

// Ana ping fonksiyonu - Tüm endpointleri kontrol eder
async function pingAllEndpoints() {
  log(`===== Ping Döngüsü Başlatıldı #${stats.totalPings + 1} =====`);
  stats.totalPings++;
  stats.lastPing = new Date();
  let successCount = 0;
  
  // Endpoint'leri rastgele sırayla dene (daha iyi dağılım için)
  const shuffledEndpoints = [...ENDPOINTS].sort(() => Math.random() - 0.5);
  
  for (const endpoint of shuffledEndpoints) {
    const fullUrl = `${REPLIT_URL}${endpoint}`;
    
    try {
      const result = await pingUrl(fullUrl);
      
      if (result.success) {
        log(`✅ ${endpoint} başarılı (${result.statusCode})`);
        successCount++;
        stats.successPings++;
        stats.lastSuccess = new Date();
      } else {
        log(`❌ ${endpoint} başarısız (${result.statusCode})`);
        stats.failPings++;
        
        // Başarısız ping durumunda hemen alternatif URL'yi dene
        try {
          const altUrl = `${REPLIT_URL}${endpoint === '/ping' ? '/uptime-check' : '/ping'}`;
          log(`🔄 Alternatif deneniyor: ${altUrl}`);
          const altResult = await pingUrl(altUrl);
          
          if (altResult.success) {
            log(`✅ Alternatif başarılı (${altResult.statusCode})`);
            successCount++;
          }
        } catch (altError) {
          log(`❌ Alternatif başarısız: ${altError.message}`);
        }
      }
    } catch (error) {
      log(`❌ ${endpoint} hata: ${error.message}`);
      stats.failPings++;
      
      // Ping hatası durumunda 3 saniye bekleyip tekrar dene
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      try {
        log(`🔄 Tekrar deneniyor: ${fullUrl}`);
        const retryResult = await pingUrl(fullUrl);
        
        if (retryResult.success) {
          log(`✅ Tekrar deneme başarılı (${retryResult.statusCode})`);
          successCount++;
          stats.successPings++;
          stats.lastSuccess = new Date();
        }
      } catch (retryError) {
        log(`❌ Tekrar deneme başarısız: ${retryError.message}`);
      }
    }
    
    // Endpoint'ler arasında kısa bir bekleme ekle (rate limiting önlemi)
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Uptime istatistiklerini güncelle
  stats.uptimeSeconds = (new Date().getTime() - stats.startTime.getTime()) / 1000;
  
  // Başarı oranını güncelle
  updateStatusFile(successCount > 0);
  
  log(`===== Ping Döngüsü Tamamlandı (${successCount}/${ENDPOINTS.length}) =====`);
  return successCount > 0;
}

// Hızlı ping fonksiyonu - Sadece bir endpoint'i kontrol eder
async function quickPing() {
  // Rastgele bir endpoint seç
  const randomIndex = Math.floor(Math.random() * ENDPOINTS.length);
  const endpoint = ENDPOINTS[randomIndex];
  const fullUrl = `${REPLIT_URL}${endpoint}`;
  
  try {
    const result = await pingUrl(fullUrl);
    
    if (result.success) {
      // Sadece başarı durumunda güncelle, sessizce devam et
      stats.successPings++;
      stats.lastSuccess = new Date();
      updateStatusFile(true);
    } else {
      log(`⚠️ Hızlı ping başarısız: ${endpoint} (${result.statusCode})`);
      stats.failPings++;
      
      // Başarısız olursa tam ping döngüsü başlat
      pingAllEndpoints();
    }
  } catch (error) {
    log(`⚠️ Hızlı ping hatası: ${endpoint} (${error.message})`);
    stats.failPings++;
    
    // Hata durumunda tam ping döngüsü başlat
    pingAllEndpoints();
  }
}

// Durum dosyasını güncelle
function updateStatusFile(isOnline) {
  const now = new Date();
  const uptimeMinutes = stats.uptimeSeconds / 60;
  const successRate = stats.totalPings > 0 ? (stats.successPings / stats.totalPings * 100).toFixed(2) : "0.00";
  
  const statusData = {
    botName: "Discord Halisaha Bot",
    status: isOnline ? "ONLINE" : "OFFLINE",
    uptimeMinutes: Math.floor(uptimeMinutes),
    uptimeHours: Math.floor(uptimeMinutes / 60),
    successRate: `${successRate}%`,
    totalPings: stats.totalPings,
    successPings: stats.successPings,
    failPings: stats.failPings,
    lastCheck: stats.lastPing ? stats.lastPing.toISOString() : null,
    lastSuccess: stats.lastSuccess ? stats.lastSuccess.toISOString() : null,
    nextCheckIn: "3 dakika",
    serverTime: now.toISOString(),
    memoryUsage: process.memoryUsage(),
    randomId: Math.random().toString(36).substring(2, 15)
  };
  
  try {
    fs.writeFileSync('./uptime-status.json', JSON.stringify(statusData, null, 2));
  } catch (error) {
    log(`Durum dosyası yazma hatası: ${error.message}`);
  }
}

// Disk aktivitesi oluştur - Replit'in uyku moduna girmesini engeller
function createDiskActivity() {
  try {
    const timestamp = new Date().toISOString();
    const randomId = Math.random().toString(36).substring(2, 15);
    
    // Zaman damgası dosyası
    fs.writeFileSync('./last-heartbeat.txt', `${timestamp} - ${randomId}`);
    
    // Döngüsel dosya yaratma/silme (daha fazla disk aktivitesi)
    const tempFile = `./temp-${randomId}.tmp`;
    fs.writeFileSync(tempFile, `Disk activity - ${timestamp}`);
    
    // 5 saniye sonra dosyayı sil
    setTimeout(() => {
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch (e) {
        // Hata yoksay
      }
    }, 5000);
  } catch (error) {
    // Disk hatalarını sessizce yoksay
  }
}

// Gelişmiş bellek optimizasyonu
function optimizeMemory() {
  try {
    // V8 GC fonksiyonu varsa çağır
    if (typeof global.gc === 'function') {
      global.gc();
    }
  } catch (e) {
    // GC hatası yoksay
  }
}

// ===== EXPRESS SUNUCUSU =====
// Ana sayfa
app.get('/', (req, res) => {
  res.redirect('/ping');
});

// Ping endpoint
app.get('/ping', (req, res) => {
  // Cache önleyici başlıklar
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  const randomId = Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now();
  const uptime = Math.floor(stats.uptimeSeconds / 60); // Dakika cinsinden
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>MAX Uptime Service</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="cache-control" content="no-cache, no-store, must-revalidate">
      <meta http-equiv="pragma" content="no-cache">
      <meta http-equiv="expires" content="0">
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 30px; background-color: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .status { display: flex; align-items: center; justify-content: center; margin: 20px 0; }
        .dot { 
          width: 25px; 
          height: 25px; 
          background-color: #2ecc71; 
          border-radius: 50%; 
          margin-right: 10px;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(46, 204, 113, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(46, 204, 113, 0); }
          100% { box-shadow: 0 0 0 0 rgba(46, 204, 113, 0); }
        }
        .info { text-align: left; background: #f9f9f9; padding: 15px; border-radius: 5px; margin-top: 20px; }
        .refresh-info { margin-top: 30px; color: #666; font-size: 0.9em; }
      </style>
      <script>
        // Sayfa her 4 dakikada bir yenilenir
        setTimeout(() => {
          window.location.reload();
        }, 4 * 60 * 1000);
        
        // Her 30 saniyede bir sunucuya ping gönderir
        setInterval(() => {
          fetch('/auto-ping?t=' + Date.now() + '&id=' + Math.random().toString(36).substring(2, 10));
        }, 30 * 1000);
      </script>
    </head>
    <body>
      <div class="container">
        <h1>MAX Uptime Service</h1>
        
        <div class="status">
          <div class="dot"></div>
          <div><strong>BOT ONLINE ✓</strong></div>
        </div>
        
        <p>Discord Halisaha Bot aktif ve çalışıyor</p>
        
        <div class="info">
          <p><strong>9+ Saat Garantili Uptime</strong></p>
          <p><strong>Sunucu Zamanı:</strong> ${new Date().toISOString()}</p>
          <p><strong>Uptime:</strong> ${Math.floor(uptime / 60)} saat ${uptime % 60} dakika</p>
          <p><strong>Rastgele ID:</strong> ${randomId}</p>
          <p><strong>Ping Sayısı:</strong> ${stats.successPings}/${stats.totalPings}</p>
          <p><strong>Başarı Oranı:</strong> ${stats.totalPings > 0 ? (stats.successPings / stats.totalPings * 100).toFixed(2) : "0.00"}%</p>
        </div>
        
        <div class="refresh-info">
          <p>Bu sayfa otomatik olarak 4 dakikada bir yenilenir</p>
          <p>Ayrıca her 30 saniyede bir ping gönderilir</p>
          <p><span id="countdown">04:00</span> içinde yenilenecek</p>
        </div>
      </div>
      
      <script>
        // Geri sayım
        let totalSeconds = 4 * 60;
        const countdownElem = document.getElementById('countdown');
        
        function updateCountdown() {
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;
          countdownElem.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          totalSeconds--;
          
          if (totalSeconds >= 0) {
            setTimeout(updateCountdown, 1000);
          }
        }
        
        updateCountdown();
      </script>
    </body>
    </html>
  `);
});

// Auto ping endpoint
app.get('/auto-ping', (req, res) => {
  res.status(200).json({
    status: 'online',
    timestamp: Date.now(),
    id: req.query.id || Math.random().toString(36).substring(2, 10)
  });
});

// Durum sayfası
app.get('/status', (req, res) => {
  try {
    const statusData = fs.readFileSync('./uptime-status.json', 'utf8');
    const status = JSON.parse(statusData);
    res.status(200).json(status);
  } catch (error) {
    res.status(200).json({
      status: 'initializing',
      error: error.message,
      uptime: process.uptime()
    });
  }
});

// HTTP sunucusunu başlat
const server = http.createServer(app);

// ===== ANA PROGRAM =====
log('🚀 MAX Uptime Service başlatılıyor (9+ Saat Garantili)');
log(`URL: ${REPLIT_URL}`);

// Sunucuyu dinlemeye başla
server.listen(PORT, '0.0.0.0', () => {
  log(`✅ MAX Uptime Service port ${PORT} üzerinde çalışıyor`);
  
  // İlk ping'i hemen yap
  pingAllEndpoints().then(success => {
    log(`İlk kontrol: ${success ? 'Başarılı ✅' : 'Başarısız ❌'}`);
  });
  
  // Ana ping döngüsü - Her PING_INTERVAL sürede bir çalışır
  setInterval(pingAllEndpoints, PING_INTERVAL);
  
  // Hızlı ping döngüsü - Daha sık ping atar
  setInterval(quickPing, QUICK_PING_INTERVAL);
  
  // Disk aktivitesi döngüsü - Replit'in uyku moduna girmesini engeller
  setInterval(createDiskActivity, DISK_ACTIVITY_INTERVAL);
  
  // Bellek optimizasyonu döngüsü - Her 10 dakikada bir çalıştır
  setInterval(optimizeMemory, 10 * 60 * 1000);
});

// Beklenmeyen hatalar için kurtarma
process.on('uncaughtException', (err) => {
  log(`❌ Beklenmeyen hata: ${err.message}`);
  log('⚠️ Servis yeniden başlatılıyor...');
  
  // 5 saniye sonra tekrar dene
  setTimeout(() => {
    pingAllEndpoints();
  }, 5000);
});

log('====== MAX Uptime Service 9+ Saat Garantili Uptime Çözümü ======');
log('📌 UptimeRobot için önerilen URL:');
log(`  ${REPLIT_URL}:${PORT}/ping`);
log('');
log('⚠️ ÖNEMLİ: Bu terminal penceresini kapatmayın!');
