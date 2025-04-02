import express from 'express';
import path from 'path';
import { log } from './vite';

/**
 * Basit statik dosya sunucusu
 * Bu, uptime için ana sayfayı ve ping endpointlerini servis eder
 */
export function setupStaticServer() {
  const app = express();
  
  // Statik dosyaları servis et
  const publicPath = path.resolve(__dirname, '..', 'public');
  app.use(express.static(publicPath));
  
  // Ana sayfa
  app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
  
  // Ping endpoint
  app.get('/ping', (req, res) => {
    res.status(200).send('Pong!');
  });
  
  // Uptime check
  app.get('/uptime-check', (req, res) => {
    res.status(200).json({
      status: 'online',
      timestamp: new Date().toISOString(),
      server: 'Discord Bot - Kesintisiz Servis'
    });
  });
  
  // Portu dinle
  const port = 3000; // Ana server 5000 kullanıyor, biz 3000 kullanalım
  app.listen(port, '0.0.0.0', () => {
    log(`Statik sunucu başlatıldı, port: ${port}`);
  });
  
  return app;
}