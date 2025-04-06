
# Özel Port (5000) Uptime Çözümü

Bu rehber, Discord botunuzu özelleştirilmiş port üzerinden 7/24 aktif tutmak için oluşturulmuştur.

## 1. Ayarladığınız Özel Uptime Hizmetleri

1. **Özel Port Sunucusu (5000)**
   - URL: https://9f27368b-0b17-4ac7-8928-fc20e6cf4a11-00-exkoqowlthzq.sisko.replit.dev:5000/ping
   - Dosya: `custom-uptime-server.js`

2. **Workflow**
   - İsim: `CustomUptimeServer`
   - Bu workflow özel uptime sunucunuzu başlatır

## 2. Nasıl Kullanılır

1. Replit panelinden "CustomUptimeServer" workflow'unu başlatın
2. Tarayıcıdan test edin: https://9f27368b-0b17-4ac7-8928-fc20e6cf4a11-00-exkoqowlthzq.sisko.replit.dev:5000/ping

## 3. UptimeRobot'a Eklemek İçin

UptimeRobot'ta aşağıdaki URL'yi izlemeye alın:
```
https://9f27368b-0b17-4ac7-8928-fc20e6cf4a11-00-exkoqowlthzq.sisko.replit.dev:5000/ping
```

Ayarlar:
- Monitor Type: HTTP(s)
- Friendly Name: Discord Bot - Port 5000
- Monitoring Interval: 5 dakika

## 4. Sorun Giderme

Eğer özel port sunucunuz çalışmayı durdurursa:
1. Replit panelinden "CustomUptimeServer" workflow'unu yeniden başlatın
2. Tarayıcıdan test edin
3. Gerekirse "UptimeService" workflow'unu da yeniden başlatın

Bu özel port çözümü, ana uptime sisteminden bağımsız olarak çalışır ve botunuzun 7/24 aktif kalmasına ek bir güvence sağlar.
