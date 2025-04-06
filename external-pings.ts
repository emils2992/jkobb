// Bu dosya, başka uptime servislerinin ping atacağı URL'leri içerir
// Bu URL'lere periyodik olarak ping atılarak uygulamanın uyanık kalması sağlanır

export const URLS = [
  "https://discord-halisaha-manager.emilswd.repl.co/ping-html",
  "https://discord-halisaha-manager.emilswd.repl.co/always-online",
  "https://discord-halisaha-manager.emilswd.repl.co/super-uptime.html",
  "https://discord-halisaha-manager.emilswd.repl.co/uptime-status.html",
  "https://discord-halisaha-manager.emilswd.repl.co/uptime-check?ts=" + Date.now(),
];
