// Bu script, belirtilen URL'ye düzenli ping atarak botun aktif kalmasını sağlar
const https = require('https');
const fs = require('fs');

// Ping atılacak URL - kullanıcının istediği URL
const TARGET_URL = "https://9f27368b-0b17-4ac7-8928-fc20e6cf4a11-00-exkoqowlthzq.sisko.replit.dev:5000/ping";

// Ping aralığı (5 dakika)
const PING_INTERVAL = 5 * 60 * 1000;

// Log dosyası
const LOG_FILE = 'target-bot-ping.log';

// Log fonksiyonu
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// URL'ye ping at
function pingTargetBot() {
  const now = new Date();
  const timestamp = now.getTime();
  const pingUrl = `${TARGET_URL}?t=${timestamp}&id=${Math.random().toString(36).substring(2, 8)}`;
  
  log(`Hedef bota ping gönderiliyor: ${pingUrl}`);
  
  const req = https.get(pingUrl, { 
    rejectUnauthorized: false, // Sertifika hatalarını yoksay
    timeout: 30000 // 30 saniye timeout
  }, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        log(`✅ Ping başarılı! Durum kodu: ${res.statusCode}`);
      } else {
        log(`❌ Ping başarısız! Durum kodu: ${res.statusCode}`);
      }
    });
  });
  
  req.on('error', (err) => {
    log(`❌ Ping hatası: ${err.message}`);
  });
  
  req.on('timeout', () => {
    req.destroy();
    log(`❌ Ping zaman aşımı (30 saniye)`);
  });
}

// Başlangıç mesajı
log('Target Bot Ping Servisi başlatıldı');
log(`Hedef URL: ${TARGET_URL}`);
log(`Ping aralığı: ${PING_INTERVAL / 1000 / 60} dakika`);

// İlk ping'i hemen yap
pingTargetBot();

// Belirtilen aralıklarla ping at
setInterval(pingTargetBot, PING_INTERVAL);

// Disk aktivitesi için dosya oluştur (Replit'in uyku moduna geçmesini engeller)
setInterval(() => {
  fs.writeFileSync('last-target-ping.txt', new Date().toISOString());
}, 60000);

log('Ping servisi çalışıyor, bu terminal penceresini kapatmayın!');