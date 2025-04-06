// UptimeRobot için desteklenen basit uptime servisi
const http = require('http');
const fs = require('fs');

// Uptime ping sunucusu
const server = http.createServer((req, res) => {
  const url = req.url || "/";
  
  // Ping istekleri için basit yanıt
  if (url.includes('/ping') || url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      uptime: process.uptime(),
      message: '7/24 Discord Bot Aktif'
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Uptime server running');
  }
  
  // Her 10 dakikada bir disk aktivitesi
  try {
    fs.writeFileSync('./uptime-status.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }));
  } catch (err) {
    // Yoksay
  }
});

// Yedek port kullan (ana uygulamanın portundan farklı)
const PORT = 8123;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Uptime Server Başlatıldı - Port: ${PORT}`);
});

// Her 5 dakikada bir disk aktivitesi oluştur
setInterval(() => {
  try {
    const status = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage().rss / 1024 / 1024
    };
    fs.writeFileSync('./uptime-activity.json', JSON.stringify(status));
    console.log(`✅ Uptime aktivitesi kaydedildi - ${status.timestamp}`);
  } catch (err) {
    // Yoksay
  }
}, 5 * 60 * 1000);
