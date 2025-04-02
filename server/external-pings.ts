/**
 * UptimeRobot ve diğer harici ping servislerinin URL'lerini içeren konfigürasyon dosyası
 */

// URL'leri aşağıdaki array'e ekleyin (örneğin UptimeRobot ve Cron-job.org)
export const URLS = ['https://uptimerobot.com', 'https://cron-job.org'];

// UptimeRobot için Rehber:
// 1. https://uptimerobot.com adresine gidin ve ücretsiz hesap oluşturun
// 2. "Add New Monitor" butonuna tıklayın
// 3. "Monitor Type" olarak "HTTP(s)" seçin
// 4. "Friendly Name" alanına "Discord Bot" veya "Web Panel" gibi bir isim girin
// 5. "URL (or IP)" alanına Replit URL'nizi girin, sonuna "/uptime-check" veya "/ping" ekleyin
// 6. Ping Interval'i "5 minutes" olarak ayarlayın (ücretsiz plan için minimum süre)
// 7. "Create Monitor" butonuna tıklayarak tamamlayın

// Not: UptimeRobot, 5 dakikada bir ping atar ve uygulamanızın sürekli aktif kalmasını sağlar.
// Chrome tarayıcınızı kapatsanız bile uygulamanız çalışmaya devam edecektir.