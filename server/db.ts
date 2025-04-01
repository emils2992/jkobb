import pg from 'pg';
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema';

// Veritabanı havuzu ayarları
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  // Bağlantı havuzu limit ve timeout ayarları
  max: 20, // Eş zamanlı maksimum bağlantı (varsayılan: 10)
  idleTimeoutMillis: 30000, // Boşta olan bağlantıların kapatılması için beklenecek süre
  connectionTimeoutMillis: 5000, // Bağlantı timeout süresi 
  maxUses: 7500, // Bir bağlantıyı yeniden kullanma sayısı (bellek sızıntılarını önlemek için)
};

// Veritabanı bağlantı havuzu oluştur
const pool = new Pool(poolConfig);

// Bağlantı havuzu olaylarını dinle (bellek sızıntıları için)
pool.on('error', (err) => {
  console.error('Beklenmeyen veritabanı havuzu hatası:', err);
});

// Drizzle ORM'yi yapılandır
export const db = drizzle(pool, { schema });

// Bağlantı havuzu sağlık kontrolü
let poolHealthCheckInterval: NodeJS.Timeout | null = null;

function startPoolHealthCheck() {
  // Her 5 dakikada bir havuz durumunu kontrol et
  if (!poolHealthCheckInterval) {
    poolHealthCheckInterval = setInterval(async () => {
      try {
        const client = await pool.connect();
        const result = await client.query('SELECT 1');
        client.release();
        
        // Havuz istatistiklerini logla
        const idleCount = pool.idleCount;
        const totalCount = pool.totalCount;
        const waitingCount = pool.waitingCount;
        
        console.log(`[DB Havuzu] Sağlık kontrolü OK. Boşta: ${idleCount}, Toplam: ${totalCount}, Bekleyen: ${waitingCount}`);
      } catch (error) {
        console.error('[DB Havuzu] Sağlık kontrolü BAŞARISIZ:', error);
        
        // Ciddi bir bağlantı sorunu varsa, havuzu yenile
        if (totalPingFailures > 5) {
          console.log('[DB Havuzu] Kritik hata: Bağlantı havuzu yeniden başlatılıyor...');
          await pool.end();
          // Yeni havuz oluştur
          const newPool = new Pool(poolConfig);
          // global pool değişkenini değiştir 
          // Not: Bu basit bir yenileme, daha karmaşık senaryolarda daha fazla işlem gerekebilir
        }
      }
    }, 5 * 60 * 1000); // 5 dakika
  }
}

let totalPingFailures = 0;

// Veritabanı bağlantısını test et ve tabloları oluştur
export async function initDatabase() {
  try {
    // Bağlantıyı test et
    const client = await pool.connect();
    console.log('PostgreSQL veritabanına başarıyla bağlandı');
    client.release();
    
    // Havuz sağlık kontrolünü başlat
    startPoolHealthCheck();

    // Tabloları oluştur
    await createTables();
    console.log('Veritabanı tabloları kontrol edildi/oluşturuldu');
    
    // Başlangıçta havuz istatistiği göster
    console.log(`[DB Havuzu] Başlangıç durumu - Max: ${pool.options.max}, Boşta: ${pool.idleCount}, Toplam: ${pool.totalCount}`);
    
    return true;
  } catch (error) {
    console.error('Veritabanı başlatılırken hata:', error);
    return false;
  }
}

// Tabloları oluştur
async function createTables() {
  try {
    // Her tablo için CREATE TABLE IF NOT EXISTS sorguları
    const queries = [
      `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        avatar_url TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      
      `CREATE TABLE IF NOT EXISTS attributes (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        value INTEGER NOT NULL DEFAULT 0,
        weekly_value INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, name)
      )`,
      
      `CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        ticket_id TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        type TEXT NOT NULL DEFAULT 'attribute',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        closed_at TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS attribute_requests (
        id SERIAL PRIMARY KEY,
        ticket_id TEXT NOT NULL,
        attribute_name TEXT NOT NULL,
        value_requested INTEGER NOT NULL,
        approved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      
      `CREATE TABLE IF NOT EXISTS training_sessions (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        ticket_id TEXT,
        duration INTEGER NOT NULL,
        attributes_gained INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      
      `CREATE TABLE IF NOT EXISTS server_config (
        id SERIAL PRIMARY KEY,
        guild_id TEXT NOT NULL UNIQUE,
        fix_log_channel_id TEXT,
        training_channel_id TEXT,
        last_reset_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`
    ];

    const client = await pool.connect();
    try {
      // Her sorguyu çalıştır
      for (const query of queries) {
        await client.query(query);
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Tablolar oluşturulurken hata:', error);
    throw error;
  }
}