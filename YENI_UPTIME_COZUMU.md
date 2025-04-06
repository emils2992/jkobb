
# Ücretsiz 7/24 Bot Aktif Tutma - Kesin Çözüm

Bu döküman, Discord botunuzu Replit'te tamamen ücretsiz olarak 7/24 aktif tutmak için **kesin çözümü** içerir.

## Çalışma Prensibi

Bu sistem şu şekilde çalışır:
1. Ana bot workflow'u ile bot normal şekilde çalışır
2. UptimeRobot, özel hazırlanmış HTML sayfayı düzenli olarak ping atar
3. Replit'in uyku moduna geçmesini engellemek için sayfa kendini otomatik yeniler
4. Sayfa cachlenmeyi önleyen mekanizmalar içerir

## Kurulum Adımları (En Basit Yöntem)

1. **Botu Çalıştır**
   - "UptimeBot" workflow'unu çalıştır (Run butonuna bas)
   - Bu workflow Discord botunu başlatır

2. **UptimeRobot'u Ayarla**
   - [UptimeRobot](https://uptimerobot.com)'a ücretsiz kaydol
   - "Add New Monitor" tıkla
   - Aşağıdaki bilgileri gir:
     * Monitor Type: **HTTP(s)**
     * Friendly Name: Discord Bot
     * URL: **https://discord-halisaha-manager.emilswd.repl.co/always-online.html**
     * Monitoring Interval: **5 minutes**

3. **İki Yedek URL Daha Ekle**
   Bu URL'leri de UptimeRobot'ta ayrı monitörler olarak ekle:
   - **https://discord-halisaha-manager.emilswd.repl.co/ping**
   - **https://discord-halisaha-manager.emilswd.repl.co/uptime-check**

## Çalıştığını Doğrulama

1. UptimeRobot'ta monitörlerin yeşil renkte olduğunu kontrol et
2. Bir tarayıcıda şu adresi aç:
   `https://discord-halisaha-manager.emilswd.repl.co/always-online.html`
3. Yeşil bir nokta ve "AKTİF" yazısını görmelisin

## Sorun Giderme

503 hatası alıyorsan:
1. Replit projesini yeniden başlat (Run butonu)
2. UptimeRobot monitörlerini duraklatıp yeniden etkinleştir

## Notlar

- Bu çözüm, **port 5000 ping sorununu atlatmak** için özel olarak tasarlanmıştır
- HTML sayfası kendini düzenli olarak yeniler, böylece UptimeRobot her zaman taze cevap alır
- Sayfaya eklenen rastgele ID'ler ve zaman damgaları caching sorunlarını önler
- Discord botunun ana dosyalarıyla doğrudan entegre çalışır

Bu talimatları izlerseniz, Discord botunuz kesintisiz çalışacaktır.
