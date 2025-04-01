import pg from 'pg';
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema';

// Veritabanı bağlantı havuzu oluştur
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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