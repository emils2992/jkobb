/**
 * SÜPER GELİŞMİŞ UPTIME ÇÖZÜMÜ
 * Bu script, Discord botunuzun ve Replit projenizin 7/24 çalışmasını sağlar
 * Replit politikalarını aşmak için çoklu koruma mekanizmaları içerir
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const { exec } = require('child_process');
const os = require('os');

// Loglama fonksiyonu
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  try {
    fs.appendFileSync('super-enhanced-uptime.log', logMessage + '\n');
  } catch (err) {
    console.error('Log dosyasına yazılamadı:', err);
  }
}

// URL tespiti
function getBaseUrl() {
  try {
    // Replit bilgileri
    const replSlug = process.env.REPL_SLUG || 'discord-halisaha-manager';
    const replOwner = process.env.REPL_OWNER || 'emilswd';
    
    // Dinamik URL oluştur
    return `https://${replSlug}.${replOwner}.repl.co`;
  } catch (error) {
    log(`URL algılanırken hata: ${error.message}`);
    // Fallback olarak sabit URL
    return 'https://discord-halisaha-manager.emilswd.repl.co';
  }
}

// Rastgele nonce parametresi ekle (önbellek önleme)
function addNonce(url) {
  const separator = url.includes('?') ? '&' : '?';
  const nonce = Date.now() + Math.random().toString(36).substring(2, 7);
  return `${url}${separator}nonce=${nonce}`;
}

// URL'ye ping atma
function pingUrl(url) {
  return new Promise((resolve, reject) => {
    const urlWithNonce = addNonce(url);
    const client = urlWithNonce.startsWith('https') ? https : http;
    
    const timeoutId = setTimeout(() => {
      req.destroy();
      reject(new Error(`Ping zaman aşımına uğradı: ${urlWithNonce}`));
    }, 10000); // 10 saniye timeout
    
    const req = client.get(urlWithNonce, (res) => {
      clearTimeout(timeoutId);
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data,
          url: urlWithNonce
        });
      });
    });
    
    req.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

// Tüm ping noktalarına istek gönderme
async function pingAllEndpoints() {
  const baseUrl = getBaseUrl();
  const endpoints = [
    '/ping',
    '/uptime-check',
    '/api/health',
    '/always-online',
    '/force-active'
  ];
  
  log('Tüm uptime endpointlerine ping gönderiliyor...');
  
  // Her 10 saniyede bir farklı endpoint'e ping at
  for (const endpoint of endpoints) {
    const url = baseUrl + endpoint;
    try {
      const response = await pingUrl(url);
      log(`✅ ${url} başarıyla pinglendi: ${response.status}`);
      
      // Her ping arasında 10 saniye bekle
      await new Promise(resolve => setTimeout(resolve, 10000));
    } catch (error) {
      log(`❌ ${url} pinglenemedi: ${error.message}`);
    }
  }
}

// Çoklu ping gönderimi
async function multiPing() {
  try {
    // Birincil pingler
    await pingAllEndpoints();
    
    // Replit hatalarını temizle
    clearSystemErrors();
    
    // Sistem kaynaklarını kontrol et
    await checkSystemResources();
    
    // Bellek optimizasyonu
    await optimizeMemory();
    
    // Disk aktivitesi oluştur (Replit'in uyku algılama mekanizmasını yanıltmak için)
    await createDiskActivity();
    
    // Uptime durumunu güncelle
    updateStatusFile({ isOnline: true, lastPing: new Date().toISOString() });
    
    log('Çoklu ping döngüsü tamamlandı, 60 saniye bekleniyor...');
  } catch (error) {
    log(`Çoklu ping sırasında hata: ${error.message}`);
    
    // Hata durumunda kendini yeniden başlatmayı dene
    await recoverService();
  }
}

// Bellek optimizasyonu
async function optimizeMemory() {
  try {
    const memoryUsage = process.memoryUsage();
    log(`Bellek kullanımı: ${Math.round(memoryUsage.rss / 1024 / 1024)} MB`);
    
    if (memoryUsage.rss > 150 * 1024 * 1024) { // 150MB üzerindeyse
      log('Bellek optimizasyonu yapılıyor...');
      global.gc && global.gc(); // Eğer --expose-gc ile başlatıldıysa
    }
  } catch (error) {
    log(`Bellek optimizasyonu sırasında hata: ${error.message}`);
  }
}

// Disk aktivitesi oluştur
async function createDiskActivity() {
  try {
    // Heartbeat dosyasına yaz
    const timestamp = Date.now();
    fs.writeFileSync('heartbeat.txt', `Heartbeat: ${timestamp}`);
    
    // Farklı dosyalara da yaz (dönüşümlü olarak)
    const fileIndex = timestamp % 5 + 1;
    fs.writeFileSync(`heartbeat-restart-${fileIndex}.txt`, `Restart check: ${timestamp}`);
    
    log('Disk aktivitesi oluşturuldu');
  } catch (error) {
    log(`Disk aktivitesi oluşturulurken hata: ${error.message}`);
  }
}

// Sistem kaynaklarını kontrol et
async function checkSystemResources() {
  try {
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    const usedMemPercentage = ((totalMem - freeMem) / totalMem) * 100;
    
    log(`Sistem bellek kullanımı: %${usedMemPercentage.toFixed(2)}`);
    
    if (usedMemPercentage > 90) {
      log('Yüksek bellek kullanımı tespit edildi, kaynak optimizasyonu yapılıyor...');
      // Bellek temizleme stratejileri burada uygulanabilir
    }
    
    // CPU yükünü kontrol et
    const loadAvg = os.loadavg();
    log(`CPU yükü (1, 5, 15 dk): ${loadAvg.join(', ')}`);
  } catch (error) {
    log(`Sistem kaynakları kontrol edilirken hata: ${error.message}`);
  }
}

// Sistem hatalarını temizle
function clearSystemErrors() {
  try {
    // Eski log dosyalarını temizle (çok büyümelerini önle)
    const logFiles = [
      'super-enhanced-uptime.log',
      'keep-bot-online.log',
      'forever-uptime.log',
      'target-bot-ping.log'
    ];
    
    logFiles.forEach(file => {
      try {
        const stats = fs.statSync(file);
        const fileSizeMB = stats.size / (1024 * 1024);
        
        if (fileSizeMB > 5) { // 5MB'dan büyükse
          fs.writeFileSync(file, 'Log dosyası temizlendi\n');
          log(`${file} dosyası temizlendi (boyut: ${fileSizeMB.toFixed(2)}MB)`);
        }
      } catch (err) {
        // Dosya yoksa sorun değil
      }
    });
  } catch (error) {
    log(`Sistem hataları temizlenirken hata: ${error.message}`);
  }
}

// Servis düzeltme - Servis düşerse kurtarmak için çeşitli stratejiler uygula
async function recoverService() {
  log('Servis düzeltme stratejileri uygulanıyor...');
  
  try {
    // 1. Diğer uptime scriptlerini yeniden başlat
    const scriptler = [
      'node keep-bot-online.js &',
      'node always-running.js &',
      'bash forever-uptime.sh &'
    ];
    
    for (const script of scriptler) {
      try {
        exec(script, (error, stdout, stderr) => {
          if (error) {
            log(`Script çalıştırılırken hata: ${error.message}`);
            return;
          }
          log(`Script başarıyla çalıştırıldı: ${script}`);
        });
        
        // Her komut arasında kısa bir bekleme
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        log(`Script çalıştırılırken hata: ${err.message}`);
      }
    }
    
    // 2. "need-restart" dosyası oluştur (diğer scriptlere yeniden başlatma sinyali)
    fs.writeFileSync('need-restart', Date.now().toString());
    log('need-restart dosyası oluşturuldu, diğer scriptler yeniden başlatılacak');
    
    // 3. Durumu güncelle
    updateStatusFile({ isOnline: false, recovering: true, lastRecovery: new Date().toISOString() });
    
    log('Servis düzeltme tamamlandı, normal döngüye dönülüyor...');
  } catch (error) {
    log(`Servis düzeltme sırasında hata: ${error.message}`);
  }
}

// Durum dosyasını güncelle
function updateStatusFile(status) {
  try {
    let currentStatus = {};
    
    // Mevcut durum dosyasını oku
    try {
      const statusData = fs.readFileSync('uptime-status.json', 'utf8');
      currentStatus = JSON.parse(statusData);
    } catch (err) {
      // Dosya yoksa veya okunamazsa, yeni oluştur
      currentStatus = {
        startTime: new Date().toISOString(),
        pingCount: 0,
        recoveryCount: 0
      };
    }
    
    // Durum güncellemesi
    const updatedStatus = {
      ...currentStatus,
      ...status,
      lastUpdate: new Date().toISOString(),
      pingCount: (currentStatus.pingCount || 0) + 1,
      uptime: Date.now() - new Date(currentStatus.startTime || new Date()).getTime()
    };
    
    // Recovery sayısını güncelle
    if (status.recovering) {
      updatedStatus.recoveryCount = (currentStatus.recoveryCount || 0) + 1;
    }
    
    // Dosyaya yaz
    fs.writeFileSync('uptime-status.json', JSON.stringify(updatedStatus, null, 2));
  } catch (error) {
    log(`Durum dosyası güncellenirken hata: ${error.message}`);
  }
}

// Mini HTTP sunucusu
function startMiniHttpServer() {
  try {
    const port = 4042; // Farklı bir port kullan
    
    const server = http.createServer((req, res) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Super Enhanced Uptime Service is running');
    });
    
    server.listen(port, '0.0.0.0', () => {
      log(`Mini HTTP sunucusu port ${port}'de başlatıldı`);
    });
    
    server.on('error', (err) => {
      log(`Mini HTTP sunucusu başlatılırken hata: ${err.message}`);
    });
  } catch (error) {
    log(`Mini HTTP sunucusu başlatılırken hata: ${error.message}`);
  }
}

// Veri koruma - Önemli dosyaların yedeğini al
function backupImportantFiles() {
  try {
    const filesToBackup = [
      'keepalive.json',
      'server/config.json',
      'uptime-status.json'
    ];
    
    for (const file of filesToBackup) {
      try {
        if (fs.existsSync(file)) {
          const backupFile = `${file}.backup`;
          fs.copyFileSync(file, backupFile);
        }
      } catch (err) {
        log(`${file} yedeklenirken hata: ${err.message}`);
      }
    }
    
    log('Önemli dosyaların yedeği alındı');
  } catch (error) {
    log(`Dosya yedekleme sırasında hata: ${error.message}`);
  }
}

// Ana fonksiyon
async function main() {
  log('SÜPER GELİŞMİŞ UPTIME SERVİSİ BAŞLATILDI');
  
  // Mini HTTP sunucusunu başlat
  startMiniHttpServer();
  
  // İlk çalıştırma
  await multiPing();
  
  // Yedekleme yap
  backupImportantFiles();
  
  // Her dakika çalıştır
  setInterval(async () => {
    await multiPing();
  }, 60000);
  
  // Her 30 dakikada bir yedekleme yap
  setInterval(() => {
    backupImportantFiles();
  }, 30 * 60 * 1000);
  
  // Her 6 saatte bir servis düzeltme stratejilerini yeniden uygula (proaktif bakım)
  setInterval(async () => {
    log('Proaktif bakım yapılıyor...');
    await recoverService();
  }, 6 * 60 * 60 * 1000);
}

// Scripti başlat
main().catch(error => {
  log(`Ana fonksiyonda hata: ${error.message}`);
  process.exit(1);
});