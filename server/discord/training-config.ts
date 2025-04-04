// Antrenman kategorileri ve nitelik sınırlamaları

export interface TrainingLimit {
  minLevel: number;
  maxLevel: number;
  hoursRequired: number;
}

export interface TrainingAttribute {
  name: string;
  limits: TrainingLimit[];
}

export interface TrainingCategory {
  name: string;
  attributes: TrainingAttribute[];
}

// Antrenman limitleri 
// Her rating aralığı için, o rating seviyesinde bir antrenman yapmak için gereken saat sayısı
export const trainingLimits: TrainingLimit[] = [
  { minLevel: 0, maxLevel: 59, hoursRequired: 1 }, // Rolsüz oyuncular için default süre: 1 saat
  { minLevel: 60, maxLevel: 70, hoursRequired: 2 }, // 60-70 rating arası: 2 saat
  { minLevel: 71, maxLevel: 80, hoursRequired: 3 }, // 70-80 rating arası: 3 saat
  { minLevel: 81, maxLevel: 90, hoursRequired: 4 }, // 80-90 rating arası: 4 saat
  { minLevel: 91, maxLevel: 99, hoursRequired: 5 }, // 90-99 rating arası: 5 saat
];

// Antrenman kategorileri ve içerdiği nitelikler
export const trainingCategories: TrainingCategory[] = [
  {
    name: 'Savunma',
    attributes: [
      { 
        name: 'Ayakta Müdahale', 
        limits: trainingLimits 
      },
      { 
        name: 'Kayarak Müdahale', 
        limits: trainingLimits 
      }
    ]
  },
  {
    name: 'Beceri',
    attributes: [
      { name: 'Dribbling', limits: trainingLimits },
      { name: 'Falso', limits: trainingLimits },
      { name: 'Serbest Vuruş İsabeti', limits: trainingLimits },
      { name: 'Uzun Pas', limits: trainingLimits },
      { name: 'Top Kontrolü', limits: trainingLimits }
    ]
  },
  {
    name: 'Güç',
    attributes: [
      { name: 'Şut Gücü', limits: trainingLimits },
      { name: 'Zıplama', limits: trainingLimits },
      { name: 'Dayanıklılık', limits: trainingLimits },
      { name: 'Güç', limits: trainingLimits },
      { name: 'Uzaktan Şut', limits: trainingLimits }
    ]
  },
  {
    name: 'Hareket',
    attributes: [
      { name: 'Hızlanma', limits: trainingLimits },
      { name: 'Sprint Hızı', limits: trainingLimits },
      { name: 'Çeviklik', limits: trainingLimits },
      { name: 'Reaksiyonlar', limits: trainingLimits },
      { name: 'Denge', limits: trainingLimits }
    ]
  },
  {
    name: 'Mantalite',
    attributes: [
      { name: 'Agresiflik', limits: trainingLimits },
      { name: 'Top Kesme', limits: trainingLimits },
      { name: 'Pozisyon Alma', limits: trainingLimits },
      { name: 'Görüş', limits: trainingLimits },
      { name: 'Penaltı', limits: trainingLimits }
    ]
  },
  {
    name: 'Kaleci',
    attributes: [
      { name: 'Kaleci Atlayışı', limits: trainingLimits },
      { name: 'KL Top Kontrolü', limits: trainingLimits },
      { name: 'KL Vuruş', limits: trainingLimits },
      { name: 'KL Pozisyon Alma', limits: trainingLimits },
      { name: 'KL Refleksler', limits: trainingLimits }
    ]
  }
];

// Tüm niteliklerin düz listesi
export const allAttributes = trainingCategories.flatMap(category => 
  category.attributes.map(attr => attr.name)
);

// Verilen nitelik adının geçerli olup olmadığını kontrol eder
export function isValidAttribute(name: string): boolean {
  return allAttributes.includes(name);
}

// Verilen nitelik değeri ve nitelik adı için gerekli antrenman saati sayısını hesaplar
export function getRequiredHours(attributeName: string, currentValue: number): number {
  // Niteliği bul
  for (const category of trainingCategories) {
    const attribute = category.attributes.find(attr => attr.name === attributeName);
    if (attribute) {
      // Değere göre limit bul
      for (const limit of attribute.limits) {
        if (currentValue >= limit.minLevel && currentValue <= limit.maxLevel) {
          return limit.hoursRequired;
        }
      }
    }
  }
  
  // Varsayılan olarak 1 saat döndür (eğer nitelik bulunamazsa veya değer aralık dışındaysa)
  return 1;
}

// Niteliğin ait olduğu kategoriyi döndürür
export function getCategoryForAttribute(attributeName: string): string | null {
  for (const category of trainingCategories) {
    if (category.attributes.some(attr => attr.name === attributeName)) {
      return category.name;
    }
  }
  return null;
}

// Kullanıcının rolüne göre antrenman beklemesi gereken süre
export function getTrainingHoursByRoles(
  member: any, // Discord.js GuildMember
  serverConfig: any, // ServerConfig
  defaultValue: number
): number {
  if (!member || !serverConfig) {
    console.log(`[ROL KONTROLÜ] Üye veya sunucu yapılandırması bulunamadı - varsayılan değer: ${defaultValue}`);
    return defaultValue;
  }

  // GELİŞMİŞ VERİTABANI ALAN DEĞERLERİ TESPİTİ
  // !! VERİTABANI YAPISINDAN KAYNAKLANAN İSİM FARKLILIKLARINI TESPİT EDELİM !!
  
  // Veritabanı alan adlarını ve değerlerini logla
  const allKeys = Object.keys(serverConfig);
  console.log(`[SCHEMA KONTROLÜ] Tüm alan adları: ${allKeys.join(', ')}`);
  
  // Farklı formatlarda rol ID alanlarını arayalım
  let role6070Key = null;
  let role7080Key = null;
  let role8090Key = null; 
  let role9099Key = null;
  
  // Tüm olası alan adı varyasyonlarını kontrol et
  const possibleVariations = [
    // 60-70 için
    ['role6070Id', 'role_6070_id', 'role_60_70_id', 'role6070id', 'role_60_70'],
    // 70-80 için
    ['role7080Id', 'role_7080_id', 'role_70_80_id', 'role7080id', 'role_70_80'],
    // 80-90 için
    ['role8090Id', 'role_8090_id', 'role_80_90_id', 'role8090id', 'role_80_90'],
    // 90-99 için
    ['role9099Id', 'role_9099_id', 'role_90_99_id', 'role9099id', 'role_90_99']
  ];
  
  // Tüm alanları tara ve var olanları belirle
  allKeys.forEach(key => {
    // Küçük harfe çevir, karşılaştırmayı kolaylaştır
    const lowerKey = key.toLowerCase();
    
    // 60-70 için kontrol
    if (possibleVariations[0].some(v => lowerKey.includes(v.toLowerCase()))) {
      role6070Key = key;
    }
    // 70-80 için kontrol
    else if (possibleVariations[1].some(v => lowerKey.includes(v.toLowerCase()))) {
      role7080Key = key;
    }
    // 80-90 için kontrol
    else if (possibleVariations[2].some(v => lowerKey.includes(v.toLowerCase()))) {
      role8090Key = key;
    }
    // 90-99 için kontrol
    else if (possibleVariations[3].some(v => lowerKey.includes(v.toLowerCase()))) {
      role9099Key = key;
    }
  });
  
  // Bulunan anahtarları ve değerlerini logla
  console.log(`[SCHEMA] 60-70 Anahtar: ${role6070Key}, Değer: ${role6070Key ? serverConfig[role6070Key] : 'YOK'}`);
  console.log(`[SCHEMA] 70-80 Anahtar: ${role7080Key}, Değer: ${role7080Key ? serverConfig[role7080Key] : 'YOK'}`);
  console.log(`[SCHEMA] 80-90 Anahtar: ${role8090Key}, Değer: ${role8090Key ? serverConfig[role8090Key] : 'YOK'}`);
  console.log(`[SCHEMA] 90-99 Anahtar: ${role9099Key}, Değer: ${role9099Key ? serverConfig[role9099Key] : 'YOK'}`);

  // Kullanıcının rollerini ve sunucu bilgisini logla
  console.log(`[ROL] Kullanıcı: ${member.user.tag}`);
  console.log(`[ROL] Rol sayısı: ${member.roles.cache.size}`);
  
  // Kullanıcının sahip olduğu rolleri görsel olarak logla
  const userRoleIds = Array.from(member.roles.cache.keys());
  console.log(`[ROL] Kullanıcı rolleri (ID'ler): ${userRoleIds.join(', ')}`);
  
  // Rol değerlerini al
  const role9099Value = role9099Key ? serverConfig[role9099Key] : null;
  const role8090Value = role8090Key ? serverConfig[role8090Key] : null;
  const role7080Value = role7080Key ? serverConfig[role7080Key] : null;
  const role6070Value = role6070Key ? serverConfig[role6070Key] : null;
  
  console.log(`[ROL] 90-99 Rol ID: ${role9099Value}`);
  console.log(`[ROL] 80-90 Rol ID: ${role8090Value}`);
  console.log(`[ROL] 70-80 Rol ID: ${role7080Value}`);
  console.log(`[ROL] 60-70 Rol ID: ${role6070Value}`);
  
  // Kullanıcının rolleri ile karşılaştır
  const hasRole9099 = role9099Value && userRoleIds.includes(role9099Value);
  const hasRole8090 = role8090Value && userRoleIds.includes(role8090Value);
  const hasRole7080 = role7080Value && userRoleIds.includes(role7080Value);
  const hasRole6070 = role6070Value && userRoleIds.includes(role6070Value);
  
  console.log(`[ROL] 90-99 rolüne sahip mi: ${hasRole9099}`);
  console.log(`[ROL] 80-90 rolüne sahip mi: ${hasRole8090}`);
  console.log(`[ROL] 70-80 rolüne sahip mi: ${hasRole7080}`);
  console.log(`[ROL] 60-70 rolüne sahip mi: ${hasRole6070}`);
  
  // En yüksek role göre bekleme süresini belirle
  if (hasRole9099) {
    console.log(`[ROL] 90-99 rolü bulundu - Bekleme süresi: 5 saat`);
    return 5; // 90-99 rating arası: 5 saat
  }
  else if (hasRole8090) {
    console.log(`[ROL] 80-90 rolü bulundu - Bekleme süresi: 4 saat`);
    return 4; // 80-90 rating arası: 4 saat
  }
  else if (hasRole7080) {
    console.log(`[ROL] 70-80 rolü bulundu - Bekleme süresi: 3 saat`);
    return 3; // 70-80 rating arası: 3 saat 
  }
  else if (hasRole6070) {
    console.log(`[ROL] 60-70 rolü bulundu - Bekleme süresi: 2 saat`);
    return 2; // 60-70 rating arası: 2 saat
  }

  // Hiçbir rating rolü yoksa varsayılan 1 saat dön
  console.log(`[ROL] Hiçbir rating rolü bulunamadı - Varsayılan süre: 1 saat`);
  return 1;
}