// Uygulamayı sürekli aktif tutmak için çeşitli ücretsiz ping servisleri
export const URLS = [
  // Replit'in kendi URL'i - kendi kendini ping atmak için
  process.env.REPLIT_URL || 'https://edd4ab32-9e68-45ea-9c30-ea0f7fd51d1d-00-xrddyi4151w7.pike.replit.dev',
  
  // Ücretsiz uptime servisleri - bunlar da uygulamayı ayakta tutar
  'https://uptimerobot.com',
  'https://cron-job.org',
  'https://betteruptime.com',
  'https://freshping.io',
  'https://ping.gg',
  'https://hetrixtools.com',
  
  // Popüler uptime ping servisleri
  'https://uptime.kuma.pet',
  'https://pingpong.one',
  'https://statuscake.com',
  'https://updown.io',
  'https://uptime.com',
  
  // Popüler Uptime Ping Servisleri
  'https://uptimerobot.com/ping-details',
  'https://cronitor.io',
  'https://betteruptime.com/api/v1/heartbeat',
  'https://healthchecks.io',
  
  // Ekstra pinglemek için kendi bot URL'niz - eklediğiniz bot linki
  'https://discord-halisaha-manager.emilswd.repl.co',
  
  // UptimeRobot için ekleyebileceğiniz link
  'https://discord-halisaha-manager.emilswd.repl.co/ping',
  'https://discord-halisaha-manager.emilswd.repl.co/uptime-check',
  'https://discord-halisaha-manager.emilswd.repl.co/api/health',
  
  // Eklemek istediğiniz diğer bağlantıları buraya ekleyebilirsiniz
  // 'https://sizin-yeni-linkiniz.com'
];
