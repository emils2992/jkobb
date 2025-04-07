
# Discord Bot Uptime Sorunu Çözümü

Bu rehber, Discord botunuzu 7/24 aktif tutmak için kapsamlı bir çözüm sunmaktadır.

## Neden Bot Kapanıyor?

Replit, belirli bir süre hareketsiz kalan projeleri uyku moduna alır. Bu durum Discord botunuzun kapanmasına neden olur. Ayrıca, Replit'in sunucu bakımları ve sistem güncellemeleri sırasında da geçici kesintiler olabilir.

## ⭐ ÖNERİLEN ÇÖZÜM

Aşağıdaki adımları izleyerek botunuzu 7/24 aktif tutabilirsiniz:

### 1. Bot ve Super Uptime Service'i Başlatın

İki terminal açın ve aşağıdaki workflow'ları çalıştırın:

- Terminal 1: "UptimeBot" workflow'unu çalıştırın (ana bot)
- Terminal 2: "SuperUptimeService" workflow'unu çalıştırın

### 2. UptimeRobot Ayarları

UptimeRobot.com'da bir hesap oluşturun (ücretsiz) ve aşağıdaki URL'leri ekleyin:

- `https://discord-halisaha-manager.emilswd.repl.co/always-online.html`
- `https://discord-halisaha-manager.emilswd.repl.co/ping`
- `https://discord-halisaha-manager.emilswd.repl.co:5000/ping` (Super Uptime Service)
- `https://discord-halisaha-manager.emilswd.repl.co/uptime-check`

UptimeRobot ayarları:
- Monitor Type: HTTP(s)
- Monitoring Interval: 5 dakika
- Timeout: 30 saniye

## Sorun Giderme

Bot kapanmaya devam ederse:

1. Tüm terminal pencerelerini kapatın
2. Replit'i yeniden başlatın (Run butonuna basın)
3. UptimeBot workflow'unu çalıştırın
4. SuperUptimeService workflow'unu çalıştırın  
5. UptimeRobot monitörlerini duraklatıp tekrar etkinleştirin

## Nasıl Çalışır?

Bu sistem şu özellikleri içerir:

1. **Super Uptime Service (Port 5000)**: 
   - Otomatik yeşil tık simülasyonu
   - 5 dakikada bir tüm endpoint'leri kontrol eder
   - Tarayıcı kapansa bile çalışır

2. **UptimeRobot Servisi**:
   - Harici olarak projenizi düzenli ping'ler
   - Replit'in uyku moduna girmesini engeller

3. **HTML Uptime Sayfaları**:
   - Otomatik yenilenen web sayfaları
   - Cache önleyici mekanizmalar
   - Düzenli arka plan ping'leri

## Kontrol Paneli

Super Uptime Service'in kontrol panelini görüntülemek için:
```
https://discord-halisaha-manager.emilswd.repl.co:5000/ping
```

Bu sayfada botun durumunu ve uptime istatistiklerini görebilirsiniz.
