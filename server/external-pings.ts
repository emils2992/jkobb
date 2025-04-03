// Uygulamayı sürekli aktif tutmak için çeşitli ücretsiz ping servisleri
export const URLS = [
  // Replit'in kendi URL'i - kendi kendini ping atmak için
  process.env.REPLIT_URL || 'https://discord-halisaha-manager.emilswd.repl.co',

  // Ücretsiz uptime servisleri - bunlar da uygulamayı ayakta tutar
  // Ana servislere sadece kendi URL'inizi gönderin
  'https://discord-halisaha-manager.emilswd.repl.co/ping',
  'https://discord-halisaha-manager.emilswd.repl.co/keep-alive',
  'https://discord-halisaha-manager.emilswd.repl.co/api/health',
  
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
