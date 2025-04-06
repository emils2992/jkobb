# UptimeRobot "Pause" Sorunu Çözümü

UptimeRobot'un "All monitors are paused" sorunu için geliştirilmiş çözüm.

## Sorun Nedir?

UptimeRobot, bazen aşağıdaki şekilde davranabilir:
- Ping yanıtlarını önbelleğe (cache) alır
- Aynı yanıtı sürekli aldığını düşünür
- "Pause" durumuna geçer ve monitörleri durdurur

## Yapılan İyileştirmeler

Bu sorunu çözmek için aşağıdaki iyileştirmeler yapılmıştır:

### 1. Cache Önleme Header'ları

Tüm ping endpoint'leri şu cache önleme başlıklarını kullanır:
```
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Pragma: no-cache
Expires: 0
Surrogate-Control: no-store
```

### 2. HTML Formatında Ping Endpoint'i

`/ping-html` endpoint'i özellikle UptimeRobot için eklenmiştir:
- HTML formatında yanıt verir (JSON yerine)
- Rastgele değişen içerik içerir
- Renk ve stil içerir (UptimeRobot'un analizini iyileştirir)

### 3. Rastgele Değerler

Tüm ping yanıtları şu rastgele değerleri içerir:
- random_id: Her istekte benzersiz rastgele ID
- timestamp: Milisaniye cinsinden zaman damgası
- Rastgele sorgu parametreleri: ?random=, ?ts=, ?nocache=

### 4. Yedek HTTP Sunucuları

Birden fazla port üzerinde yedek HTTP sunucuları çalıştırılır:
- Ana Express sunucusu (varsayılan port)
- Yedek sunucu 1 (Port 8066)
- Ping sunucusu (Port 9988)

## UptimeRobot'ta Yapılması Gerekenler

1. Monitörlerinizi yeniden yapılandırın:
   - İzleme aralığını 5 dakika olarak ayarlayın
   - HTTP metodu olarak GET kullanın
   - Mevcut monitörleri silin ve yeniden ekleyin

2. En güvenilir endpoint'leri kullanın:
   - `https://discord-halisaha-manager.emilswd.repl.co/ping-html` (En güvenilir)
   - `https://discord-halisaha-manager.emilswd.repl.co/ping?nocache=1`
   - `https://discord-halisaha-manager.emilswd.repl.co/uptime-check`

3. Sorgu parametresi ekleyin:
   - UptimeRobot ayarlarında URL'e `?nocache=1` veya `?ts=123` gibi eklemeler yapın

## Cron-Job.org Alternatifi

UptimeRobot ile sorun yaşamaya devam ederseniz, [Cron-Job.org](https://cron-job.org/) kullanmayı deneyebilirsiniz:
- Ücretsiz hesap oluşturun
- 5 dakikalık aralıklarla aynı URL'leri izleyin
- Replit projelerine daha iyi uyum sağlayan bir servistir

## Sorun Devam Ederse

Sorun devam ederse:
1. Hem UptimeRobot hem de Cron-Job.org'u paralel kullanın
2. Replit projenizi her saat tetiklemek için ek bir cron job oluşturun
3. Replit'teki şu komutu çalıştırarak el ile başlatın: `node uptime.js &`

---

Bu rehberdeki iyileştirmeler, UptimeRobot'un "paused" durumuna geçmesini önlemek için özel olarak tasarlanmıştır. Sorun yaşamaya devam ederseniz, özellikle yeni eklenen `/ping-html` endpoint'ini kullanmayı deneyin.
