// Uygulamayı sürekli aktif tutmak için çeşitli ücretsiz ping servisleri
export const URLS = [
  // Ana URL (proje URL'si) - Mevcut Replit URL'sini kullan
  process.env.REPLIT_URL || 'https://discord-halisaha-manager.emilswd.repl.co',
  
  // Sağlık kontrolü için URL'ler (Bunları UptimeRobot'a ekleyin)
  `${process.env.REPLIT_URL || 'https://discord-halisaha-manager.emilswd.repl.co'}/ping`,
  `${process.env.REPLIT_URL || 'https://discord-halisaha-manager.emilswd.repl.co'}/uptime-check`,
  `${process.env.REPLIT_URL || 'https://discord-halisaha-manager.emilswd.repl.co'}/api/health`,
  
  // UptimeRobot veya başka bir uptime servisine eklenebilecek alternatif URL'ler
  `${process.env.REPLIT_URL || 'https://discord-halisaha-manager.emilswd.repl.co'}/`,
  
  // Replit'in verdiği URL (gerekli olabilir)
  'https://64c141f6-4c3c-4c54-974f-da5243317c87-00-27xtoubo5q3pv.pike.replit.dev/ping'
].filter(Boolean); // undefined değerleri filtrele