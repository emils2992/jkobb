# Discord Bot 7/24 Aktif Tutma Rehberi

Bu rehber, Discord botunuzu Replit üzerinde tamamen ücretsiz olarak 7/24 aktif tutmak için gereken adımları içermektedir.

## Oluşturulan Dosyalar

1. **keep-bot-online.js**: Ana uptime servisi, kendi kendine çalışır ve botunuzu aktif tutar
2. **ping-target-bot.js**: Kullanıcının belirttiği URL'yi ping'ler
3. **public/always-online.html**: UptimeRobot için HTML sayfası

## Nasıl Kullanılır

### 1. Uptime Servisini Başlatın
```
node keep-bot-online.js
```

Bu komut, botunuzu aktif tutacak ana servisi başlatır. Servisi çalıştırdıktan sonra terminal penceresini kapatmayın.

### 2. Hedef Botu Ping'leyin
```
node ping-target-bot.js
```

Bu komut, belirlediğiniz URL'ye düzenli ping atar.

### 3. UptimeRobot Ayarları

1. https://uptimerobot.com adresine gidin
2. Ücretsiz bir hesap oluşturun
3. "Add New Monitor" tıklayın
4. Aşağıdaki ayarları yapın:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: Discord Bot (istediğiniz isim)
   - **URL**: https://discord-halisaha-manager.emilswd.repl.co/always-online.html
   - **Monitoring Interval**: 5 minutes

### 4. Önemli Bilgiler

- Replit, 1 saat hareketsizlik sonrasında uyku moduna geçer
- Bu betikler, disk aktivitesi oluşturarak uyku moduna geçmeyi engeller
- UptimeRobot, her 5 dakikada bir ping atarak projenin uyanık kalmasını sağlar
- İdeal sonuç için her gün bir kez "Run" butonuna basın