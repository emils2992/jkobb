# Replit Uptime URL'leri

Botunuzu 7/24 aktif tutmak için bu URL'leri UptimeRobot'a ekleyin.

## UptimeRobot'a eklenecek URL'ler:

1. `https://discord-halisaha-manager.emilswd.repl.co/ping`
2. `https://discord-halisaha-manager.emilswd.repl.co/uptime-check`
3. `https://discord-halisaha-manager.emilswd.repl.co/api/health`
4. `https://discord-halisaha-manager.emilswd.repl.co/` (Ana sayfa)

## UptimeRobot Kurulumu:

1. [UptimeRobot.com](https://uptimerobot.com/) sitesine gidin
2. Ücretsiz bir hesap oluşturun (ücretli plana gerek yok)
3. Giriş yaptıktan sonra "Add New Monitor" butonuna tıklayın
4. Her bir URL için bir monitör ekleyin:
   - Monitor Type: HTTP(s)
   - Friendly Name: Discord Bot - Ping URL (ya da istediğiniz isim)
   - URL: Yukarıdaki URL'lerden birini girin
   - Monitoring Interval: 5 dakika

## Önemli Notlar:

- UptimeRobot ile birden fazla monitor oluşturarak (farklı URL'ler ile) daha sağlam bir uptime yönetimi sağlarsınız.
- Tüm URL'leri eklemek önerilir, böylece birisi çalışmadığında diğerleri devreye girer.
- Bot restart olursa bile kendi kendine uptime sistemimiz aktif olur.
- Ek olarak özel uptime.js ve ping-handler.ts servisleri de aktiftir - bunlar internet bağlantısı olmadan bile botun aktif kalmasını sağlar.

## Yeni Güçlendirilmiş Uptime Sistemi:

Bu proje artık şu uptime sistemlerini kullanıyor:
1. **Ana Express sunucusu** - Webhook/ping URL'leri sağlar
2. **uptime.js** - Özel yedek HTTP sunucusu (Port 8123)
3. **ping-handler.ts** - TypeScript tabanlı gelişmiş uptime sistemi
4. **Disk aktivite servisi** - Düzenli olarak dosya yazarak sistemin uyanık kalmasını sağlar
5. **Çoklu ping URL'leri** - Farklı endpoint'ler ile uptime güvenilirliği

**Ücretsiz UptimeRobot hesabı, 50 monitöre kadar izin verir ve 5 dakikada bir kontrol eder. Bu, projemiz için yeterlidir.**

(Not: Bu sistemlerin hepsi sizin internet bağlantınız olmasa bile çalışmaya devam eder!)
