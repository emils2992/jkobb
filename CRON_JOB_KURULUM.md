# Cron-Job.org ile Uptime Çözümü

UptimeRobot pause problemi yaşıyorsanız, Cron-Job.org alternatif bir çözüm sunabilir.

## Adım 1: Cron-Job.org'a Kaydolun

1. [Cron-Job.org](https://cron-job.org) adresine gidin
2. Ücretsiz bir hesap oluşturun

## Adım 2: Yeni Bir Cron Job Ekleyin

1. Giriş yaptıktan sonra "Cronjobs" menüsüne tıklayın
2. "Create cronjob" butonuna tıklayın
3. Aşağıdaki bilgileri girin:
   - **Title**: Discord Bot Uptime
   - **URL**: https://discord-halisaha-manager.emilswd.repl.co/ping?random=123
   - **Schedule**: "Every 5 minutes" seçin
   - **Notifications**: İsteğe bağlı olarak başarısız olursa bildirim gönderilmesini seçebilirsiniz

4. "Create" butonuna tıklayın

## Adım 3: Daha Fazla Endpoint Ekleyin (İsteğe Bağlı)

Aşağıdaki URL'ler için de benzer şekilde cronjob'lar oluşturabilirsiniz:

- https://discord-halisaha-manager.emilswd.repl.co/ping-html
- https://discord-halisaha-manager.emilswd.repl.co/api/health
- https://discord-halisaha-manager.emilswd.repl.co/uptime-check

## Önemli Notlar

- UptimeRobot'tan farklı olarak, Cron-Job.org genellikle Replit'in ücretsiz sürümüyle daha uyumlu çalışır
- Her 5 dakikada bir ping atarak projenizi uyanık tutacaktır
- Örnek URL'lerdeki değerler kesin URL'lerinizi yansıtmıyorsa lütfen kendi Replit URL'lerinizle değiştirin

## Alternatif Yöntem: UptimeRobot'ta Özel HTTP Header Kullanımı

UptimeRobot'u yine de kullanmak isterseniz, aşağıdaki ayarları deneyin:

1. UptimeRobot'ta monitör ayarlarından "Edit" butonuna tıklayın
2. "Advanced Settings" bölümünü genişletin
3. "Custom HTTP Headers" kısmına şunları ekleyin:
   ```
   User-Agent: UptimeRobot/2.0
   Cache-Control: no-cache, no-store, must-revalidate
   Pragma: no-cache
   ```
4. "Save" butonuna tıklayın

Bu ayarlar, Replit'in güvenlik sistemlerinin UptimeRobot isteklerini engellemesini önlemeye yardımcı olabilir.