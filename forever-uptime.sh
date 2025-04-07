#!/bin/bash

# Sonsuza dek çalışacak gelişmiş uptime script
# Bu script, her 5 dakikada bir ana uygulamayı ping eder ve canlı tutar
# Ayrıca çeşitli uptime servisleri ile entegrasyonu sağlar

# Log fonksiyonu
log() {
  local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
  echo "[$timestamp] $1" >> ./forever-uptime.log
  echo "[$timestamp] $1"
}

# URL oluşturma fonksiyonu
get_base_url() {
  # Replit ortam değişkenlerini kontrol et
  local repl_slug=$(printenv REPL_SLUG)
  local repl_owner=$(printenv REPL_OWNER)
  local repl_id=$(printenv REPL_ID)
  
  # Replit URL'i oluştur
  if [ -n "$repl_slug" ] && [ -n "$repl_owner" ]; then
    echo "${repl_slug}.${repl_owner}.repl.co"
    return
  fi
  
  # Yeni Replit ID formatını kontrol et
  if [ -n "$repl_id" ]; then
    echo "${repl_id}.id.repl.co"
    return
  fi
  
  # .hostname dosyasını kontrol et
  if [ -f ".hostname" ]; then
    hostname=$(cat .hostname)
    if [ -n "$hostname" ]; then
      echo "$hostname"
      return
    fi
  fi
  
  # REPLIT_URL ortam değişkenini kontrol et
  local replit_url=$(printenv REPLIT_URL)
  if [ -n "$replit_url" ]; then
    echo "$replit_url"
    return
  fi
  
  # Son çare olarak varsayılan değeri kullan
  echo "discord-halisaha-manager.emilswd.repl.co"
}

# Uygulama restart fonksiyonu
restart_application() {
  log "🔄 Uygulamayı yeniden başlatma girişimi..."
  
  # need-restart dosyası oluştur
  touch ./need-restart
  echo "$(date)" > ./need-restart
  
  # Disk aktivitesi oluştur
  for i in {1..5}; do
    echo "Restart signal: $(date)" > "./heartbeat-restart-$i.txt"
  done
  
  # Koruyucu servisleri başlat
  if [ -f "keep-bot-online.js" ]; then
    log "keep-bot-online.js servisini başlatma denemesi..."
    node keep-bot-online.js > keep-bot-online.log 2>&1 &
  fi
  
  if [ -f "super-uptime-service.js" ]; then
    log "super-uptime-service.js servisini başlatma denemesi..."
    node super-uptime-service.js > super-uptime.log 2>&1 &
  fi
  
  log "🔄 Yeniden başlatma sinyali gönderildi."
}

log "🚀 Gelişmiş Sonsuz Uptime Servisi (v2.0) başlatılıyor..."

# Çalışan bir kopya varsa öldür
if [ -f "./forever-uptime.pid" ]; then
  OLD_PID=$(cat ./forever-uptime.pid)
  if [ -n "$OLD_PID" ]; then
    log "Eski servis süreci bulundu (PID: $OLD_PID), sonlandırılıyor..."
    kill -9 $OLD_PID 2>/dev/null || true
  fi
fi

# Ana fonksiyon
main_loop() {
  # Kurulduğundan emin olmak için önceki uzun süreli çalışan servisleri başlat
  if [ -f "always-running.js" ]; then
    log "always-running.js servisini başlatma denemesi..."
    node always-running.js > always-running.log 2>&1 &
  fi
  
  # Ana döngü
  while true; do
    # Ana uygulamayı ping et - Her seferinde farklı URL'ler dene
    BASE_URL=$(get_base_url)
    
    # Rastgele sayı oluştur (cache önleme için)
    RANDOM_ID=$(date +%s%N | md5sum | head -c 10)
    
    # Birden fazla endpoint ping et
    PING_URLS=(
      "https://${BASE_URL}/ping?t=$(date +%s)&r=${RANDOM_ID}"
      "https://${BASE_URL}/uptime-check?cache=${RANDOM_ID}"
      "https://${BASE_URL}/api/health?nocache=$(date +%s)"
    )
    
    SUCCESS=false
    
    # Tüm URL'leri ping et, herhangi biri başarılı olursa yeterli
    for URL in "${PING_URLS[@]}"; do
      log "Ping gönderiliyor: $URL"
      
      # Curl ile ping gönder (3 saniye timeout ile)
      RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$URL" || echo "Error")
      
      if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "201" ] || [ "$RESPONSE" = "202" ] || [ "$RESPONSE" = "204" ]; then
        log "✅ Ping başarılı! HTTP kodu: $RESPONSE"
        SUCCESS=true
        break
      else
        log "❌ Ping başarısız! HTTP kodu: $RESPONSE (URL: $URL)"
      fi
    done
    
    # Kontrol et ve gerekirse yeniden başlat
    if [ "$SUCCESS" = true ]; then
      log "✅ Uygulama çalışmaya devam ediyor."
    else
      log "⚠️ Uygulama yanıt vermiyor! Kurtarma prosedürü başlatılıyor..."
      restart_application
    fi
    
    # Disk aktivitesi (Replit'in uyku moduna geçmesini engeller)
    echo "[$(date)] Heartbeat" > ./heartbeat.txt
    
    # 5 dakika bekle
    for i in {1..300}; do
      sleep 1
      
      # Her 30 saniyede bir disk aktivitesi
      if [ $((i % 30)) -eq 0 ]; then
        echo "[$(date)] Pulse $i" > ./pulse.txt
      fi
    done
  done
}

# Ana döngüyü background'da başlat
main_loop &

# PID'i kaydet
echo $! > ./forever-uptime.pid
log "✅ Gelişmiş Uptime Servisi başlatıldı (PID: $!). Bu terminal kapatılabilir, servis çalışmaya devam edecek."

# Bilgi mesajı
echo "==================== UPTIME SERVİSİ KURULDU ===================="
echo "Gelişmiş Sonsuz Uptime Servisi (v2.0) arka planda çalışıyor."
echo "Bu servis, Discord botunun ve uygulamanın 24/7 çalışmasını sağlar."
echo ""
echo "Log dosyası: ./forever-uptime.log"
echo "PID dosyası: ./forever-uptime.pid"
echo "==============================================================="
