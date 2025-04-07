# UptimeRobot Kurulum Kılavuzu

Bu kılavuz, Discord botunuzun Replit'te 7/24 çalışması için UptimeRobot'un nasıl kurulacağını adım adım açıklar.

## Sorun Nedir?

Replit ücretsiz hesaplarda projeler, bir süre sonra uyku moduna geçer ve bot çalışmayı durdurur. UptimeRobot ile bu durumu çözebilirsiniz.

## Adım 1: UptimeRobot Hesabı Oluşturma

1. [UptimeRobot](https://uptimerobot.com/) web sitesine gidin
2. Ücretsiz bir hesap oluşturun
3. E-postanızı doğrulayın ve hesabınıza giriş yapın

## Adım 2: Yeni Monitör Ekleme

1. Dashboard'da **"Add New Monitor"** (Yeni Monitör Ekle) butonuna tıklayın
2. **"Monitor Type"** (Monitör Tipi) olarak **HTTP(S)** seçin (**KESİNLİKLE** PING DEĞİL!)
3. **"Friendly Name"** (İsim) kısmına "Discord Bot" yazabilirsiniz
4. **"URL (or IP)"** kısmına aşağıdaki URL'lerden BİRİNİ ekleyin:

```
https://discord-halisaha-manager.emilswd.repl.co/ping
https://discord-halisaha-manager.emilswd.repl.co/uptime-check
https://discord-halisaha-manager.emilswd.repl.co/api/health
https://discord-halisaha-manager.emilswd.repl.co/always-online
https://discord-halisaha-manager.emilswd.repl.co/force-active
```

5. **"Monitoring Interval"** (Kontrol Aralığı) olarak **5 dakika** seçin (bu en kısa ücretsiz aralık)
6. Diğer ayarları varsayılan bırakın
7. **"Create Monitor"** (Monitör Oluştur) butonuna tıklayın

## Adım 3: Yedek Monitörler Ekleme (ÖNEMLİ!)

Botunuzun daha güvenilir çalışması için birden fazla monitör ekleyin:

1. **"Add New Monitor"** butonuna tekrar tıklayın
2. Yukarıdaki adımları tekrarlayın, ancak farklı bir URL seçin
3. Bu işlemi en az 2-3 farklı URL için tekrarlayın
4. Bu şekilde tüm URL'leri izleyerek daha güvenilir bir uptime sağlayabilirsiniz

## Adım 4: Doğrulama ve Test

1. Tüm monitörler ekledikten sonra, birkaç dakika bekleyin
2. Dashboard'da monitörlerin yanında yeşil renkli **"UP"** yazısı görmelisiniz
3. Discord botunuzu test edin, komutların çalıştığından emin olun
4. Replit sekmesini kapatıp birkaç dakika sonra Discord'da botu test edin - hala çalışıyor olmalı

## Sorun Giderme

Monitör çalışmıyorsa veya bot yine de kapanıyorsa:

1. **URL Formatı**: URL'lerin başında `https://` olduğundan emin olun
2. **Monitör Tipi**: Kesinlikle "HTTP(S)" tipi seçin, "PING" değil!
3. **Kontrol Aralığı**: 5 dakika olarak ayarlayın
4. **URL Önbelleği**: Tarayıcınızın önbelleğini temizleyin ve URL'yi manuel olarak test edin
5. **Çoklu Monitör**: En az 2-3 farklı endpoint için monitör ekleyin
6. **Replit'i Yeniden Başlatın**: Gerekirse Replit projenizde "Run" butonuna tıklayarak yeniden başlatın

## Ek Bilgiler

- UptimeRobot ücretsiz planında 50 monitör hakkınız var
- Projenize eklediğimiz özel uptime servisleri, botunuzu otomatik olarak kurtarmaya çalışır
- UptimeRobot+özel servislerin birlikte çalışması, botunuzun 7/24 aktif kalmasını sağlar
- Otomatik ping scriptleriyle beraber, bu sistem oldukça güvenilirdir

## Sonuç

Bu adımları tamamladıktan sonra, Discord botunuz Replit ücretsiz hesapta bile 7/24 çalışabilir duruma gelecektir. Replit URL'niz değişse bile, sistem otomatik olarak bunu algılayıp adapte olacaktır.