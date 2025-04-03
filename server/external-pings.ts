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
  'https://hetrixtools.com'
];
