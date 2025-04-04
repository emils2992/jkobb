import { EmbedBuilder } from 'discord.js';
import { User, AttributeRequest, Attribute } from '@shared/schema';
import { isValidAttribute, getRequiredHours, getCategoryForAttribute } from './training-config';

// Format date for display
export function formatDate(date: Date): string {
  if (!date) return 'Bilinmiyor';
  
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Parse attribute request from message content
export function parseAttributeRequest(content: string): { name: string, value: number } | null {
  // Match patterns like "Nitelik: +2 Hız" or "Hız +3" or similar variations
  const patterns = [
    /Nitelik:\s*\+?(\d+)\s+(.+)/i,
    /(.+):\s*\+?(\d+)/i,
    /(.+)\s+\+(\d+)/i
  ];
  
  console.log(`[parseAttributeRequest] Parsing: "${content}"`);
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      if (pattern === patterns[0]) {
        const valueStr = match[1];
        // Sadece sayı kısmını alıp integer'a çevir
        const value = parseInt(valueStr, 10);
        const name = match[2].trim();
        
        console.log(`[parseAttributeRequest] Algılanan talep - Nitelik: ${name}, Değer: ${value} (çiğ değer: "${valueStr}")`);
        
        // Sadece pozitif değerlere izin ver
        if (value > 0) {
          return { name, value };
        } else {
          console.log(`[parseAttributeRequest] Geçersiz değer: ${value}`);
          return null;
        }
      } else {
        const name = match[1].trim();
        const valueStr = match[2];
        // Sadece sayı kısmını alıp integer'a çevir
        const value = parseInt(valueStr, 10);
        
        console.log(`[parseAttributeRequest] Algılanan talep - Nitelik: ${name}, Değer: ${value} (çiğ değer: "${valueStr}")`);
        
        // Sadece pozitif değerlere izin ver
        if (value > 0) {
          return { name, value };
        } else {
          console.log(`[parseAttributeRequest] Geçersiz değer: ${value}`);
          return null;
        }
      }
    }
  }
  
  return null;
}

// Create an embed for attribute requests
export function createAttributeEmbed(
  user: User,
  attributeRequests: AttributeRequest[],
  totalAttributes: number
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('🎫 Ticket Kapatıldı')
    .setColor('#43B581')
    .setDescription(`**${user.username}** adlı oyuncunun nitelik talebi tamamlandı.`)
    .setTimestamp();
  
  const approvedRequests = attributeRequests.filter(req => req.approved);
  const pendingRequests = attributeRequests.filter(req => !req.approved);
  
  // Toplam değeri göster
  embed.addFields({
    name: '📊 Toplam Kazanılan Nitelik',
    value: `**+${totalAttributes}** puan`,
    inline: false
  });

  // Nitelik başına sadece en son talebi kullanacak şekilde harita oluştur - ÇOKLU TALEPLER İÇİN TOPLAMA YOK!
  const attributeSummary = new Map<string, number>();
  
  // Önce talepleri zaman damgasına göre sıralayalım (en yenisi en sonda)
  const sortedRequests = [...approvedRequests]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  
  // Her nitelik için sadece bir kez ekleme yapacağız - en son talep kazanır
  for (const request of sortedRequests) {
    // Nitelik adını ve tam olarak istenen değeri kullan
    attributeSummary.set(request.attributeName, request.valueRequested);
    console.log(`[EMBED] Nitelik talebi: ${request.attributeName} için SADECE +${request.valueRequested} gösteriliyor`);
  }
  
  // Nitelik kategorilerine göre gruplandırma
  const attributesByCategory: Record<string, Map<string, number>> = {};
  
  for (const [attributeName, totalValue] of Array.from(attributeSummary.entries())) {
    const category = getCategoryForAttribute(attributeName) || 'Diğer';
    if (!attributesByCategory[category]) {
      attributesByCategory[category] = new Map<string, number>();
    }
    attributesByCategory[category].set(attributeName, totalValue);
  }
  
  // Her kategori için ayrı alan ekle
  for (const [category, attributes] of Object.entries(attributesByCategory)) {
    if (attributes.size > 0) {
      const attributesText = Array.from(attributes.entries())
        .map(([name, value]) => `**${name}**: +${value}`)
        .join('\n');
      
      embed.addFields({
        name: `✅ ${category} Nitelikleri`,
        value: attributesText,
        inline: true
      });
    }
  }
  
  // Eğer hiç kategorize edilmiş nitelik yoksa genel liste göster
  if (Object.keys(attributesByCategory).length === 0 && approvedRequests.length > 0) {
    const attributesText = Array.from(attributeSummary.entries())
      .map(([name, value]) => `**${name}**: +${value}`)
      .join('\n');
    
    embed.addFields({
      name: '✅ Onaylanan Nitelikler',
      value: attributesText,
      inline: false
    });
  }
  
  if (pendingRequests.length > 0) {
    // Onaylanmayan nitelikler için de aynı mantığı uygula - son talep kazanır
    const pendingSummary = new Map<string, number>();
    
    // Önce talepleri zaman damgasına göre sıralayalım (en yenisi en sonda)
    const sortedPendingRequests = [...pendingRequests]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    // Her nitelik için sadece bir kez ekleme yapacağız - en son talep kazanır
    for (const request of sortedPendingRequests) {
      // Nitelik adını ve tam olarak istenen değeri kullan
      pendingSummary.set(request.attributeName, request.valueRequested);
      console.log(`[EMBED] Bekleyen talep: ${request.attributeName} için SADECE +${request.valueRequested} gösteriliyor`);
    }
    
    const pendingText = Array.from(pendingSummary.entries())
      .map(([name, value]) => `**${name}**: +${value}`)
      .join('\n');
    
    embed.addFields({
      name: '❌ Onaylanmayan Nitelikler',
      value: pendingText,
      inline: false
    });
  }
  
  return embed;
}

/**
 * Antrenman mesajı analizini yapar, seviye bilgisine göre doğrular
 * @param content Mesaj içeriği
 * @param attributes Kullanıcının nitelikleri
 * @param lastTrainingTime Kullanıcının son antrenman zamanı (her nitelik için)
 * @returns Eğer mesaj geçerli bir antrenman mesajıysa antrenman detayları, değilse null
 */
export function parseTrainingMessage(
  content: string,
  attributes: Attribute[],
  lastTrainingTime: Date | null
): { 
  attributeName: string; 
  duration: number; 
  intensity: number;
  points: number;
  attributeValue: number;
  hoursRequired: number;
  isAllowed: boolean;
  timeSinceLastTraining: number;
} | null {
  // Antrenman formatını kontrol et (örn: "1/1 kısa pas")
  const trainingPattern = /(\d+)\/(\d+)\s+(.+)/i;
  const matches = content.match(trainingPattern);
  
  if (!matches || matches.length < 4) return null;
  
  const duration = parseInt(matches[1], 10) || 0;
  const intensity = parseInt(matches[2], 10) || 0;
  const attributeRaw = matches[3].trim();
  
  if (duration <= 0 || intensity <= 0) return null;
  
  // Nitelik adını normalleştir
  let attributeName = attributeRaw;
  const validAttributes = getValidAttributes();
  
  // Eğer bu adla bir nitelik yoksa, en yakın eşleşeni bulmaya çalış
  if (!validAttributes.includes(attributeName)) {
    // Kısa pas -> Uzun Pas, Sprint -> Sprint Hızı gibi kısmi eşleşmeleri kontrol et
    for (const validAttr of validAttributes) {
      if (validAttr.toLowerCase().includes(attributeName.toLowerCase()) || 
          attributeName.toLowerCase().includes(validAttr.toLowerCase())) {
        attributeName = validAttr;
        break;
      }
    }
  }
  
  // Hala geçerli değilse varsayılan bir nitelik kullan
  if (!validAttributes.includes(attributeName)) {
    attributeName = 'Genel Antrenman';
  }
  
  // Kullanıcının bu nitelikteki mevcut değerini al
  const attribute = attributes.find(attr => attr.name === attributeName);
  const attributeValue = attribute ? attribute.value : 50; // Varsayılan başlangıç değeri
  
  // Kazanılan nitelik puanı hesapla (süre * yoğunluk)
  // Basit formül: süre * yoğunluk / 10, minimum 1, maksimum 5 puan
  const points = Math.min(5, Math.max(1, Math.floor(duration * intensity / 10)));
  
  // Bu nitelik için gereken bekleme süresini al
  const hoursRequired = getRequiredHours(attributeName, attributeValue);
  
  // Kullanıcının son antrenmanından bu yana geçen süreyi hesapla
  const now = new Date();
  const timeSinceLastTraining = lastTrainingTime
    ? (now.getTime() - lastTrainingTime.getTime()) / (1000 * 60 * 60) // saat cinsinden
    : 24; // Eğer daha önce antrenman yapılmadıysa 24 saat (varsayılan olarak izin verir)
  
  // Antrenman yapılabilir mi kontrol et
  const isAllowed = timeSinceLastTraining >= hoursRequired;
  
  return {
    attributeName,
    duration,
    intensity,
    points,
    attributeValue,
    hoursRequired,
    isAllowed,
    timeSinceLastTraining
  };
}

/**
 * Geçerli niteliklerin listesini döndürür
 */
export function getValidAttributes(): string[] {
  return [
    // Savunma
    'Ayakta Müdahale', 'Kayarak Müdahale',
    // Beceri
    'Dribbling', 'Falso', 'Serbest Vuruş İsabeti', 'Uzun Pas', 'Top Kontrolü',
    // Güç
    'Şut Gücü', 'Zıplama', 'Dayanıklılık', 'Güç', 'Uzaktan Şut',
    // Hareket
    'Hızlanma', 'Sprint Hızı', 'Çeviklik', 'Reaksiyonlar', 'Denge',
    // Mantalite
    'Agresiflik', 'Top Kesme', 'Pozisyon Alma', 'Görüş', 'Penaltı',
    // Kaleci
    'Kaleci Atlayışı', 'KL Top Kontrolü', 'KL Vuruş', 'KL Pozisyon Alma', 'KL Refleksler',
    // Genel
    'Genel Antrenman'
  ];
}
