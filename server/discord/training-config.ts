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
  if (!member || !serverConfig) return defaultValue;

  // Kullanıcının rollerini kontrol et ve uygun süreyi döndür
  if (serverConfig.role9099Id && member.roles.cache.has(serverConfig.role9099Id)) {
    return 5; // 90-99 rating arası: 5 saat
  }
  else if (serverConfig.role8090Id && member.roles.cache.has(serverConfig.role8090Id)) {
    return 4; // 80-90 rating arası: 4 saat
  }
  else if (serverConfig.role7080Id && member.roles.cache.has(serverConfig.role7080Id)) {
    return 3; // 70-80 rating arası: 3 saat 
  }
  else if (serverConfig.role6070Id && member.roles.cache.has(serverConfig.role6070Id)) {
    return 2; // 60-70 rating arası: 2 saat
  }

  // Hiçbir rating rolü yoksa varsayılan 1 saat dön
  return 1;
}