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
// Her seviye aralığı için, o seviyede bir antrenman yapmak için gereken saat sayısı
export const trainingLimits: TrainingLimit[] = [
  { minLevel: 50, maxLevel: 60, hoursRequired: 1 },
  { minLevel: 61, maxLevel: 70, hoursRequired: 2 },
  { minLevel: 71, maxLevel: 80, hoursRequired: 3 },
  { minLevel: 81, maxLevel: 99, hoursRequired: 5 }
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
      { name: 'Kısa Pas', limits: trainingLimits },
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
// Artık tüm nitelik isimleri geçerli kabul edilecek
export function isValidAttribute(name: string): boolean {
  return true; // Tüm nitelik isimlerini kabul et
}

// Verilen nitelik değeri ve nitelik adı için gerekli antrenman saati sayısını hesaplar
export function getRequiredHours(attributeName: string, currentValue: number): number {
  // Niteliği bul (büyük/küçük harfe duyarsız)
  for (const category of trainingCategories) {
    const attribute = category.attributes.find(attr => 
      attr.name.toLowerCase() === attributeName.toLowerCase()
    );
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
    if (category.attributes.some(attr => attr.name.toLowerCase() === attributeName.toLowerCase())) {
      return category.name;
    }
  }
  // Tanımlı olmayan nitelikler için "Diğer" kategorisini döndür
  return "Diğer";
}