# Cron-Job.org Kurulum Rehberi

UptimeRobot ile yaşanan sorunlar için daha güvenilir bir alternatif: **Cron-Job.org**

## Neden Cron-Job.org?

1. **Daha güvenilir:** Replit projeleriyle daha iyi çalışır, UptimeRobot'ta görülen "pause" sorunu oluşmaz
2. **Daha fazla ping seçeneği:** HTTP ve PING çağrıları dahil birçok seçenek sunuyor
3. **Esnek zamanlama:** Özel cron programları oluşturabilirsiniz
4. **Tamamen ücretsiz:** Temel ihtiyaçlar için ücretsiz plan yeterlidir

## Kurulum Adımları

1. [Cron-Job.org](https://cron-job.org) sitesine gidin
2. Ücretsiz bir hesap oluşturun
3. Giriş yaptıktan sonra "Create Cronjob" butonuna tıklayın
4. Her bir URL için bir cronjob oluşturun:

### URL'ler (Tümünü ekleyin)
```
https://discord-halisaha-manager.emilswd.repl.co/ping
https://discord-halisaha-manager.emilswd.repl.co/ping-html
https://discord-halisaha-manager.emilswd.repl.co/uptime-check
https://discord-halisaha-manager.emilswd.repl.co/api/health
https://discord-halisaha-manager.emilswd.repl.co/
```

### Ayarlar
- **Title**: Discord Bot - Ping (veya istediğiniz bir isim)
- **URL**: Yukarıdaki URL'lerden birini girin
- **Schedule**: */5 * * * * (Her 5 dakikada bir)
- **Fetch interval (Advanced)**: 5 dakika
- **HTTP Method**: GET
- **Authentication**: None
- **Notification**: Failed jobs only (opsiyonel)
- **Status**: Aktif

## UptimeRobot'tan Cron-Job.org'a Geçiş

UptimeRobot ile sorun yaşadığınız için Cron-Job.org'u kurmanız önerilir. Her iki servisi de bir süre paralel olarak kullanabilir, sonra UptimeRobot'u durdurabilirsiniz.

## Önemli Notlar

1. Tüm URL'leri eklemek önemlidir - her biri sistemin farklı bir parçasını aktif tutar
2. Özellikle `/ping-html` ve `/uptime-check` endpoint'leri cache sorunlarını çözmek için tasarlanmıştır
3. Birkaç URL eklemek yeterlidir, hepsini tek tek eklemeniz gerekmez
4. Zaman aralığını 5 dakikadan daha kısa ayarlamak, hesabınızın kısıtlanmasına neden olabilir

## Sorun Giderme

1. "Paused" veya "Duraklatıldı" hataları alıyorsanız, Cron-Job.org diğer birkaç URL'ye geçin
2. Hala sorun yaşıyorsanız, Replit projenizde uptime.js dosyasını açın ve doğru URL'leri ayarladığınızdan emin olun
3. Replit projenizin uyku moduna geçmemesi için şu komutları kontrol edin:
```bash
node uptime.js &
```

## İleri Seviye - Çoklu Monitör Stratejisi

En iyi sonuç için:
1. Her iki servisten de (UptimeRobot ve Cron-Job.org) 2-3 URL izleyin
2. Farklı URL'lere farklı kontrol süreleri ayarlayın (5, 10, 15 dakika gibi)
3. Böylece servislerden biri çalışmasa bile diğeri botunuzu aktif tutar

---

Bu rehber, botunuzun 7/24 çalışması için en güvenilir yapılandırmayı sağlar. Hem UptimeRobot hem de Cron-Job.org'u kullanarak maksimum uptime elde edebilirsiniz. Sorun yaşamaya devam ederseniz, UptimeRobot yerine tamamen Cron-Job.org'a geçmeniz önerilir.
