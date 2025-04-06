
# UptimeRobot 503 Hatası Çözümü

UptimeRobot'ta aldığınız 503 hatası, genellikle sunucunun geçici olarak kullanılamadığını gösterir. Bu sorunu çözmek için aşağıdaki adımları izleyin:

## 1. Doğru URL'leri Kullanın

UptimeRobot'ta şu URL'leri kullanmalısınız:

```
https://discord-halisaha-manager.emilswd.repl.co/ping
https://discord-halisaha-manager.emilswd.repl.co/uptime.html
https://discord-halisaha-manager.emilswd.repl.co/api/health
```

## 2. UptimeRobot Ayarları

1. UptimeRobot hesabınıza giriş yapın
2. Mevcut monitörleri silin veya duraklatın
3. "Add New Monitor" butonuna tıklayın
4. Şu ayarları yapın:
   - Monitor Type: **HTTP(s)**
   - Friendly Name: "Discord Bot - Ana Ping"
   - URL: https://discord-halisaha-manager.emilswd.repl.co/ping
   - Monitoring Interval: **5 dakika**
   - Monitor Timeout: **30 saniye**
   - HTTP Method: **HEAD**

5. İkinci bir monitör daha ekleyin:
   - Monitor Type: **HTTP(s)**
   - Friendly Name: "Discord Bot - Uptime Page"
   - URL: https://discord-halisaha-manager.emilswd.repl.co/uptime.html
   - Monitoring Interval: **5 dakika**
   - Monitor Timeout: **30 saniye**
   - HTTP Method: **HEAD**

## 3. Uptime Servisi Çalıştırma

1. Replit projenizde yeni bir terminal açın
2. Şu komutu çalıştırın:
   ```
   node keep-alive-forever.js
   ```
3. Terminal penceresini KAPATMAYIN - bu servis çalışmaya devam etmeli

## 4. URL'lerin Doğru Çalıştığını Kontrol Edin

Bir web tarayıcıda şu URL'leri açarak test edin:
- https://discord-halisaha-manager.emilswd.repl.co/ping
- https://discord-halisaha-manager.emilswd.repl.co/uptime.html

Eğer bu sayfalar yükleniyorsa, UptimeRobot da onları ping'leyebilecektir.

## 5. Hata Devam Ederse

Eğer sorun devam ederse:

1. Replit'in URL'sini kontrol edin - bazen değişebilir
2. `keep-alive-forever.js` dosyasındaki `APP_URL` değişkenini güncelleyin
3. Uptime servisini yeniden başlatın
4. UptimeRobot'taki URL'leri de güncelleyin

## 6. Workflow Çalıştırma

Replit projenizde "UptimeService" workflow'unu çalıştırın. Bu, otomatik olarak uptime servisini başlatacaktır:

1. Sol panelde "Workflows" simgesine tıklayın
2. "UptimeService" workflow'unu bulun
3. "Run" butonuna tıklayın

Bu adımlar, UptimeRobot'taki 503 hatasını çözecektir.
