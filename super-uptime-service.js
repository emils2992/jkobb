
// Super Uptime Service - Replit Discord botları için ultra güvenilir uptime çözümü
const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 5000;
const LOG_FILE = './super-uptime.log';

// Log fonksiyonu
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// Replit URL'si - dinamik URL oluşturma
const REPL_SLUG = process.env.REPL_SLUG || 'discord-halisaha-manager';
const REPL_OWNER = process.env.REPL_OWNER || 'emilswd';
const REPLIT_URL = process.env.REPLIT_URL || `https://${REPL_SLUG}.${REPL_OWNER}.repl.co`;

// Ping fonksiyonu - belirli bir URL'yi ping eder
function pingUrl(url) {
  const timestamp = Date.now();
  const pingUrl = `${url}?t=${timestamp}&id=${Math.random().toString(36).substring(2, 10)}`;
  
  return new Promise((resolve, reject) => {
    const client = pingUrl.startsWith('https') ? https : http;
    
    const req = client.get(pingUrl, { rejectUnauthorized: false, timeout: 10000 }, (res) => {
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
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Aktifleştirme fonksiyonu - tüm URL'leri ping eder
async function activateBot() {
  const urls = [
    `${REPLIT_URL}/ping`,
    `${REPLIT_URL}/uptime.html`,
    `${REPLIT_URL}/always-online.html`,
    `${REPLIT_URL}/api/health`,
    `${REPLIT_URL}/uptime-check`,
  ];
  
  log('Bot aktifleştirme döngüsü başlatıldı...');
  
  let successCount = 0;
  
  for (const url of urls) {
    try {
      const result = await pingUrl(url);
      if (result.success) {
        successCount++;
        log(`✅ ${url} ping başarılı (${result.statusCode})`);
      } else {
        log(`❌ ${url} ping başarısız (${result.statusCode})`);
      }
    } catch (error) {
      log(`❌ ${url} ping hatası: ${error.message}`);
    }
  }
  
  // Durum dosyasını güncelle
  updateStatusFile({
    successCount,
    totalUrls: urls.length,
    lastCheck: new Date().toISOString()
  });
  
  return successCount > 0;
}

// Durum dosyasını güncelle
function updateStatusFile(status) {
  const statusFile = {
    botName: "Discord Halisaha Bot",
    status: status.successCount > 0 ? "ONLINE" : "OFFLINE",
    lastCheck: status.lastCheck,
    successRate: `${status.successCount}/${status.totalUrls} (${(status.successCount / status.totalUrls * 100).toFixed(2)}%)`,
    uptime: process.uptime(),
    nextCheckIn: "5 dakika",
    serverTime: new Date().toISOString()
  };
  
  try {
    fs.writeFileSync('./super-uptime-status.json', JSON.stringify(statusFile, null, 2));
  } catch (error) {
    log(`Durum dosyası yazma hatası: ${error.message}`);
  }
}

// Ana HTML sayfası
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
  
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Super Uptime Service</title>
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
        <h1>Super Uptime Service</h1>
        
        <div class="status">
          <div class="dot"></div>
          <div><strong>BOT ONLINE ✓</strong></div>
        </div>
        
        <p>Discord Halisaha Bot aktif ve çalışıyor</p>
        
        <div class="info">
          <p><strong>Sunucu Zamanı:</strong> ${new Date().toISOString()}</p>
          <p><strong>Rastgele ID:</strong> ${randomId}</p>
          <p><strong>Timestamp:</strong> ${timestamp}</p>
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

// Auto ping endpoint
app.get('/auto-ping', (req, res) => {
  res.status(200).json({
    status: 'online',
    timestamp: Date.now(),
    id: req.query.id || Math.random().toString(36).substring(2, 10)
  });
});

// Basit durum sayfası
app.get('/status', (req, res) => {
  try {
    const statusData = fs.readFileSync('./super-uptime-status.json', 'utf8');
    const status = JSON.parse(statusData);
    res.status(200).json(status);
  } catch (error) {
    res.status(200).json({
      status: 'initializing',
      error: error.message
    });
  }
});

// HTTP sunucusunu başlat
const server = http.createServer(app);
server.listen(PORT, '0.0.0.0', () => {
  log(`Super Uptime Service port ${PORT} üzerinde çalışıyor`);
  log(`URL: ${REPLIT_URL}:${PORT}/ping`);
  
  // İlk aktivasyon kontrolünü hemen yap
  activateBot().then(success => {
    log(`İlk aktivasyon kontrolü: ${success ? 'Başarılı' : 'Başarısız'}`);
  });
  
  // Her 5 dakikada bir aktivasyon kontrolü yap
  setInterval(() => {
    activateBot().then(success => {
      if (!success) {
        log('⚠️ Hiçbir URL başarılı değil! Bot offline olabilir!');
      }
    });
  }, 5 * 60 * 1000);
  
  // Her 30 saniyede bir durum dosyasını güncelle (disk aktivitesi)
  setInterval(() => {
    fs.writeFileSync('./last-heartbeat.txt', new Date().toISOString());
  }, 30 * 1000);
});

// Hata yakalama
process.on('uncaughtException', (err) => {
  log(`❌ Beklenmeyen hata: ${err.message}`);
  log('⚠️ Servis yeniden başlatılıyor...');
  
  // 5 saniye sonra tekrar dene
  setTimeout(() => {
    activateBot();
  }, 5000);
});

log('🚀 Super Uptime Service başlatıldı');
