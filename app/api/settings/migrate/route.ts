import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// TEMPORARY endpoint to run variant migration - DELETE after use
export async function POST(request: Request) {
  try {
    const { secret } = await request.json();
    if (secret !== 'migrate-2025') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await pool.connect();
    const results: string[] = [];

    try {
      // Add has_variants column
      try {
        await client.query('ALTER TABLE menu_items ADD COLUMN has_variants BOOLEAN DEFAULT false');
        results.push('✅ Added has_variants column');
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (err.code === '42701') results.push('⏭️ has_variants already exists');
        else throw e;
      }

      // Add half_price column
      try {
        await client.query('ALTER TABLE menu_items ADD COLUMN half_price DECIMAL(10, 2)');
        results.push('✅ Added half_price column');
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (err.code === '42701') results.push('⏭️ half_price already exists');
        else throw e;
      }

      // Add full_price column
      try {
        await client.query('ALTER TABLE menu_items ADD COLUMN full_price DECIMAL(10, 2)');
        results.push('✅ Added full_price column');
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (err.code === '42701') results.push('⏭️ full_price already exists');
        else throw e;
      }

      // Add variant column to order_items
      try {
        await client.query('ALTER TABLE order_items ADD COLUMN variant VARCHAR(20)');
        results.push('✅ Added variant column to order_items');
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (err.code === '42701') results.push('⏭️ variant already exists in order_items');
        else throw e;
      }

      return NextResponse.json({ success: true, results });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Migration failed', details: String(error) }, { status: 500 });
  }
}
