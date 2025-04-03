// Uygulamayı sürekli aktif tutmak için çeşitli ücretsiz ping servisleri
export const URLS = [
  // Ana URL (proje URL'si)
  'https://discord-halisaha-manager.emilswd.repl.co',
  
  // Sağlık kontrolü için URL'ler (bu URL'leri UptimeRobot'a ekleyebilirsiniz)
  'https://discord-halisaha-manager.emilswd.repl.co/ping',
  'https://discord-halisaha-manager.emilswd.repl.co/health',
  
  // Alternatif URL (eğer Replit domain değişirse)
  process.env.REPLIT_URL
].filter(Boolean); // undefined değerleri filtrele