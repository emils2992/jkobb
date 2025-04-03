import pg from 'pg';
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema';

// Veritabanı bağlantı havuzu oluştur - ölçeklenebilirlik için optimize edilmiş
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // maksimum bağlantı sayısı
  idleTimeoutMillis: 30000, // boşta kalan bağlantıların ne kadar süre korunacağı
  connectionTimeoutMillis: 5000, // bağlantı zaman aşımı
  maxUses: 7500, // bir bağlantının yeniden kullanılma sayısı
  ssl: {
    rejectUnauthorized: false // Replit için SSL sertifikası kontrolünü devre dışı bırak
  }
});

// Drizzle ORM'yi yapılandır
export const db = drizzle(pool, { schema });

// Veritabanı bağlantısını test et ve tabloları oluştur
export async function initDatabase() {
  try {
    // Bağlantıyı test et
    const client = await pool.connect();
    console.log('PostgreSQL veritabanına başarıyla bağlandı');
    client.release();

    // Tabloları oluştur
    await createTables();
    console.log('Veritabanı tabloları kontrol edildi/oluşturuldu');
    
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
        closed_at TIMESTAMP,
        closed_by TEXT
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
      )`,

      `CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        role TEXT NOT NULL DEFAULT 'admin',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_login TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER NOT NULL REFERENCES admins(id),
        content TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,

      `CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
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