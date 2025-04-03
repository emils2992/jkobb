// Uygulamayı sürekli aktif tutmak için çeşitli ücretsiz ping servisleri
export const URLS = [
  // Replit'in kendi URL'i
  process.env.REPLIT_URL || 'https://discord-halisaha-manager.emilswd.repl.co',

  // Çalışan ana endpoint'ler
  'https://discord-halisaha-manager.emilswd.repl.co/ping',
  'https://discord-halisaha-manager.emilswd.repl.co/',
  'https://discord-halisaha-manager.emilswd.repl.co/health',

  // UptimeRobot'a ekleyebileceğiniz bu çalışan linkleri kullanın:
  'https://discord-halisaha-manager.emilswd.repl.co/ping',
  'https://discord-halisaha-manager.emilswd.repl.co/health',
  'https://discord-halisaha-manager.emilswd.repl.co/'
];