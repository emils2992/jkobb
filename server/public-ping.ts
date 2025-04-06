import express from 'express';

/**
 * Bu fonksiyon, özel bir ping rotası ekler
 * Bu rotayı UptimeRobot'ta kullanabilirsiniz
 */
export function addPublicPingRoutes(app: express.Express) {
  // Temel HTML sayfası - UptimeRobot için ana URL ping rotası
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Discord Bot Server</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .online { color: green; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Discord Bot Server</h1>
        <p>Bot Status: <span class="online">ONLINE</span></p>
        <p>Server Time: ${new Date().toLocaleString()}</p>
      </body>
      </html>
    `);
  });

  // UptimeRobot noCache ayarlı ping rotası
  app.get('/ping', (req, res) => {
    // Cache'i önlemek için header'lar
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    // Basit durum mesajı
    res.status(200).json({ 
      status: 'online', 
      time: new Date().toISOString(),
      uptime: process.uptime(),
      random: Math.random(), // Her istekte farklı bir değer
    });
  });

  // HTML ping cevabı - UptimeRobot'un "paused" durumunu önlemek için geliştirilmiş
  app.get('/ping-html', (req, res) => {
    // Cache'i önlemek için header'lar
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    // Rastgele değerler oluştur (cache'lenmeyi engellemek için)
    const randomId = Math.random().toString(36).substring(2, 15);
    const timestamp = Date.now();
    
    // Detaylı HTML yanıtı
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
          <p class="random">${randomId}-${timestamp}</p>
        </div>
      </body>
      </html>
    `);
  });

  // Yedek ping rotası - cache önleme iyileştirmeleriyle
  app.get('/uptime-check', (req, res) => {
    // Cache'i önlemek için header'lar
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    // Rastgele değerler oluştur
    const randomId = Math.random().toString(36).substring(2, 15);
    const timestamp = Date.now();
    
    res.status(200).json({ 
      status: 'alive',
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      uptime: Math.floor(process.uptime() / 60) + ' minutes',
      timestamp: new Date().toISOString(),
      random_id: randomId,
      ts: timestamp
    });
  });

  // Sağlık kontrolü - cache önleme iyileştirmeleriyle
  app.get('/api/health', (req, res) => {
    // Cache'i önlemek için header'lar
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Rastgele değerler oluştur
    const randomId = Math.random().toString(36).substring(2, 15);
    const timestamp = Date.now();
    
    res.status(200).json({ 
      healthy: true, 
      version: '1.0.0',
      server: 'discord-bot',
      time: new Date().toISOString(),
      random_id: randomId,
      ts: timestamp
    });
  });

  return app;
}