/**
 * Geliştirilmiş 7/24 Uptime Çözümü
 * Bu modül, Discord botunun ve uygulamanın sürekli çalışmasını sağlar
 */

import { exec } from 'child_process';
import { log } from './vite';

/**
 * Uptime servislerini başlatır
 */
export async function startUptimeServicesAsync(): Promise<void> {
  log('🔄 Uptime servisleri başlatılıyor...');
  
  // 1. always-running.js servisi
  startServiceAsync('always-running.js', 'node always-running.js > always-running.log 2>&1 &');
  
  // 2. forever-uptime.sh servisi
  startServiceAsync('forever-uptime.sh', './forever-uptime.sh > forever-uptime.log 2>&1 &');
  
  // 3. keep-bot-online.js servisi
  startServiceAsync('keep-bot-online.js', 'node keep-bot-online.js > keep-bot-online.log 2>&1 &');
  
  // Bir kaç saniye bekle ve sonucu logla
  setTimeout(() => {
    log('✅ Tüm uptime servisleri başlatılmış olmalı');
    log('📋 UptimeRobot\'u yapılandırmayı unutmayın!');
  }, 2000);
}

/**
 * Bir servisi arka planda başlatır
 */
function startServiceAsync(serviceName: string, command: string): void {
  exec(command, (error, stdout, stderr) => {
    if (error) {
      log(`❌ ${serviceName} başlatılamadı: ${error.message}`);
      return;
    }
    
    if (stderr) {
      log(`⚠️ ${serviceName} başlatıldı, ancak uyarılar var: ${stderr}`);
      return;
    }
    
    log(`✅ ${serviceName} başarıyla başlatıldı`);
  });
}