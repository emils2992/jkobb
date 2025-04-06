
// Özel Uptime Sunucusu - Port 5000
const express = require('express');
const http = require('http');
const app = express();

// Ana port
const PORT = 5000;

// Uptime için ana endpoint
app.get('/ping', (req, res) => {
  // Cache önleme başlıkları
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Rastgele değerler oluştur (cache busting için)
  const randomId = Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now();
  
  // HTML yanıtı
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bot Uptime</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="cache-control" content="no-cache, no-store, must-revalidate">
      <meta http-equiv="pragma" content="no-cache">
      <meta http-equiv="expires" content="0">
    </head>
    <body>
      <h1 style="color: green;">ONLINE ✓</h1>
      <p>Random ID: ${randomId}</p>
      <p>Time: ${new Date().toISOString()}</p>
      <p>Timestamp: ${timestamp}</p>
    </body>
    </html>
  `);
});

// Ana sayfa
app.get('/', (req, res) => {
  res.send('Bot Uptime Server çalışıyor. /ping endpoint\'ini kullanın.');
});

// Sunucuyu başlat
const server = http.createServer(app);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Uptime sunucusu port ${PORT} üzerinde çalışıyor`);
  console.log(`URL: https://9f27368b-0b17-4ac7-8928-fc20e6cf4a11-00-exkoqowlthzq.sisko.replit.dev:${PORT}/ping`);
});
