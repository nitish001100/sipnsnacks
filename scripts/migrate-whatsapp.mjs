import pg from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

async function migrate() {
  console.log('🚀 Running WhatsApp migration...\n');

  const client = await pool.connect();
  try {
    // Add customer_whatsapp column to orders table
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_whatsapp VARCHAR(20)
    `);
    console.log('✅ Added column: customer_whatsapp to orders table');

    // Add customer_name column to orders table
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255)
    `);
    console.log('✅ Added column: customer_name to orders table');

    console.log('\n🎉 WhatsApp migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
