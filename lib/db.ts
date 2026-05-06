import { Pool, QueryResultRow } from 'pg';

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Helper to run queries
async function query<T extends QueryResultRow>(text: string, params?: unknown[]) {
  const result = await pool.query<T>(text, params);
  return result;
}

// ==================== MENU ITEMS ====================

export interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  available: boolean;
  has_variants: boolean;
  half_price: number | null;
  full_price: number | null;
  created_at: string;
  updated_at: string;
}

export async function getMenuItems() {
  const { rows } = await query<MenuItem>(
    'SELECT * FROM menu_items ORDER BY category, name'
  );
  return rows;
}

export async function getMenuItemById(id: number) {
  const { rows } = await query<MenuItem>(
    'SELECT * FROM menu_items WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

export async function createMenuItem(
  name: string,
  price: number,
  category: string,
  available: boolean = true,
  hasVariants: boolean = false,
  halfPrice: number | null = null,
  fullPrice: number | null = null
) {
  const { rows } = await query<MenuItem>(
    'INSERT INTO menu_items (name, price, category, available, has_variants, half_price, full_price) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
    [name, price, category, available, hasVariants, halfPrice, fullPrice]
  );
  return rows[0];
}

export async function updateMenuItem(
  id: number,
  name: string,
  price: number,
  category: string,
  available: boolean,
  hasVariants: boolean = false,
  halfPrice: number | null = null,
  fullPrice: number | null = null
) {
  const { rows } = await query<MenuItem>(
    'UPDATE menu_items SET name = $1, price = $2, category = $3, available = $4, has_variants = $5, half_price = $6, full_price = $7, updated_at = NOW() WHERE id = $8 RETURNING *',
    [name, price, category, available, hasVariants, halfPrice, fullPrice, id]
  );
  return rows[0] || null;
}

export async function deleteMenuItem(id: number) {
  const result = await query(
    'DELETE FROM menu_items WHERE id = $1',
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getCategories() {
  const { rows } = await query<{ category: string }>(
    'SELECT DISTINCT category FROM menu_items ORDER BY category'
  );
  return rows.map((r) => r.category);
}

// ==================== ORDERS ====================

export interface Order {
  id: number;
  order_number: string;
  total_amount: number;
  status: string;
  source: string; // 'online' | 'offline'
  created_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  menu_item_id: number;
  item_name: string;
  quantity: number;
  price: number;
  subtotal: number;
  variant: string | null;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export async function createOrder(
  items: { menu_item_id: number; item_name: string; quantity: number; price: number; variant?: string }[],
  source: string = 'offline'
) {
  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure source column exists (safe migration)
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'offline';
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // Generate daily sequential order number using MAX inside transaction
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const prefix = `SNS-${dd}${mm}${yy}-`;

    const { rows: maxRows } = await client.query(
      "SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '[0-9]+$') AS INTEGER)), 0) + 1 as next_seq FROM orders WHERE order_number LIKE $1",
      [`${prefix}%`]
    );
    const dailySeq = maxRows[0].next_seq;
    const orderNumber = `${prefix}${String(dailySeq).padStart(3, '0')}`;

    // Create order with source
    const { rows: orderRows } = await client.query(
      'INSERT INTO orders (order_number, total_amount, source) VALUES ($1, $2, $3) RETURNING *',
      [orderNumber, totalAmount, source]
    );
    const order = orderRows[0];

    // Create order items
    for (const item of items) {
      const subtotal = item.price * item.quantity;
      await client.query(
        'INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, price, subtotal, variant) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [order.id, item.menu_item_id, item.item_name, item.quantity, item.price, subtotal, item.variant || null]
      );
    }

    await client.query('COMMIT');

    // Fetch complete order with items
    return getOrderById(order.id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getOrderById(id: number): Promise<OrderWithItems | null> {
  const { rows: orderRows } = await query<Order>(
    'SELECT * FROM orders WHERE id = $1',
    [id]
  );
  if (orderRows.length === 0) return null;

  const { rows: itemRows } = await query<OrderItem>(
    'SELECT * FROM order_items WHERE order_id = $1',
    [id]
  );

  return {
    ...orderRows[0],
    items: itemRows,
  };
}

export async function getOrders(
  page: number = 1,
  limit: number = 20,
  date?: string
) {
  const offset = (page - 1) * limit;

  let orders: Order[];
  let total: number;

  if (date) {
    const result = await query<Order>(
      'SELECT * FROM orders WHERE DATE(created_at) = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [date, limit, offset]
    );
    orders = result.rows;
    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = $1',
      [date]
    );
    total = parseInt(countResult.rows[0].count);
  } else {
    const result = await query<Order>(
      'SELECT * FROM orders ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    orders = result.rows;
    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM orders'
    );
    total = parseInt(countResult.rows[0].count);
  }

  // Fetch items for each order
  const ordersWithItems: OrderWithItems[] = [];
  for (const order of orders) {
    const { rows: itemRows } = await query<OrderItem>(
      'SELECT * FROM order_items WHERE order_id = $1',
      [order.id]
    );
    ordersWithItems.push({ ...order, items: itemRows });
  }

  return {
    orders: ordersWithItems,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function updateOrderStatus(id: number, status: string): Promise<OrderWithItems | null> {
  await query('UPDATE orders SET status = $1 WHERE id = $2', [status, id]);
  return getOrderById(id);
}

export async function getKitchenOrders(): Promise<OrderWithItems[]> {
  const { rows: orders } = await query<Order>(
    "SELECT * FROM orders WHERE DATE(created_at) = CURRENT_DATE AND status IN ('pending', 'accepted') ORDER BY created_at ASC"
  );
  const ordersWithItems: OrderWithItems[] = [];
  for (const order of orders) {
    const { rows: itemRows } = await query<OrderItem>(
      'SELECT * FROM order_items WHERE order_id = $1',
      [order.id]
    );
    ordersWithItems.push({ ...order, items: itemRows });
  }
  return ordersWithItems;
}

// ==================== REPORTS ====================

export interface DailySummary {
  date: string;
  total_orders: number;
  total_revenue: number;
  items_sold: number;
}

export async function getDailySummary(date: string): Promise<DailySummary> {
  const { rows: orderSummary } = await query<{ total_orders: string; total_revenue: string }>(
    'SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount), 0) as total_revenue FROM orders WHERE DATE(created_at) = $1',
    [date]
  );

  const { rows: itemSummary } = await query<{ items_sold: string }>(
    'SELECT COALESCE(SUM(oi.quantity), 0) as items_sold FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE DATE(o.created_at) = $1',
    [date]
  );

  return {
    date,
    total_orders: parseInt(orderSummary[0].total_orders),
    total_revenue: parseFloat(orderSummary[0].total_revenue as string),
    items_sold: parseInt(itemSummary[0].items_sold),
  };
}

export async function getOrdersForDate(date: string) {
  const { rows: orders } = await query<Order>(
    'SELECT * FROM orders WHERE DATE(created_at) = $1 ORDER BY created_at ASC',
    [date]
  );

  const ordersWithItems: OrderWithItems[] = [];
  for (const order of orders) {
    const { rows: itemRows } = await query<OrderItem>(
      'SELECT * FROM order_items WHERE order_id = $1',
      [order.id]
    );
    ordersWithItems.push({ ...order, items: itemRows });
  }

  return ordersWithItems;
}

// ==================== USERS ====================

export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  created_at: string;
}

export async function getUserByUsername(username: string) {
  const { rows } = await query<User>(
    'SELECT * FROM users WHERE username = $1',
    [username]
  );
  return rows[0] || null;
}

// ==================== SETTINGS ====================

export async function getSetting(key: string): Promise<string | null> {
  const { rows } = await query<{ value: string }>(
    'SELECT value FROM settings WHERE key = $1',
    [key]
  );
  return rows[0]?.value || null;
}

export async function setSetting(key: string, value: string) {
  await query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, value]
  );
}

export async function getAllTimeRevenue(): Promise<{ total_revenue: number; total_orders: number; total_items: number }> {
  const { rows: revRows } = await query<{ total_revenue: string; total_orders: string }>(
    'SELECT COALESCE(SUM(total_amount), 0) as total_revenue, COUNT(*) as total_orders FROM orders'
  );
  const { rows: itemRows } = await query<{ total_items: string }>(
    'SELECT COALESCE(SUM(quantity), 0) as total_items FROM order_items'
  );
  return {
    total_revenue: parseFloat(revRows[0].total_revenue),
    total_orders: parseInt(revRows[0].total_orders),
    total_items: parseInt(itemRows[0].total_items),
  };
}
