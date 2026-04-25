import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// GET /api/seed-chef - One-time endpoint to create chef user
export async function GET() {
  try {
    const hash = await bcrypt.hash('chef123', 12);
    await pool.query(
      `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'chef')
       ON CONFLICT (username) DO UPDATE SET password_hash = $2, role = 'chef'`,
      ['chef', hash]
    );

    // Verify
    const { rows } = await pool.query('SELECT id, username, role FROM users');

    return NextResponse.json({ message: 'Chef user created!', users: rows });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
