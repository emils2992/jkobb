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

  // HTML ping cevabı - bazı monitoring sistemleri için
  app.get('/ping-html', (req, res) => {
    res.send('<html><body><h1>ONLINE</h1></body></html>');
  });

  // Yedek ping rotası
  app.get('/uptime-check', (req, res) => {
    res.status(200).json({ 
      status: 'alive',
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      uptime: Math.floor(process.uptime() / 60) + ' minutes',
      timestamp: new Date().toISOString()
    });
  });

  // Sağlık kontrolü
  app.get('/api/health', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ 
      healthy: true, 
      version: '1.0.0',
      server: 'discord-bot'
    });
  });

  return app;
}