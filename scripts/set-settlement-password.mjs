import pg from 'pg';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

async function setSettlementPassword() {
  const password = 'Admin@123';
  
  console.log('🔐 Setting settlement password...\n');

  const client = await pool.connect();
  try {
    // Hash the password
    const hash = await bcrypt.hash(password, 12);

    // Upsert into settings table
    await client.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      ['settlement_password', hash]
    );

    console.log('✅ Settlement password set successfully!');
    console.log(`   Password: ${password}`);
    console.log('\n📝 Use this password to:');
    console.log('   • View revenue on the dashboard');
    console.log('   • Send settlement email reports');
    console.log('\n🎉 Done!');
  } catch (error) {
    console.error('❌ Failed to set password:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setSettlementPassword();
