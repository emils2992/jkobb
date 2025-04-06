import express from 'express';

/**
 * Bu fonksiyon, özel bir ping rotası ekler
 * Bu rotayı UptimeRobot'ta kullanabilirsiniz
 */
export function addPublicPingRoutes(app: express.Express) {
  // UptimeRobot için ana URL ping rotası - Her istekte farklı içerik
  app.get('/', (req, res) => {
    // Cache önleme headerları
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    // Rastgele değerler oluştur
    const randomId = Math.random().toString(36).substring(2, 15);
    const timestamp = Date.now();
    
    // HTML yanıtı
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Discord Bot Server</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="cache-control" content="no-cache, no-store, must-revalidate">
        <meta http-equiv="pragma" content="no-cache">
        <meta http-equiv="expires" content="0">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .online { color: green; font-weight: bold; }
          .timestamp { color: #666; margin-top: 15px; }
        </style>
      </head>
      <body>
        <h1>Discord Bot Server</h1>
        <p>Bot Status: <span class="online">ONLINE</span></p>
        <p>Server Time: ${new Date().toLocaleString()}</p>
        <p class="timestamp">UUID: ${randomId}-${timestamp}</p>
      </body>
      </html>
    `);
  });

  // UptimeRobot için gelişmiş JSON ping rotası
  app.get('/ping', (req, res) => {
    // Cache'i önlemek için header'lar
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    // URL parametreleri kontrolü, zaman damgası varsa kullan
    const timestamp = req.query.t || req.query.ts || req.query.time || req.query.timestamp || Date.now();
    const clientId = req.query.id || req.query.client || Math.random().toString(36).substring(2, 10);
    
    // Basit durum mesajı
    res.status(200).json({ 
      status: 'online', 
      time: new Date().toISOString(),
      uptime: process.uptime(),
      random: Math.random(), // Her istekte farklı bir değer
      client_timestamp: timestamp,
      client_id: clientId
    });
  });

  // HTML ping cevabı - UptimeRobot'un "paused" durumunu önlemek için geliştirilmiş
  app.get('/ping-html', (req, res) => {
    // Cache'i önlemek için header'lar
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    // URL parametreleri kontrolü
    const timestamp = req.query.ts || Date.now();
    
    // Rastgele değerler oluştur (cache'lenmeyi engellemek için)
    const randomId = Math.random().toString(36).substring(2, 15);
    const serverTs = Date.now();
    
    // Detaylı HTML yanıtı - JavaScript ile cache'lenmeyi engelleyen içerik
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Discord Bot Status</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="cache-control" content="max-age=0, no-cache, no-store, must-revalidate">
        <meta http-equiv="pragma" content="no-cache">
        <meta http-equiv="expires" content="0">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
          h1 { color: #5865F2; }
          .status { padding: 15px; background-color: #f5f5f5; border-radius: 5px; margin: 20px 0; }
          .online { color: green; font-weight: bold; }
          .timestamp { color: #666; font-size: 0.9em; }
          .random { display: none; }
        </style>
      </head>
      <body>
        <h1>Discord Bot Status</h1>
        <div class="status">
          <p>Status: <span class="online">ONLINE</span></p>
          <p>Uptime: ${Math.floor(process.uptime() / 3600)} hours, ${Math.floor((process.uptime() % 3600) / 60)} minutes</p>
          <p class="timestamp">Last checked: ${new Date().toISOString()}</p>
          <p class="timestamp">Client timestamp: ${timestamp}</p>
          <p class="random" id="random">${randomId}-${serverTs}</p>
        </div>
        
        <script>
          // Her sayfa yüklendiğinde farklı içerik oluştur (cache önleme)
          document.getElementById('random').textContent = Math.random().toString(36).substring(2) + '-' + Date.now();
          
          // Her saniye zamanı güncelle
          setInterval(function() {
            document.querySelector('.timestamp').textContent = 'Last checked: ' + new Date().toISOString();
          }, 1000);
        </script>
      </body>
      </html>
    `);
  });

  // Gelişmiş uptime kontrolü - URL parametreleriyle cache önleme
  app.get('/uptime-check', (req, res) => {
    // Cache'i önlemek için header'lar
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    // URL parametreleri kontrolü 
    const timestamp = req.query.ts || req.query.t || req.query.time || Date.now();
    
    // Rastgele değerler oluştur
    const randomId = Math.random().toString(36).substring(2, 15);
    const serverTs = Date.now();
    
    // HTML yanıt - JSON yerine HTML (UptimeRobot'un pause durumunu engellemek için)
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Discord Bot - Always Online</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="cache-control" content="no-cache, no-store, must-revalidate">
        <meta http-equiv="pragma" content="no-cache">
        <meta http-equiv="expires" content="0">
      </head>
      <body>
        <h1 style="color: green; font-family: Arial;">ONLINE ✓</h1>
        <p>Uptime: ${Math.floor(process.uptime() / 60)} dakika</p>
        <p>Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB</p>
        <p>Time: ${new Date().toISOString()}</p>
        <p>Timestamp: ${serverTs}</p>
        <p>Client Timestamp: ${timestamp}</p>
        <p>ID: ${randomId}</p>
      </body>
      </html>
    `);
  });

  // Sağlık kontrolü - cache önleme iyileştirmeleriyle
  app.get('/api/health', (req, res) => {
    // Cache'i önlemek için header'lar
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // URL parametreleri kontrolü
    const timestamp = req.query.ts || req.query.t || req.query.time || Date.now();
    
    // Rastgele değerler oluştur
    const randomId = Math.random().toString(36).substring(2, 15);
    const serverTs = Date.now();
    
    // HTML yanıt - JSON yerine HTML (UptimeRobot'un pause durumunu engellemek için)
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Discord Bot - Health Check</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="cache-control" content="no-cache, no-store, must-revalidate">
        <meta http-equiv="pragma" content="no-cache">
        <meta http-equiv="expires" content="0">
      </head>
      <body>
        <h1 style="color: green; font-family: Arial;">HEALTHY ✓</h1>
        <p>Version: 1.0.0</p>
        <p>Server: discord-bot</p>
        <p>Time: ${new Date().toISOString()}</p>
        <p>Timestamp: ${serverTs}</p>
        <p>Client Timestamp: ${timestamp}</p>
        <p>ID: ${randomId}</p>
      </body>
      </html>
    `);
  });

  return app;
}