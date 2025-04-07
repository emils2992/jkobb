# UptimeRobot Kurulum ve Çözüm Kılavuzu

Bu kılavuz, Discord botunuzun 7/24 çalışmasını sağlamak için UptimeRobot ayarlarını nasıl yapılandıracağınızı adım adım açıklar.

## Sorun: Bot Kapatılıyor

Replit ücretsiz hesaplarda, siz tarayıcıyı kapadığınızda veya 1 saat boyunca aktif istek olmazsa proje uyku moduna geçer. Bu durum botunuzun kapanmasına yol açar.

## Çözüm: UptimeRobot ile 7/24 Aktif Tutma

UptimeRobot, web sitelerini izleyen ücretsiz bir servistir. Bu servis, botunuzu düzenli olarak "ping" yaparak aktif kalmasını sağlar.

## Adım 1: UptimeRobot Hesabı Oluşturma

1. [UptimeRobot](https://uptimerobot.com/) web sitesine giriş yapın (ücretsiz kayıt olabilirsiniz)
2. Hesabınıza giriş yapın

## Adım 2: Yeni Monitör Ekleme

1. **"Add New Monitor"** (Yeni Monitör Ekle) butonuna tıklayın
2. **"Monitor Type"** (Monitör Tipi) olarak **HTTP(S)** seçin (**NOT: PING değil!**)
3. **"Friendly Name"** (İsim) kısmına "Discord Bot" yazabilirsiniz
4. **"URL (or IP)"** kısmına aşağıdaki URL'lerden birini ekleyin:

```
https://discord-halisaha-manager.emilswd.repl.co/ping
https://discord-halisaha-manager.emilswd.repl.co/uptime-check
https://discord-halisaha-manager.emilswd.repl.co/api/health
https://discord-halisaha-manager.emilswd.repl.co/always-online
https://discord-halisaha-manager.emilswd.repl.co/force-active
```

5. **"Monitoring Interval"** (Kontrol Aralığı) olarak **5 dakika** seçin
6. **"Create Monitor"** (Monitör Oluştur) butonuna tıklayın

## Adım 3: Ek Monitörler (Yedek) Ekleme

UptimeRobot'ta 50 ücretsiz monitör hakkınız var. Botunuzun daha güvenli çalışması için birden fazla monitör ekleyin:

1. **"Add New Monitor"** butonuna tekrar tıklayın
2. Yukarıdaki adımları tekrarlayın, ancak farklı bir URL seçin (yukarıdaki URL listesinden)
3. En az 2-3 farklı endpoint için monitör oluşturmanız önerilir

## Adım 4: Kontrollerinizi Yapın

1. UptimeRobot kontrol panelinde monitörlerinizin yanında yeşil bir "UP" (Aktif) yazısı görmelisiniz
2. Birkaç dakika bekleyin ve Replit projenizde konsolda hata mesajı olmadığından emin olun

## Adım 5: Botunuzu Test Edin

1. Discord sunucunuzda bot komutlarını test edin, düzgün çalıştığından emin olun
2. Replit sekmesini kapatın ve birkaç dakika sonra tekrar kontrol edin - bot hala aktif olmalı

## Sorun Giderme

### Bot Yine de Çalışmıyorsa:

1. **URL Kontrolü**: URL'nin doğru olduğundan emin olun (üstteki URL'lerin başında `https://` olduğunu unutmayın)
2. **Monitör Tipi**: Monitör tipi **HTTP(S)** olmalıdır, **PING** değil!
3. **Aralık Kontrolü**: Kontrol aralığının 5 dakika olduğundan emin olun
4. **Birden Fazla Monitör**: En az 2-3 farklı endpoint için monitör oluşturun

### Ek Sorun Giderme Adımları:

1. **Replit'te Çalışıyor mu?**: Replit'te "Run" butonuna basın ve uygulamanın doğru başlatıldığından emin olun
2. **Logları Kontrol Edin**: Replit'teki konsolda hata mesajlarına bakın
3. **Bot Token Kontrolü**: Discord bot token'ınızın doğru ve geçerli olduğunu kontrol edin

## Neden Bu Kadar Karmaşık?

Replit, ücretsiz hesaplarda programların sürekli çalışmasını kısıtlar. Bu sistem, bu kısıtlamaları aşmak için tasarlanmıştır:

1. **Çoklu Ping Noktaları**: Birden fazla endpoint, daha yüksek güvenilirlik sağlar
2. **Önbellek Önleme**: Her istek benzersiz parametrelerle gönderilir, böylece Replit her seferinde gerçekten çalışır
3. **Arka Plan Servisleri**: Eklediğimiz servisler, botunuzun arka planda kendini izler ve sorun olursa yeniden başlatır

## Son Notlar

Bu sistem, ücretsiz hesaplarda 7/24 bot çalıştırmak için tasarlanmıştır. Ancak, yine de arada bir Replit projenizi kontrol etmeniz önerilir. Herhangi bir sorun yaşarsanız, "Run" butonuna basarak yeniden başlatabilirsiniz.

UptimeRobot'u bir kez doğru şekilde ayarladıktan sonra botunuz sürekli çalışacaktır! 🎉