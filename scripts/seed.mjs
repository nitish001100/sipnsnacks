import pg from 'pg';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

async function seed() {
  console.log('🌱 Seeding database...\n');

  const client = await pool.connect();
  try {
    // Seed admin user
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const passwordHash = await bcrypt.hash(password, 12);

    await client.query(
      `INSERT INTO users (username, password_hash, role)
       VALUES ($1, $2, 'admin')
       ON CONFLICT (username) DO UPDATE SET password_hash = $2`,
      [username, passwordHash]
    );
    console.log(`✅ Admin user created: ${username}`);

    // Seed sample menu items
    const menuItems = [
      { name: 'Paneer Tikka', price: 220, category: 'Starters' },
      { name: 'Chicken 65', price: 280, category: 'Starters' },
      { name: 'Veg Spring Roll', price: 180, category: 'Starters' },
      { name: 'Fish Fry', price: 320, category: 'Starters' },
      { name: 'Butter Chicken', price: 350, category: 'Main Course' },
      { name: 'Paneer Butter Masala', price: 280, category: 'Main Course' },
      { name: 'Dal Makhani', price: 220, category: 'Main Course' },
      { name: 'Biryani (Chicken)', price: 300, category: 'Main Course' },
      { name: 'Biryani (Veg)', price: 240, category: 'Main Course' },
      { name: 'Chole Bhature', price: 180, category: 'Main Course' },
      { name: 'Butter Naan', price: 60, category: 'Breads' },
      { name: 'Garlic Naan', price: 70, category: 'Breads' },
      { name: 'Roti', price: 30, category: 'Breads' },
      { name: 'Paratha', price: 50, category: 'Breads' },
      { name: 'Masala Chai', price: 40, category: 'Beverages' },
      { name: 'Cold Coffee', price: 120, category: 'Beverages' },
      { name: 'Fresh Lime Soda', price: 80, category: 'Beverages' },
      { name: 'Lassi (Sweet)', price: 90, category: 'Beverages' },
      { name: 'Mango Shake', price: 130, category: 'Beverages' },
      { name: 'Gulab Jamun', price: 80, category: 'Desserts' },
      { name: 'Rasmalai', price: 100, category: 'Desserts' },
      { name: 'Ice Cream', price: 120, category: 'Desserts' },
    ];

    const { rows } = await client.query('SELECT COUNT(*) as count FROM menu_items');
    const existingCount = parseInt(rows[0].count);

    if (existingCount === 0) {
      for (const item of menuItems) {
        await client.query(
          'INSERT INTO menu_items (name, price, category, available) VALUES ($1, $2, $3, true)',
          [item.name, item.price, item.category]
        );
      }
      console.log(`✅ Seeded ${menuItems.length} menu items`);
    } else {
      console.log(`⏭️ Menu items already exist (${existingCount} items), skipping seed`);
    }

    console.log('\n🎉 Seeding completed successfully!');
    console.log(`\n📝 Login credentials:`);
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
