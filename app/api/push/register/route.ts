import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getAuthFromHeaders } from '@/lib/auth';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// POST /api/push/register - Register FCM token
export async function POST(request: Request) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    // Create table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_tokens (
        id SERIAL PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,
        user_role TEXT DEFAULT 'kitchen',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Upsert token
    await pool.query(
      `INSERT INTO push_tokens (token, user_role, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (token) DO UPDATE SET updated_at = NOW(), user_role = $2`,
      [token, auth.role || 'kitchen']
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push register error:', error);
    return NextResponse.json({ error: 'Failed to register token' }, { status: 500 });
  }
}

// DELETE /api/push/register - Remove FCM token
export async function DELETE(request: Request) {
  try {
    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    await pool.query('DELETE FROM push_tokens WHERE token = $1', [token]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push unregister error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
