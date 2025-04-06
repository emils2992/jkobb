export const URLS = [
  // Ana endpoint'ler
  "https://discord-halisaha-manager.emilswd.repl.co",
  "https://discord-halisaha-manager.emilswd.repl.co/ping",
  "https://discord-halisaha-manager.emilswd.repl.co/uptime-check",
  "https://discord-halisaha-manager.emilswd.repl.co/api/health",
  
  // UptimeRobot "pause" sorunu çözümü için HTML formatında ping
  "https://discord-halisaha-manager.emilswd.repl.co/ping-html",
  
  // Cached yanıtları önlemek için query parametreleri
  "https://discord-halisaha-manager.emilswd.repl.co/ping?nocache=1",
  "https://discord-halisaha-manager.emilswd.repl.co/ping?random=" + Math.random(),
  "https://discord-halisaha-manager.emilswd.repl.co/ping?ts=" + Date.now(),
  
  // Alternatif portlar (yedek sunucular)
  "https://discord-halisaha-manager.emilswd.repl.co:8066/status",
  "https://discord-halisaha-manager.emilswd.repl.co:9988/ping"
];
