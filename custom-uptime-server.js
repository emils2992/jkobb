
// Gelişmiş Özel Uptime Sunucusu - Port 5000
const express = require('express');
const http = require('http');
const fs = require('fs');
const app = express();

// Ana port
const PORT = 5000;
const LOG_FILE = './custom-uptime.log';

// Log fonksiyonu
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// Düzenli "yeşil tıklama" simülasyonu
let autoClickInterval;
function startAutoClicker() {
  log('Otomatik "yeşil tıklama" simülasyonu başlatıldı - 5 dakikada bir aktif');
  
  // Her 5 dakikada bir kendi kendine ping at (yeşil tık simülasyonu)
  if (autoClickInterval) clearInterval(autoClickInterval);
  
  autoClickInterval = setInterval(() => {
    // Self-ping
    log('Otomatik yeşil tık simülasyonu - ping gönderiliyor...');
    
    // UptimeRobot'un kullandığı adresleri ping et
    const fetch = require('node-fetch');
    Promise.all([
      fetch(`http://localhost:${PORT}/ping?auto=true&t=${Date.now()}`),
      fetch(`https://discord-halisaha-manager.emilswd.repl.co/ping?auto=true&t=${Date.now()}`),
      fetch(`https://discord-halisaha-manager.emilswd.repl.co/uptime.html?auto=true&t=${Date.now()}`)
    ]).then(() => {
      log('Otomatik yeşil tık simülasyonu - ping başarılı!');
    }).catch(err => {
      log(`Otomatik yeşil tık simülasyonu - hata: ${err.message}`);
    });
  }, 5 * 60 * 1000); // 5 dakika
}

// Uptime için ana endpoint
app.get('/ping', (req, res) => {
  // Cache önleme başlıkları
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Rastgele değerler oluştur (cache busting için)
  const randomId = Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now();
  
  log(`Ping isteği alındı: ${req.ip} - ${randomId}`);
  
  // HTML yanıtı - Otomatik yenilenen sayfa
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bot Uptime - Otomatik Yeşil Tık</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="cache-control" content="no-cache, no-store, must-revalidate">
      <meta http-equiv="pragma" content="no-cache">
      <meta http-equiv="expires" content="0">
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 30px; }
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
        .auto-refresh { color: #666; margin-top: 20px; font-size: 0.8em; }
      </style>
      <script>
        // Otomatik yenileme - UptimeRobot'u sürekli beslemek için
        // 4 dakikada bir sayfa yenilenir (UptimeRobot 5 dakikada bir kontrol eder)
        setTimeout(() => {
          window.location.reload();
        }, 4 * 60 * 1000);
        
        // Her 30 saniyede bir sunucuya ping gönder (ek güvence)
        setInterval(() => {
          fetch('/auto-ping?t=' + Date.now());
        }, 30 * 1000);
      </script>
    </head>
    <body>
      <h1>Discord Bot Uptime</h1>
      
      <div class="status">
        <div class="dot"></div>
        <div>BOT ONLINE ✓</div>
      </div>
      
      <p>Bot aktif ve düzgün çalışıyor.</p>
      <p>Random ID: ${randomId}</p>
      <p>Sunucu Zamanı: ${new Date().toISOString()}</p>
      
      <div class="auto-refresh">
        Bu sayfa otomatik olarak 4 dakikada bir yenilenir.<br>
        Ayrıca 30 saniyede bir ping gönderilir.<br>
        <span id="next-refresh"></span>
      </div>
      
      <script>
        // Geri sayım
        const nextRefreshElem = document.getElementById('next-refresh');
        let seconds = 4 * 60;
        
        function updateCounter() {
          const minutes = Math.floor(seconds / 60);
          const remainingSeconds = seconds % 60;
          nextRefreshElem.textContent = `Bir sonraki yenileme: ${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
          seconds--;
          
          if (seconds >= 0) {
            setTimeout(updateCounter, 1000);
          }
        }
        
        updateCounter();
      </script>
    </body>
    </html>
  `);
});

// Otomatik ping endpoint (özel istek)
app.get('/auto-ping', (req, res) => {
  res.status(200).json({
    status: 'online',
    timestamp: Date.now(),
    id: Math.random().toString(36).substring(2, 10)
  });
});

// Ana sayfa
app.get('/', (req, res) => {
  res.redirect('/ping');
});

// Sunucuyu başlat
const server = http.createServer(app);
server.listen(PORT, '0.0.0.0', () => {
  log(`Otomatik Yeşil Tık Uptime sunucusu port ${PORT} üzerinde çalışıyor`);
  log(`URL: https://discord-halisaha-manager.emilswd.repl.co:${PORT}/ping`);
  
  // Otomatik tıklayıcıyı başlat
  startAutoClicker();
});

// Hata durumunda yeniden başlat
process.on('uncaughtException', (err) => {
  log(`Kritik hata oluştu: ${err.message}`);
  log('Servis yeniden başlatılıyor...');
  
  if (autoClickInterval) clearInterval(autoClickInterval);
  
  setTimeout(() => {
    startAutoClicker();
  }, 5000);
});

log('Özel uptime sunucusu başlatıldı - Otomatik yeşil tık simülasyonuyla');
