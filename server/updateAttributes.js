// This is a script to update the database schema for attributes
// It will add a source column to identify whether attributes came from 
// ticket requests or training sessions

import pg from 'pg';

const { Client } = pg;

async function main() {
  console.log('Starting database update for attributes table...');

  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check if the source column exists
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'attributes' 
      AND column_name = 'source'
    `);

    // If source column doesn't exist, add it
    if (checkColumn.rows.length === 0) {
      console.log('Adding source column to attributes table...');
      await client.query(`
        ALTER TABLE attributes 
        ADD COLUMN source VARCHAR(50) DEFAULT 'manual' NOT NULL
      `);
      console.log('Source column added successfully');
    } else {
      console.log('Source column already exists');
    }

    // Update existing records
    console.log('Updating existing records...');
    
    // Set source to 'ticket' for attributes that have corresponding ticket requests
    await client.query(`
      UPDATE attributes a
      SET source = 'ticket'
      FROM attribute_requests ar
      JOIN tickets t ON ar.ticket_id = t.ticket_id
      WHERE a.user_id = t.user_id AND a.name = ar.attribute_name
    `);
    
    console.log('Database update completed');
  } catch (error) {
    console.error('Error updating database:', error);
  } finally {
    await client.end();
    console.log('Connection closed');
  }
}

main().catch(console.error);