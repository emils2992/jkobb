# SÜPER UPTIME ÇÖZÜMÜ (7/24 BOT ÇALIŞTIRMA)

Bu kılavuz, botunuzun **7/24 çalışması** için en güncel ve etkili çözümü sunar. Bu adımları takip ederek Replit'in uyku modunu minimum seviyede tutabilirsiniz.

## 1. ADIM: TÜM UPTIME SERVİSLERİNİ AKTİF ET

Aşağıdaki komutları Replit Shell'de sırasıyla çalıştırın:

```bash
# Ana botunuzu başlatın
bash forever-uptime.sh &
node keep-bot-online.js &
node always-running.js &
node super-enhanced-uptime.js &
```

## 2. ADIM: UPTIMEROBOT'U DOĞRU YAPILANDIR

UptimeRobot'u aşağıdaki adımlarla yapılandırın:

1. **UptimeRobot hesabınıza giriş yapın** (ücretsiz hesap yeterli)
2. **En az 5 farklı ping noktası ekleyin** (aşağıdaki örnekleri kullanın)
3. Tip olarak **kesinlikle HTTP(S)** seçin (PING DEĞİL!)
4. Her monitör için kontrol aralığını **5 dakika** olarak ayarlayın
5. Her monitör için timeout değerini **30 saniye** yapın (varsayılan çok düşük)

### Eklenecek URL'ler:

```
https://discord-halisaha-manager.emilswd.repl.co/ping
https://discord-halisaha-manager.emilswd.repl.co/uptime-check
https://discord-halisaha-manager.emilswd.repl.co/api/health
https://discord-halisaha-manager.emilswd.repl.co/always-online
https://discord-halisaha-manager.emilswd.repl.co/force-active
```

## 3. ADIM: FARKLI BİR CİHAZDAN DA PİNGLEYİN

UptimeRobot'a ek olarak, başka bir cihazdan da ping atın:

1. **Telefonunuza "Ping HTTP" uygulaması indirin**
   - Android: "HTTP Pinger" veya "Website Monitor"
   - iOS: "Uptime" veya "HTTP Ping"

2. **Aynı URL'leri bu uygulamaya da ekleyin**
   - Kontrol aralığını 15 dakika yapabilirsiniz
   - Bu şekilde UptimeRobot'un dışında ikinci bir güvenlik katmanı olacak

## 4. ADIM: GLİTCH.COM'DA YEDEK SERVİS OLUŞTURUN

Glitch, Replit'ten farklı bir uyku politikasına sahiptir. İki platform birbirini aktif tutabilir.

1. **Glitch.com'da yeni proje açın** (hello-node şablonu)
2. **Aşağıdaki kodu `server.js` dosyasına yapıştırın:**

```javascript
const express = require('express');
const fetch = require('node-fetch');
const app = express();

// UptimeRobot için ping noktası
app.get('/', (req, res) => {
  res.send('Uptime servisi çalışıyor');
});

// Replit projenizi pinglemek için
async function pingReplitProject() {
  try {
    const urls = [
      'https://discord-halisaha-manager.emilswd.repl.co/ping',
      'https://discord-halisaha-manager.emilswd.repl.co/uptime-check',
      'https://discord-halisaha-manager.emilswd.repl.co/api/health'
    ];
    
    // Her URL'yi 10 saniye arayla pingleyeceğiz
    for (const url of urls) {
      try {
        const nonce = Date.now();
        const res = await fetch(`${url}?nonce=${nonce}`);
        console.log(`${url} pinglendi: ${res.status}`);
      } catch (err) {
        console.error(`${url} pinglenemedi: ${err.message}`);
      }
      
      // 10 saniye bekle
      await new Promise(r => setTimeout(r, 10000));
    }
  } catch (error) {
    console.error('Ping işlemi başarısız: ' + error);
  }
}

// İlk çalıştırma
pingReplitProject();

// 3 dakikada bir tekrarla (180000 ms)
setInterval(pingReplitProject, 180000);

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Glitch uptime servisi port ${PORT}'de çalışıyor`);
});
```

3. **package.json dosyasını güncelleyin:**

```bash
npm init -y
npm install express node-fetch@2
```

4. **UptimeRobot'da Glitch projenizi de izleyin:**
   - Glitch URL'nizi UptimeRobot'a ekleyin (örn: https://proje-adiniz.glitch.me)

## 5. ADIM: GÜNLÜK KONTROLLER

Yine de arada bir kontrollerinizi yapın:

1. Her gün botunuzun durumunu kontrol edin
2. UptimeRobot panosundan monitoring durumunu takip edin
3. Sorun görürseniz projeyi yeniden başlatın

## NOT: REPLİT POLİTİKALARI HAKKINDA

Replit'in ücretsiz planlarda sunduğu hizmet, projelerin sürekli çalışması için tasarlanmamıştır. Yukarıdaki yöntemler politika değişikliklerinden etkilenebilir. En iyi sonuç için:

1. Herhangi bir uyarı gelirse (aşırı kaynak kullanımı vs.) dikkate alın
2. Mümkünse birden fazla Replit projesi oluşturup, bunları dönüşümlü olarak kullanmayı düşünün
3. En garanti çözüm, ücretli bir hosting hizmetine geçmektir

---

Bu adımları izleyerek botunuzun uptime süresini maksimuma çıkarabilirsiniz. Yine de arada bir kontrollerinizi yapmayı unutmayın.