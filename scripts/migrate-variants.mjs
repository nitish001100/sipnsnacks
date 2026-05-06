import pg from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

async function migrateVariants() {
  console.log('🚀 Running variant pricing migration...\n');

  const client = await pool.connect();
  try {
    // Add variant columns to menu_items
    await client.query(`
      ALTER TABLE menu_items
        ADD COLUMN IF NOT EXISTS has_variants BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS half_price DECIMAL(10, 2),
        ADD COLUMN IF NOT EXISTS full_price DECIMAL(10, 2)
    `);
    console.log('✅ Added variant columns to menu_items (has_variants, half_price, full_price)');

    // Add variant column to order_items
    await client.query(`
      ALTER TABLE order_items
        ADD COLUMN IF NOT EXISTS variant VARCHAR(20)
    `);
    console.log('✅ Added variant column to order_items');

    console.log('\n🎉 Variant pricing migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateVariants();
