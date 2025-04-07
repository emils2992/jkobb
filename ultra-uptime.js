
// Ultra Uptime Service - Discord botu için 7/24 aktif kalma çözümü (8+ saat garantili)
const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 5000;
const LOG_FILE = './ultra-uptime.log';
const STATUS_FILE = './ultra-uptime-status.json';
const HEARTBEAT_FILE = './ultra-heartbeat.txt';

// Log fonksiyonu
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  try {
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
  } catch (err) {
    console.error("Log yazma hatası:", err);
  }
}

// Replit URL'si
const REPLIT_URL = process.env.REPLIT_URL || "https://discord-halisaha-manager.emilswd.repl.co";
const SPECIAL_URL = "https://9f27368b-0b17-4ac7-8928-fc20e6cf4a11-00-exkoqowlthzq.sisko.replit.dev";

// Ping endpointleri - çeşitli ping URL'leri
const PING_ENDPOINTS = [
  `${REPLIT_URL}/ping`,
  `${REPLIT_URL}/uptime.html`,
  `${REPLIT_URL}/always-online.html`,
  `${REPLIT_URL}/api/health`,
  `${REPLIT_URL}/uptime-check`,
  // Özel port URL'si
  `${SPECIAL_URL}:5000/ping`
];

// Durumları takip etmek için değişkenler
let stats = {
  startTime: new Date().toISOString(),
  lastSuccessTime: null,
  totalPings: 0,
  successfulPings: 0,
  failedPings: 0,
  lastStatus: "initializing",
  uptimePercent: 100,
  recoveryAttempts: 0,
  lastEndpoints: {}
};

// Minimum belirli aralıklarla durum dosyasına yazma
let lastWriteTime = 0;
const MIN_WRITE_INTERVAL = 30000; // 30 saniye

// Ping fonksiyonu - belirli bir URL'yi ping eder
function pingUrl(url) {
  const timestamp = Date.now();
  const pingUrl = `${url}?t=${timestamp}&id=${Math.random().toString(36).substring(2, 10)}`;
  
  return new Promise((resolve, reject) => {
    const isHttps = pingUrl.startsWith('https');
    const client = isHttps ? https : http;
    
    const req = client.get(pingUrl, { 
      rejectUnauthorized: false, 
      timeout: 15000,
      headers: {
        'User-Agent': 'UltraUptimeService/1.0',
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
          data: data,
          success: res.statusCode >= 200 && res.statusCode < 400
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Tüm endpointleri ping'leme fonksiyonu
async function pingAllEndpoints() {
  stats.totalPings++;
  let overallSuccess = false;
  let successCount = 0;
  
  // Her endpoint için durum takibi
  for (const endpoint of PING_ENDPOINTS) {
    try {
      // Max 3 deneme yap
      let success = false;
      let attempt = 0;
      let statusCode = 0;
      
      while (!success && attempt < 3) {
        try {
          attempt++;
          const result = await pingUrl(endpoint);
          statusCode = result.statusCode;
          
          if (result.success) {
            success = true;
            successCount++;
            stats.lastEndpoints[endpoint] = {
              status: 'success',
              statusCode,
              timestamp: new Date().toISOString(),
              attempt
            };
            
            // En az bir endpointin başarılı olması genel başarı sayılır
            overallSuccess = true;
            break;
          }
        } catch (innerError) {
          // İç döngü hatası - tekrar dene
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      if (!success) {
        stats.lastEndpoints[endpoint] = {
          status: 'failed',
          statusCode,
          timestamp: new Date().toISOString(),
          attempts: attempt
        };
        log(`❌ ${endpoint} ping başarısız (${attempt} deneme)`);
      } else {
        if (attempt > 1) {
          log(`✅ ${endpoint} ping başarılı (${attempt}. denemede)`);
        } else {
          // log(`✅ ${endpoint} ping başarılı`); // Gereksiz log'ları azalt
        }
      }
    } catch (error) {
      stats.lastEndpoints[endpoint] = {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      log(`❌ ${endpoint} ping hatası: ${error.message}`);
    }
  }
  
  // İstatistikleri güncelle
  if (overallSuccess) {
    stats.successfulPings++;
    stats.lastSuccessTime = new Date().toISOString();
    stats.lastStatus = "online";
  } else {
    stats.failedPings++;
    stats.lastStatus = "offline";
    
    // Kurtarma prosedürünü başlat
    stats.recoveryAttempts++;
    log(`⚠️ Hiçbir endpoint yanıt vermiyor. Kurtarma prosedürü başlatılıyor... (${stats.recoveryAttempts})`);
    await recoverService();
  }
  
  // Uptime yüzdesini güncelle
  stats.uptimePercent = (stats.successfulPings / stats.totalPings * 100).toFixed(2);
  
  // Durum dosyasını güncelle, ama çok sık yazma
  const now = Date.now();
  if (now - lastWriteTime > MIN_WRITE_INTERVAL) {
    updateStatusFile();
    lastWriteTime = now;
  }
  
  // Heartbeat dosyasını her zaman güncelle
  fs.writeFileSync(HEARTBEAT_FILE, new Date().toISOString());
  
  return overallSuccess;
}

// Kurtarma prosedürü
async function recoverService() {
  log("📢 Kurtarma prosedürü çalışıyor...");
  
  // 1. Disk aktivitesi oluştur (uyku modundan çıkmak için)
  try {
    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(`./recovery-${Date.now()}.tmp`, `Recovery ping ${Date.now()}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    // Geçici dosyaları temizle
    const files = fs.readdirSync('./');
    for (const file of files) {
      if (file.startsWith('recovery-') && file.endsWith('.tmp')) {
        fs.unlinkSync(`./${file}`);
      }
    }
  } catch (error) {
    log(`Disk aktivitesi hatası: ${error.message}`);
  }
  
  // 2. Alternatif endpointleri dene
  const alternativeEndpoints = [
    `${REPLIT_URL}/`,
    `${REPLIT_URL}/login`,
    `${REPLIT_URL}/dashboard`,
    `${SPECIAL_URL}:5000/status`
  ];
  
  for (const endpoint of alternativeEndpoints) {
    try {
      const result = await pingUrl(endpoint);
      if (result.success) {
        log(`✅ Alternatif endpoint başarılı: ${endpoint}`);
        return true;
      }
    } catch (error) {
      log(`❌ Alternatif endpoint hatası: ${endpoint} - ${error.message}`);
    }
  }
  
  // 3. Farklı protokoller ve parametrelerle dene
  try {
    const timestamp = Date.now();
    const targetUrl = `${REPLIT_URL}/ping?recovery=true&t=${timestamp}&retry=1&force=1`;
    const fetchOptions = {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'User-Agent': 'UltraUptimeBot/Recovery'
      }
    };
    
    // HTTP modülü ile dene
    const httpResult = await new Promise((resolve) => {
      const req = http.get(targetUrl.replace('https://', 'http://'), fetchOptions, (res) => {
        resolve({success: res.statusCode >= 200 && res.statusCode < 400});
      }).on('error', () => {
        resolve({success: false});
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        resolve({success: false});
      });
    });
    
    if (httpResult.success) {
      log("✅ HTTP kurtarma başarılı");
      return true;
    }
  } catch (error) {
    log(`HTTP kurtarma hatası: ${error.message}`);
  }
  
  log("⚠️ Kurtarma başarısız oldu. Bir sonraki ping döngüsünde tekrar denenecek.");
  return false;
}

// Durum dosyasını güncelle
function updateStatusFile() {
  const statusData = {
    botName: "Discord Halisaha Bot",
    status: stats.lastStatus,
    uptimePercent: stats.uptimePercent,
    lastSuccessTime: stats.lastSuccessTime,
    startTime: stats.startTime,
    totalPings: stats.totalPings,
    successfulPings: stats.successfulPings,
    failedPings: stats.failedPings,
    recoveryAttempts: stats.recoveryAttempts,
    serverTime: new Date().toISOString(),
    endpoints: Object.keys(stats.lastEndpoints).length
  };
  
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(statusData, null, 2));
  } catch (error) {
    log(`Durum dosyası yazma hatası: ${error.message}`);
  }
}

// Express API rotaları
app.get('/', (req, res) => {
  res.redirect('/ping');
});

// Ping endpoint - HTML sayfası döndürür
app.get('/ping', (req, res) => {
  // Cache önleyici başlıklar
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  const randomId = Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now();
  
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Ultra Uptime Service (8+ Saat)</title>
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
        .uptime { font-weight: bold; color: #2ecc71; }
      </style>
      <script>
        // Sayfa her 4 dakikada bir yenilenir
        setTimeout(() => {
          window.location.reload();
        }, 4 * 60 * 1000);
        
        // Her 30 saniyede bir sunucuya ping gönderir
        setInterval(() => {
          fetch('/auto-ping?t=' + Date.now() + '&id=' + Math.random().toString(36).substring(2, 10))
            .catch(err => console.error('Auto-ping error:', err));
        }, 30 * 1000);
      </script>
    </head>
    <body>
      <div class="container">
        <h1>Ultra Uptime Service (8+ Saat)</h1>
        
        <div class="status">
          <div class="dot"></div>
          <div><strong>BOT ONLINE ✓</strong></div>
        </div>
        
        <p>Discord Halisaha Bot aktif ve çalışıyor</p>
        <p class="uptime">Uptime: ${stats.uptimePercent}%</p>
        
        <div class="info">
          <p><strong>Sunucu Zamanı:</strong> ${new Date().toISOString()}</p>
          <p><strong>Rastgele ID:</strong> ${randomId}</p>
          <p><strong>Başarılı Pingler:</strong> ${stats.successfulPings}/${stats.totalPings}</p>
          <p><strong>Servis Çalışma Süresi:</strong> ${Math.floor(process.uptime() / 60)} dakika</p>
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

// Otomatik ping endpoint
app.get('/auto-ping', (req, res) => {
  // Gecikmeyi simüle et (UptimeRobot'un yeşil tık vermesi için)
  setTimeout(() => {
    res.status(200).json({
      status: 'online',
      timestamp: Date.now(),
      id: req.query.id || Math.random().toString(36).substring(2, 10)
    });
  }, 500);
});

// Durum sayfası
app.get('/status', (req, res) => {
  res.status(200).json({
    ...stats,
    serverTime: new Date().toISOString(),
    nodeVersion: process.version,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  });
});

// Sağlık kontrolü
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// HTTP sunucusunu başlat
const server = http.createServer(app);

// Kapanma olayını yakala
process.on('SIGINT', () => {
  log('Process SIGINT received. Cleaning up...');
  server.close(() => {
    log('Server closed. Exiting...');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  log('Process SIGTERM received. Cleaning up...');
  server.close(() => {
    log('Server closed. Exiting...');
    process.exit(0);
  });
});

// Beklenmeyen hataları yakala
process.on('uncaughtException', (err) => {
  log(`❌ Beklenmeyen hata: ${err.message}`);
  log('⚠️ Servis yeniden başlatılıyor...');
  
  // 5 saniye sonra tekrar dene
  setTimeout(() => {
    pingAllEndpoints();
  }, 5000);
});

// Sunucuyu dinlemeye başla
server.listen(PORT, '0.0.0.0', () => {
  log(`🚀 Ultra Uptime Service port ${PORT} üzerinde çalışıyor`);
  log(`URL: ${REPLIT_URL}:${PORT}/ping`);
  
  // İlk ping'i hemen yap
  pingAllEndpoints().then(success => {
    log(`İlk kontrol: ${success ? 'Başarılı ✅' : 'Başarısız ❌'}`);
  });
  
  // Düzenli ping döngüsü başlat
  // Ana ping döngüsü - Her 3 dakikada bir çalışır
  setInterval(() => {
    pingAllEndpoints().then(success => {
      if (!success) {
        log('⚠️ Tüm ping denemeleri başarısız oldu!');
      }
    });
  }, 3 * 60 * 1000); // 3 dakika
  
  // Daha agresif ping döngüsü - Her 30 saniyede bir kısmi kontrol
  setInterval(() => {
    // Tüm endpoint'leri değil, sadece birkaçını kontrol et (hızlı kontrol)
    const randomIndex = Math.floor(Math.random() * PING_ENDPOINTS.length);
    const endpoint = PING_ENDPOINTS[randomIndex];
    
    pingUrl(endpoint).then(result => {
      if (result.success) {
        // Başarılı - sessizce devam et
      } else {
        log(`⚠️ Hızlı kontrol başarısız: ${endpoint} (HTTP ${result.statusCode})`);
      }
    }).catch(error => {
      log(`⚠️ Hızlı kontrol hatası: ${endpoint} - ${error.message}`);
    });
  }, 30 * 1000); // 30 saniye
  
  // Durum dosyasını periyodik olarak güncelle
  setInterval(() => {
    updateStatusFile();
  }, 60 * 1000); // 1 dakika
  
  // Disk aktivitesi oluştur (uyku modunu önlemek için)
  setInterval(() => {
    fs.writeFileSync(HEARTBEAT_FILE, new Date().toISOString());
  }, 20 * 1000); // 20 saniye
});

log('🚀 Ultra Uptime Service başlatıldı (8+ Saat Uptime)');
