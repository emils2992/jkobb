# 7/24 Çalışma Rehberi

Bu rehber, Discord botunuzu 7/24 çalışır halde tutmak için yapılandırma adımlarını içerir. İnternet bağlantınız olmasa bile bot çalışmaya devam edecektir.

## Yapılandırma Adımları

### 1. UptimeRobot Hesabı Oluşturun

1. [UptimeRobot.com](https://uptimerobot.com/) adresine gidin ve ücretsiz hesap oluşturun
2. Hesabınıza giriş yapın ve "Add New Monitor" butonuna tıklayın
3. Aşağıdaki ayarları kullanın:
   - Monitor Type: HTTP(s)
   - Friendly Name: Discord Bot Ping
   - URL: `https://discord-halisaha-manager.emilswd.repl.co/ping`
   - Monitoring Interval: 5 dakika

### 2. Birden Fazla Ping URL'si Ekleyin

Güvenilirliği artırmak için aşağıdaki URL'lerin hepsini farklı monitorlar olarak ekleyin:

1. `https://discord-halisaha-manager.emilswd.repl.co/ping`
2. `https://discord-halisaha-manager.emilswd.repl.co/uptime-check`
3. `https://discord-halisaha-manager.emilswd.repl.co/api/health`
4. `https://discord-halisaha-manager.emilswd.repl.co/` (Ana sayfa)

### 3. Replit Projesi Ayarları

Projenin sağlıklı çalışması için aşağıdaki dosyaların mevcut ve hatasız olduğundan emin olun:

1. `external-pings.ts` (Ping URL'leri)
2. `uptime.js` (Basit HTTP sunucusu)
3. `ping-handler.ts` (Gelişmiş uptime yöneticisi)
4. `keepalive.json` (Uptime yapılandırması)

## Nasıl Çalışıyor?

Bu sistem, aşağıdaki mekanizmaları kullanarak botun sürekli çalışmasını sağlar:

1. **Çoklu HTTP Sunucuları**: Farklı portlarda çalışan birden fazla HTTP sunucusu sayesinde, bir tanesi düşerse diğerleri hizmeti sürdürür.
2. **Disk Aktivitesi**: Düzenli olarak dosya yazarak Replit projesinin uykuya dalmasını engeller.
3. **UptimeRobot Ping**: Dış dünyadan düzenli olarak ping atılması ile proje aktif tutulur.
4. **Otomatik Kurtarma**: Herhangi bir sorun durumunda otomatik olarak kendini yeniden başlatır.
5. **Bellek Yönetimi**: Yüksek bellek kullanımını tespit edip garbage collection çağırarak stabiliteyi korur.

## Botun Durumunu Kontrol Etme

Botunuzun durumunu ve uptime istatistiklerini görmek için:

1. UptimeRobot.com hesabınıza giriş yapın
2. "Dashboard" sayfasına bakın
3. Son 24 saatteki, 7 gündeki ve 30 gündeki uptime yüzdelerini görebilirsiniz

## Sorun Giderme

Eğer bot çevrimdışı olursa:

1. Replit projenizi açın ve çalışır durumda olduğundan emin olun
2. Konsol loglarında herhangi bir hata mesajı olup olmadığını kontrol edin
3. Eğer proje çalışmıyorsa, "Run" butonuna basarak yeniden başlatın
4. UptimeRobot monitörlerinizi kontrol edin, "Paused" durumunda olmamalılar

## Önemli Notlar

- UptimeRobot'un ücretsiz sürümü 50 monitöre kadar izin verir ve 5 dakikada bir kontrol eder.
- Replit projelerinde bazen port çakışmaları olabilir. Eğer bir port hatası görürseniz, kodu düzenleyerek farklı bir port kullanabilirsiniz.
- Bot yalnızca Replit çevrimiçiyken çalışır, ancak bu yapılandırma ile Replit'in kendi kendine uyanık kalmasını sağlayacaksınız.
- Bu sistem, sizin bilgisayarınız veya internet bağlantınız kapalı olsa bile çalışmaya devam edecektir!

---

Bu dokümantasyonu, botunuzu nasıl 7/24 çalışır halde tutacağınıza dair bir referans olarak kullanabilirsiniz.
