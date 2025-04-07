# UptimeRobot Hızlı Kurulum Kılavuzu

Bu kılavuz, Discord botunuzun 7/24 çalışması için UptimeRobot servisini nasıl kullanacağınızı gösterir.

## Adım 1: UptimeRobot Hesabı Oluşturma

1. [UptimeRobot.com](https://uptimerobot.com) adresine gidin.
2. "Register for FREE" butonuna tıklayın.
3. Gerekli bilgileri doldurun ve hesabınızı oluşturun.
4. E-posta adresinize gelen onay e-postasını onaylayın.

## Adım 2: Yeni Bir Monitör Ekleme

1. UptimeRobot hesabınıza giriş yapın.
2. "Add New Monitor" butonuna tıklayın.
3. Monitor Type olarak **HTTP(s)** seçin.
4. Aşağıdaki bilgileri doldurun:
   - Friendly Name: "Discord Bot Uptime" (istediğiniz bir isim)
   - URL: Botunuzun URL'i (aşağıdaki formata uygun):
     ```
     https://REPL_ADI.REPL_SAHIBI.repl.co/ping
     ```
   - Monitoring Interval: 5 minutes (ücretsiz hesapta minimum değer)
5. "Create Monitor" butonuna tıklayın.

## Adım 3: Diğer Monitörler (Opsiyonel ama Önerilen)

Botunuzun kesintisiz çalışması için birden fazla kontrol noktası eklemek iyi bir fikirdir:

1. "Add New Monitor" butonuna tekrar tıklayın.
2. Aşağıdaki alternatif ping URL'lerini ekleyin (her biri için ayrı bir monitör):
   ```
   https://REPL_ADI.REPL_SAHIBI.repl.co/uptime-check
   https://REPL_ADI.REPL_SAHIBI.repl.co/api/health
   ```

## Adım 4: Monitor Ayarları

Her monitör için:

1. Advanced Settings bölümünü açın
2. "Alert when down for" kısmını "5 minutes" olarak ayarlayın (çok sık bildirim almamak için)
3. "Timeout" ayarını "30 seconds" olarak ayarlayın
4. "HTTP Basic Auth" kullanmayın, boş bırakın
5. "HTTP Method" kısmını "GET" olarak bırakın
6. "Monitor as a keyword" kısmını etkinleştirebilir ve "ONLINE" kelimesini aratabilirsiniz:
   - ✅ "Alert When" -> "The keyword exists"
   - Keyword value: "ONLINE"

## Adım 5: Bildirimler (İsteğe Bağlı)

1. "Alerts" sekmesini açın
2. "Add Alert Contact" butonuna tıklayın
3. İstediğiniz bildirim yöntemini seçin (e-posta, SMS, vb.)
4. Bilgileri doldurun ve "Create Alert Contact" butonuna tıklayın
5. Her monitör için istediğiniz bildirimleri etkinleştirin

## Önemli Notlar

- UptimeRobot ping'leri için ideal URL: `https://REPL_ADI.REPL_SAHIBI.repl.co/ping`
- Uygulamanız başladığında, URL'inizin doğru olduğundan emin olun
- Replit projesinde şu komutla çalışan URL'i görebilirsiniz:
  ```
  echo "$(echo $REPL_SLUG).$(echo $REPL_OWNER).repl.co"
  ```
- Proje adı veya kullanıcı adı değişirse UptimeRobot ayarlarınızı güncelleyin

## Sorun Giderme

- Eğer UptimeRobot monitörü "Paused" durumuna geçerse:
  1. Monitörü düzenleyin
  2. URL'in doğru olduğundan emin olun
  3. "Reset" ve ardından "Save" butonuna tıklayın
  
- UptimeRobot tarafından gösterilen durum her zaman doğru olmayabilir. Botunuzun gerçek durumunu kontrol etmek için şu URL'i ziyaret edin:
  ```
  https://REPL_ADI.REPL_SAHIBI.repl.co
  ```

## Diğer Notlar

- Ücretsiz UptimeRobot hesabı ile 5 dakikalık kontrol aralığı en düşük değerdir
- UptimeRobot her 5 dakikada bir kontrol yapacaktır, ancak bu botun aktif kalması için yeterlidir
- Botun 24/7 çalışması için Replit projenizin uyku moduna girmemesi gerekir
- Proje içindeki `ping-target-bot.js`, `keep-bot-online.js`, `always-running.js` ve `forever-uptime.sh` scriptleri bu konuda yardımcı olacaktır
