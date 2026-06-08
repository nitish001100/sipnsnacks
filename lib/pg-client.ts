/**
 * PostgreSQL Client — Neon Free Tier (512MB, free forever)
 * 
 * Replaces Google Sheets as the database layer.
 * Uses the `pg` package with connection pooling.
 */

import { Pool, QueryResult, QueryResultRow } from 'pg';

// Connection pool (reused across requests in serverless)
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('POSTGRES_URL or DATABASE_URL not configured!');
    }
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: connectionString.includes('neon') || connectionString.includes('vercel-storage')
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }
  return pool;
}

export async function query(text: string, params?: any[]): Promise<QueryResult> {
  const client = getPool();
  try {
    return await client.query(text, params);
  } catch (error: any) {
    console.error('DB Query Error:', error.message, '\nQuery:', text.substring(0, 200));
    throw error;
  }
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const result = await query(text, params);
  return (result.rows[0] as T) || null;
}

export async function queryAll<T = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await query(text, params);
  return result.rows as T[];
}

/**
 * Initialize database schema — creates all tables if they don't exist.
 * Safe to call on every cold start.
 */
export async function initSchema(): Promise<void> {
  await query(`
    -- Users
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'admin',
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Menu Items
    CREATE TABLE IF NOT EXISTS menu_items (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      price NUMERIC(10,2) NOT NULL,
      category VARCHAR(100) NOT NULL,
      available BOOLEAN DEFAULT TRUE,
      has_variants BOOLEAN DEFAULT FALSE,
      half_price NUMERIC(10,2),
      full_price NUMERIC(10,2),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Orders
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_number VARCHAR(50) UNIQUE NOT NULL,
      total_amount NUMERIC(10,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      source VARCHAR(20) DEFAULT 'offline',
      customer_whatsapp VARCHAR(20),
      customer_name VARCHAR(255),
      customer_address TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Order Items
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      menu_item_id INTEGER,
      item_name VARCHAR(255) NOT NULL,
      quantity INTEGER NOT NULL,
      price NUMERIC(10,2) NOT NULL,
      subtotal NUMERIC(10,2) NOT NULL,
      variant VARCHAR(20)
    );

    -- Settings
    CREATE TABLE IF NOT EXISTS settings (
      key VARCHAR(255) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Push Tokens
    CREATE TABLE IF NOT EXISTS push_tokens (
      id SERIAL PRIMARY KEY,
      token TEXT NOT NULL,
      user_role VARCHAR(50) DEFAULT 'kitchen',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Ingredients (Inventory)
    CREATE TABLE IF NOT EXISTS ingredients (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      unit VARCHAR(50) NOT NULL,
      current_quantity NUMERIC(10,2) DEFAULT 0,
      minimum_quantity NUMERIC(10,2) DEFAULT 0,
      unit_cost NUMERIC(10,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Menu Item Ingredients (Recipes)
    CREATE TABLE IF NOT EXISTS menu_item_ingredients (
      id SERIAL PRIMARY KEY,
      menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
      ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE CASCADE,
      quantity_required NUMERIC(10,3) NOT NULL
    );

    -- Inventory Transactions
    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id SERIAL PRIMARY KEY,
      ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE CASCADE,
      transaction_type VARCHAR(50) NOT NULL,
      quantity_change NUMERIC(10,3) NOT NULL,
      order_id INTEGER,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Daily Backups log
    CREATE TABLE IF NOT EXISTS daily_backups (
      id SERIAL PRIMARY KEY,
      backup_date DATE UNIQUE NOT NULL,
      backup_data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_tx_ingredient ON inventory_transactions(ingredient_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_tx_created ON inventory_transactions(created_at);

    -- Add missing columns to existing tables (safe - IF NOT EXISTS)
    DO $$ BEGIN
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'offline';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_whatsapp VARCHAR(20);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_address TEXT;
    EXCEPTION WHEN OTHERS THEN NULL;
    END $$;
  `);
}
