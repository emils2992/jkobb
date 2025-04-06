# Replit'ten Glitch'e Proje Aktarma Rehberi

## Method 1: Replit'ten Doğrudan İndirme

1. Replit'te projenizin ana ekranındayken, sol üstteki menü düğmesine tıklayın (üç çizgi)
2. Açılan menüden "Tools" ı seçin
3. Ardından "Git" seçeneğini tıklayın
4. Sağ tarafta "download zip" linki olacak, buna tıklayarak projeyi indirebilirsiniz

Menüde bu seçenekleri bulamazsanız:

1. Sol üstteki üç nokta (...) veya hamburger menüye tıklayın
2. "Export" veya "Download as zip" seçeneğini arayın

## Method 2: GitHub Üzerinden Aktarma (En Kolay Yöntem)

1. Replit'te projenize girin
2. Sol üstteki menüden "Version control" veya "Git" seçeneğine tıklayın
3. GitHub'a commit ve push yapın:
   - Commit mesajı yazın (örn: "Export to Glitch")
   - "Commit & push" butonuna tıklayın

4. GitHub'a giriş yapın ve ilgili repo'yu açın

5. Glitch.com'a giriş yapın ve "New Project" butonuna tıklayın
6. "Import from GitHub" seçeneğini seçin
7. GitHub repo URL'nizi yapıştırın ve "OK" diyin

## Method 3: Manuel Dosya Kopyalama

Replit'ten projenizi indiremeseniz bile, Glitch'e şu şekilde aktarabilirsiniz:

1. Glitch.com'da yeni bir proje oluşturun ("New Project" > "hello-node" şablonu)
2. Glitch projenizde sol taraftaki dosya listesini açın
3. package.json dosyasını düzenleyin:
   - Replit'teki package.json içeriğini kopyalayıp Glitch'teki package.json'a yapıştırın

4. Önemli dosyaları tek tek kopyalayın:
   - server/ klasörü 
   - client/ klasörü
   - shared/ klasörü
   - external-pings.ts
   - ping-handler.ts
   - vb.

5. Veritabanı bağlantısı için:
   - Glitch'te sol alttaki "🔑 .env" dosyasını açın
   - Replit'teki veritabanı bilgilerini ve Discord token'larınızı ekleyin:
     ```
     DISCORD_BOT_TOKEN=bot_tokeniniz
     DISCORD_CLIENT_ID=client_id_niz
     DATABASE_URL=veritabani_url_niz
     ```

## Glitch Yapılandırması

Dosyaları aktardıktan sonra:

1. Glitch'te package.json dosyasında "scripts" bölümündeki start komutunun doğru olduğundan emin olun:
   ```json
   "scripts": {
     "start": "node server/index.js",
     "dev": "npm run start"
   }
   ```

2. Port ayarlarını kontrol edin:
   - server/index.ts veya index.js içinde port ayarının aşağıdaki gibi olduğundan emin olun:
     ```javascript
     const PORT = process.env.PORT || 3000;
     server.listen(PORT, "0.0.0.0", () => {
       console.log(`Server listening on port ${PORT}`);
     });
     ```

3. Glitch'te terminali açıp şu komutu çalıştırın:
   ```
   npm install
   ```

## UptimeRobot Yapılandırması

1. Glitch projeniz çalışmaya başladıktan sonra, URL'sini alın (örn: https://proje-adiniz.glitch.me)
2. UptimeRobot'ta eski monitörleri durdurun
3. Yeni monitörler ekleyin:
   - https://proje-adiniz.glitch.me/ping
   - https://proje-adiniz.glitch.me/uptime-check
   - https://proje-adiniz.glitch.me/

## Önemli Notlar

- Glitch'te, "Tools" > "Logs" menüsünden console loglarını görebilirsiniz
- "Tools" > "Terminal" ile terminal erişimi sağlanır
- Veritabanı verilerinizi aktarmak için veritabanı yedeği almanız gerekebilir
- Glitch projesi 30 dakika boyunca hiç ziyaretçi almazsa uyku moduna geçer, UptimeRobot ile bunu önleyebilirsiniz