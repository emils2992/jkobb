# Replit Discord Bot 7/24 Aktif Kalma Çözümü

Bu döküman, Discord botunuzu 7/24 aktif tutmak için geliştirilmiş tüm çözümleri içerir.

## 1. Sorunun Nedeni

Replit, belirli bir süre aktif kullanılmadığında projeleri uyku moduna alır. Bu durum, Discord botlarının kesintiye uğramasına neden olur. Ekstra zorluklar:

- URL'ler bazen değişebilir
- DNS çözümleme sorunları olabilir
- UptimeRobot gibi servisler cache'leme yapabilir
- Standart ping servisleri yeterli olmayabilir

## 2. ÇÖZÜM ADIMLARI

### A. Ana Uygulamayı Başlatın

```bash
# Run butonuna basın veya aşağıdaki komutu kullanın
npm run dev
```

Bu komut, hem web sunucusunu hem de Discord botunu başlatır.

### B. Super Uptime Servisini Çalıştırın

Yeni bir terminal (Shell) penceresi açın ve aşağıdaki komutu çalıştırın:

```bash
node keep-alive-forever.js
```

Bu script:
- Multiple endpoint'leri düzenli olarak ping eder
- Cache önleyici parametreler ekler
- Hata durumunda otomatik kurtarma yapar
- Durum izleme dashboard'u sunar
- Isınma etkisi için düzenli disk aktivitesi yapar

### C. UptimeRobot Yapılandırması

En az 3 URL'yi UptimeRobot'a ekleyin:
1. `https://[REPLIT-URL]/ping`
2. `https://[REPLIT-URL]/api/health`
3. `https://[REPLIT-URL]/always-online.html`

Ayarlar:
- **Monitor Type:** HTTP(s)
- **Monitoring Interval:** 5 dakika
- **Timeout:** 30 saniye

### D. URL Değişirse Ne Yapmalı?

Replit projenizin URL'si değişirse:
1. Konsoldaki çıktıyı kontrol edin (`https://[YENİ-URL]`)
2. `keep-alive-forever.js` dosyasındaki `APP_URL` değişkenini güncelleyin
3. UptimeRobot monitörlerini yeni URL ile güncelleyin

## 3. TEK-TIKLA ÇÖZÜM

1. Ana uygulamayı çalıştırın
2. Yeni terminal açın ve şu komutu çalıştırın:
   ```bash
   node keep-alive-forever.js
   ```
3. https://[REPLIT-URL]/always-online.html adresini kontrol edin
4. Bu URL'yi UptimeRobot'a ekleyin

## 4. SORUN DEVAM EDERSE

1. Replit projenizi yeniden başlatın (Restart butonu)
2. Aşağıdaki komutla projenin aktif olduğunu kontrol edin:
   ```bash
   curl -I https://[REPLIT-URL]/ping
   ```
3. Hala sorun varsa, DNS çözümleme bilgilerini kontrol edin:
   ```bash
   nslookup [REPLIT-URL]
   ```

## 5. UPTIME ROBOT KURULUM ADIMLARI

1. UptimeRobot.com'a kaydolun
2. "Add New Monitor" butonuna tıklayın
3. Monitor Type: "HTTP(s)" seçin
4. Friendly Name: "Discord Bot Uptime" girin
5. URL: https://[REPLIT-URL]/always-online.html yazın
6. Monitoring Interval: 5 dakika seçin
7. "Create Monitor" butonuna tıklayın
8. Aynı adımları farklı URL'ler için tekrarlayın:
   - https://[REPLIT-URL]/ping
   - https://[REPLIT-URL]/api/health

Bu yapılandırma, Discord botunuzun 7/24 aktif kalmasını büyük ölçüde garantileyecektir.