/**
 * Database layer — powered by PostgreSQL (Neon Free Tier)
 * 
 * 512MB free storage, unlimited API calls, proper SQL with indexes.
 * All exports match the previous API so routes work unchanged.
 */

import { query, queryOne, queryAll, initSchema } from './pg-client';

// Auto-init schema on first import (non-blocking)
let _initialized = false;
async function ensureSchema() {
  if (!_initialized) {
    _initialized = true;
    try { await initSchema(); } catch (e) { console.error('Schema init error:', e); _initialized = false; }
  }
}

function now(): string { return new Date().toISOString(); }

function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

// ==================== MENU ITEMS ====================

export interface MenuItem {
  id: number; name: string; price: number; category: string;
  available: boolean; has_variants: boolean;
  half_price: number | null; full_price: number | null;
  created_at: string; updated_at: string;
}

export async function getMenuItems(): Promise<MenuItem[]> {
  await ensureSchema();
  return queryAll<MenuItem>('SELECT * FROM menu_items ORDER BY category, name');
}

export async function getMenuItemById(id: number): Promise<MenuItem | null> {
  await ensureSchema();
  return queryOne<MenuItem>('SELECT * FROM menu_items WHERE id = $1', [id]);
}

export async function createMenuItem(
  name: string, price: number, category: string, available = true,
  hasVariants = false, halfPrice: number | null = null, fullPrice: number | null = null
): Promise<MenuItem> {
  await ensureSchema();
  return (await queryOne<MenuItem>(
    `INSERT INTO menu_items (name, price, category, available, has_variants, half_price, full_price)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [name, price, category, available, hasVariants, halfPrice, fullPrice]
  ))!;
}

export async function updateMenuItem(
  id: number, name: string, price: number, category: string, available: boolean,
  hasVariants = false, halfPrice: number | null = null, fullPrice: number | null = null
): Promise<MenuItem | null> {
  await ensureSchema();
  return queryOne<MenuItem>(
    `UPDATE menu_items SET name=$2, price=$3, category=$4, available=$5,
     has_variants=$6, half_price=$7, full_price=$8, updated_at=NOW()
     WHERE id=$1 RETURNING *`,
    [id, name, price, category, available, hasVariants, halfPrice, fullPrice]
  );
}

export async function deleteMenuItem(id: number): Promise<boolean> {
  await ensureSchema();
  const r = await query('DELETE FROM menu_items WHERE id=$1', [id]);
  return (r.rowCount || 0) > 0;
}

export async function deleteAllMenuItems(): Promise<number> {
  await ensureSchema();
  const r = await query('DELETE FROM menu_items');
  return r.rowCount || 0;
}

export async function getCategories(): Promise<string[]> {
  await ensureSchema();
  const rows = await queryAll<{ category: string }>(
    'SELECT DISTINCT category FROM menu_items ORDER BY category'
  );
  return rows.map(r => r.category);
}

// ==================== ORDERS ====================

export interface Order {
  id: number; order_number: string; total_amount: number; status: string;
  source: string; customer_whatsapp: string | null; customer_name: string | null;
  customer_address?: string | null; created_at: string;
}

export interface OrderItem {
  id: number; order_id: number; menu_item_id: number; item_name: string;
  quantity: number; price: number; subtotal: number; variant: string | null;
}

export interface OrderWithItems extends Order { items: OrderItem[]; }

export async function createOrder(
  items: { menu_item_id: number; item_name: string; quantity: number; price: number; variant?: string }[],
  source = 'offline', customerWhatsapp?: string, customerName?: string, customerAddress?: string
): Promise<OrderWithItems | null> {
  await ensureSchema();
  const totalAmount = items.reduce((s, i) => s + i.price * i.quantity, 0);

  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const prefix = `SNS-${dd}${mm}${yy}-`;

  // Get next sequence with retry for race conditions
  let order: Order | null = null;
  let orderNumber = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const seqRow = await queryOne<{ max_seq: number }>(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM $1) AS INTEGER)), 0) as max_seq
       FROM orders WHERE order_number LIKE $2`,
      [prefix.length + 1, `${prefix}%`]
    );
    const seq = (seqRow?.max_seq || 0) + 1 + attempt;
    orderNumber = `${prefix}${String(seq).padStart(3, '0')}`;

    try {
      order = await queryOne<Order>(
        `INSERT INTO orders (order_number, total_amount, status, source, customer_whatsapp, customer_name, customer_address)
         VALUES ($1,$2,'pending',$3,$4,$5,$6) RETURNING *`,
        [orderNumber, totalAmount, source, customerWhatsapp || null, customerName || null, customerAddress || null]
      );
      if (order) break;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('duplicate') && attempt < 4) {
        console.log(`Order number ${orderNumber} conflict, retrying...`);
        continue;
      }
      throw e;
    }
  }
  if (!order) return null;

  const orderItems: OrderItem[] = [];
  for (const item of items) {
    const subtotal = item.price * item.quantity;
    const oi = await queryOne<OrderItem>(
      `INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, price, subtotal, variant)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [order.id, item.menu_item_id, item.item_name, item.quantity, item.price, subtotal, item.variant || null]
    );
    if (oi) orderItems.push(oi);
  }

  // Auto-deduct ingredients (BLOCKING - must complete before response on serverless)
  try {
    await deductIngredientsForOrder(orderItems, order.id);
    console.log(`✅ Ingredients deducted for order ${orderNumber}`);
  } catch (e) {
    console.error('❌ Ingredient deduction failed for order', orderNumber, e);
  }

  return { ...order, items: orderItems };
}

export async function getOrderById(id: number): Promise<OrderWithItems | null> {
  await ensureSchema();
  const order = await queryOne<Order>('SELECT * FROM orders WHERE id=$1', [id]);
  if (!order) return null;
  const items = await queryAll<OrderItem>('SELECT * FROM order_items WHERE order_id=$1', [id]);
  return { ...order, items };
}

export async function getOrders(
  page = 1, limit = 20, date?: string
): Promise<{ orders: OrderWithItems[]; total: number; page: number; limit: number; totalPages: number }> {
  await ensureSchema();
  const offset = (page - 1) * limit;
  let whereClause = '';
  const params: any[] = [];

  if (date) {
    whereClause = `WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = $1`;
    params.push(date);
  }

  const countResult = await queryOne<{ count: string }>(`SELECT COUNT(*) FROM orders ${whereClause}`, params);
  const total = parseInt(countResult?.count || '0');

  const orderParams = [...params, limit, offset];
  const orders = await queryAll<Order>(
    `SELECT * FROM orders ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    orderParams
  );

  const allItems = orders.length > 0
    ? await queryAll<OrderItem>(`SELECT * FROM order_items WHERE order_id = ANY($1)`, [orders.map(o => o.id)])
    : [];

  const ordersWithItems = orders.map(o => ({
    ...o,
    items: allItems.filter(i => i.order_id === o.id),
  }));

  return { orders: ordersWithItems, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function updateOrderStatus(id: number, status: string): Promise<OrderWithItems | null> {
  await ensureSchema();
  await query('UPDATE orders SET status=$2 WHERE id=$1', [id, status]);
  return getOrderById(id);
}

export async function getKitchenOrders(): Promise<OrderWithItems[]> {
  await ensureSchema();
  const today = todayIST();
  const orders = await queryAll<Order>(
    `SELECT * FROM orders
     WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = $1
       AND status IN ('pending','accepted')
     ORDER BY created_at ASC`,
    [today]
  );
  if (orders.length === 0) return [];
  const items = await queryAll<OrderItem>(`SELECT * FROM order_items WHERE order_id = ANY($1)`, [orders.map(o => o.id)]);
  return orders.map(o => ({ ...o, items: items.filter(i => i.order_id === o.id) }));
}

export async function resetAllOrders(): Promise<{ orders: number; order_items: number }> {
  await ensureSchema();
  const itemsResult = await query('DELETE FROM order_items');
  const ordersResult = await query('DELETE FROM orders');
  return { orders: ordersResult.rowCount || 0, order_items: itemsResult.rowCount || 0 };
}

export async function getRecentOnlineOrders(): Promise<OrderWithItems[]> {
  await ensureSchema();
  const orders = await queryAll<Order>(
    `SELECT * FROM orders WHERE source='online' AND created_at > NOW() - INTERVAL '24 hours'
     ORDER BY created_at DESC LIMIT 20`
  );
  if (orders.length === 0) return [];
  const items = await queryAll<OrderItem>(`SELECT * FROM order_items WHERE order_id = ANY($1)`, [orders.map(o => o.id)]);
  return orders.map(o => ({ ...o, items: items.filter(i => i.order_id === o.id) }));
}

export async function getOverdueOrders(thresholdMinutes: number): Promise<Array<Order & { minutes_pending: number; items_summary: string }>> {
  await ensureSchema();
  const today = todayIST();
  const rows = await queryAll<Order & { minutes_pending: number }>(
    `SELECT *, EXTRACT(EPOCH FROM (NOW() - created_at))/60 AS minutes_pending
     FROM orders
     WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = $1
       AND status = 'pending'
       AND created_at < NOW() - ($2 || ' minutes')::INTERVAL
     ORDER BY created_at ASC`,
    [today, thresholdMinutes]
  );
  if (rows.length === 0) return [];
  const items = await queryAll<OrderItem>(`SELECT * FROM order_items WHERE order_id = ANY($1)`, [rows.map(o => o.id)]);
  return rows.map(o => ({
    ...o,
    minutes_pending: Math.round(Number(o.minutes_pending)),
    items_summary: items.filter(i => i.order_id === o.id).map(i => `${i.item_name} x${i.quantity}`).join(', ') || '-',
  }));
}

// ==================== REPORTS ====================

export interface DailySummary { date: string; total_orders: number; total_revenue: number; items_sold: number; }

export async function getDailySummary(date: string): Promise<DailySummary> {
  await ensureSchema();
  const r = await queryOne<{ total_orders: string; total_revenue: string }>(
    `SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount),0) as total_revenue
     FROM orders WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = $1`, [date]
  );
  const itemsR = await queryOne<{ items_sold: string }>(
    `SELECT COALESCE(SUM(oi.quantity),0) as items_sold
     FROM order_items oi JOIN orders o ON oi.order_id = o.id
     WHERE (o.created_at AT TIME ZONE 'Asia/Kolkata')::date = $1`, [date]
  );
  return {
    date,
    total_orders: parseInt(r?.total_orders || '0'),
    total_revenue: parseFloat(r?.total_revenue || '0'),
    items_sold: parseInt(itemsR?.items_sold || '0'),
  };
}

export async function getOrdersForDate(date: string): Promise<OrderWithItems[]> {
  await ensureSchema();
  const orders = await queryAll<Order>(
    `SELECT * FROM orders WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = $1 ORDER BY created_at`, [date]
  );
  if (orders.length === 0) return [];
  const items = await queryAll<OrderItem>(`SELECT * FROM order_items WHERE order_id = ANY($1)`, [orders.map(o => o.id)]);
  return orders.map(o => ({ ...o, items: items.filter(i => i.order_id === o.id) }));
}

export async function getAllTimeRevenue(): Promise<{ total_revenue: number; total_orders: number; total_items: number }> {
  await ensureSchema();
  const r = await queryOne<any>(`SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount),0) as total_revenue FROM orders`);
  const ir = await queryOne<any>(`SELECT COALESCE(SUM(quantity),0) as total_items FROM order_items`);
  return {
    total_revenue: parseFloat(r?.total_revenue || '0'),
    total_orders: parseInt(r?.total_orders || '0'),
    total_items: parseInt(ir?.total_items || '0'),
  };
}

// ==================== DASHBOARD ====================

export interface DashboardStats {
  statusCounts: Record<string, number>;
  recentOrders: Array<{ id: number; order_number: string; total_amount: number; status: string; created_at: string; item_count: number }>;
  topItems: Array<{ item_name: string; total_qty: number; total_revenue: number }>;
  hourlySales: Array<{ hour: number; count: number; revenue: number }>;
  allTime: { total_revenue: number; total_orders: number };
  dailyBreakdown: Array<{ date: string; revenue: number; orders: number; items: number }>;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  await ensureSchema();
  const today = todayIST();

  // Status counts
  const statusRows = await queryAll<{ status: string; count: string }>(
    `SELECT COALESCE(status,'pending') as status, COUNT(*) as count FROM orders
     WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = $1 GROUP BY status`, [today]
  );
  const statusCounts: Record<string, number> = { pending: 0, accepted: 0, completed: 0 };
  statusRows.forEach(r => { statusCounts[r.status] = parseInt(r.count); });

  // Recent orders
  const recentOrders = await queryAll<any>(
    `SELECT o.id, o.order_number, o.total_amount, o.status, o.created_at,
            COALESCE(SUM(oi.quantity),0) as item_count
     FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE (o.created_at AT TIME ZONE 'Asia/Kolkata')::date = $1
     GROUP BY o.id ORDER BY o.created_at DESC LIMIT 10`, [today]
  );

  // Top items
  const topItems = await queryAll<any>(
    `SELECT oi.item_name, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total_revenue
     FROM order_items oi JOIN orders o ON oi.order_id = o.id
     WHERE (o.created_at AT TIME ZONE 'Asia/Kolkata')::date = $1
     GROUP BY oi.item_name ORDER BY total_qty DESC LIMIT 8`, [today]
  );

  // Hourly sales
  const hourlySales = await queryAll<any>(
    `SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata') as hour,
            COUNT(*) as count, SUM(total_amount) as revenue
     FROM orders WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = $1
     GROUP BY hour ORDER BY hour`, [today]
  );

  // All time
  const allTime = await queryOne<any>(`SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount),0) as total_revenue FROM orders`);

  // Daily breakdown
  const dailyBreakdown = await queryAll<any>(
    `SELECT (o.created_at AT TIME ZONE 'Asia/Kolkata')::date as date,
            SUM(o.total_amount) as revenue, COUNT(DISTINCT o.id) as orders,
            COALESCE(SUM(oi.quantity),0) as items
     FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
     GROUP BY date ORDER BY date DESC LIMIT 30`
  );

  return {
    statusCounts,
    recentOrders: recentOrders.map(r => ({ ...r, total_amount: parseFloat(r.total_amount), item_count: parseInt(r.item_count) })),
    topItems: topItems.map(r => ({ item_name: r.item_name, total_qty: parseInt(r.total_qty), total_revenue: parseFloat(r.total_revenue) })),
    hourlySales: hourlySales.map(r => ({ hour: parseInt(r.hour), count: parseInt(r.count), revenue: parseFloat(r.revenue) })),
    allTime: { total_revenue: parseFloat(allTime?.total_revenue || '0'), total_orders: parseInt(allTime?.total_orders || '0') },
    dailyBreakdown: dailyBreakdown.map(r => ({ date: r.date, revenue: parseFloat(r.revenue), orders: parseInt(r.orders), items: parseInt(r.items) })),
  };
}

// ==================== USERS ====================

export interface User { id: number; username: string; password_hash: string; role: string; created_at: string; }

export async function getUserByUsername(username: string): Promise<User | null> {
  await ensureSchema();
  return queryOne<User>('SELECT * FROM users WHERE username=$1', [username]);
}

// ==================== SETTINGS ====================

export async function getSetting(key: string): Promise<string | null> {
  await ensureSchema();
  const r = await queryOne<{ value: string }>('SELECT value FROM settings WHERE key=$1', [key]);
  return r?.value || null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await ensureSchema();
  await query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1,$2,NOW())
     ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
    [key, value]
  );
}

// ==================== PUSH TOKENS ====================

export async function getPushTokens(): Promise<string[]> {
  await ensureSchema();
  const rows = await queryAll<{ token: string }>('SELECT token FROM push_tokens');
  return rows.map(r => r.token);
}

export async function registerPushToken(token: string, role = 'kitchen'): Promise<void> {
  await ensureSchema();
  const existing = await queryOne('SELECT id FROM push_tokens WHERE token=$1', [token]);
  if (existing) {
    await query('UPDATE push_tokens SET user_role=$2, updated_at=NOW() WHERE token=$1', [token, role]);
  } else {
    await query('INSERT INTO push_tokens (token, user_role) VALUES ($1,$2)', [token, role]);
  }
}

export async function deletePushToken(token: string): Promise<void> {
  await ensureSchema();
  await query('DELETE FROM push_tokens WHERE token=$1', [token]);
}

// ==================== INGREDIENTS ====================

export interface Ingredient {
  id: number; name: string; unit: string; current_quantity: number;
  minimum_quantity: number; unit_cost: number; created_at: string; updated_at: string;
}

export async function getIngredients(): Promise<Ingredient[]> {
  await ensureSchema();
  return queryAll<Ingredient>('SELECT * FROM ingredients ORDER BY name');
}

export async function getIngredientById(id: number): Promise<Ingredient | null> {
  await ensureSchema();
  return queryOne<Ingredient>('SELECT * FROM ingredients WHERE id=$1', [id]);
}

export async function createIngredient(name: string, unit: string, currentQuantity = 0, minimumQuantity = 0, unitCost = 0): Promise<Ingredient> {
  await ensureSchema();
  return (await queryOne<Ingredient>(
    `INSERT INTO ingredients (name, unit, current_quantity, minimum_quantity, unit_cost)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, unit, currentQuantity, minimumQuantity, unitCost]
  ))!;
}

export async function updateIngredient(id: number, data: Partial<{ name: string; unit: string; current_quantity: number; minimum_quantity: number; unit_cost: number }>): Promise<Ingredient | null> {
  await ensureSchema();
  const sets: string[] = [];
  const params: any[] = [id];
  let idx = 2;
  if (data.name !== undefined) { sets.push(`name=$${idx++}`); params.push(data.name); }
  if (data.unit !== undefined) { sets.push(`unit=$${idx++}`); params.push(data.unit); }
  if (data.current_quantity !== undefined) { sets.push(`current_quantity=$${idx++}`); params.push(data.current_quantity); }
  if (data.minimum_quantity !== undefined) { sets.push(`minimum_quantity=$${idx++}`); params.push(data.minimum_quantity); }
  if (data.unit_cost !== undefined) { sets.push(`unit_cost=$${idx++}`); params.push(data.unit_cost); }
  if (sets.length === 0) return getIngredientById(id);
  sets.push('updated_at=NOW()');
  return queryOne<Ingredient>(`UPDATE ingredients SET ${sets.join(',')} WHERE id=$1 RETURNING *`, params);
}

export async function deleteIngredient(id: number): Promise<boolean> {
  await ensureSchema();
  await query('DELETE FROM menu_item_ingredients WHERE ingredient_id=$1', [id]);
  const r = await query('DELETE FROM ingredients WHERE id=$1', [id]);
  return (r.rowCount || 0) > 0;
}

export async function getLowStockIngredients(): Promise<Ingredient[]> {
  await ensureSchema();
  return queryAll<Ingredient>(
    'SELECT * FROM ingredients WHERE current_quantity <= minimum_quantity AND minimum_quantity > 0 ORDER BY name'
  );
}

// ==================== RECIPES ====================

export interface MenuItemIngredient { id: number; menu_item_id: number; ingredient_id: number; quantity_required: number; }

export async function getMenuItemRecipe(menuItemId: number): Promise<Array<MenuItemIngredient & { ingredient_name?: string; ingredient_unit?: string }>> {
  await ensureSchema();
  return queryAll(
    `SELECT mii.*, i.name as ingredient_name, i.unit as ingredient_unit
     FROM menu_item_ingredients mii JOIN ingredients i ON mii.ingredient_id = i.id
     WHERE mii.menu_item_id = $1`, [menuItemId]
  );
}

export async function setMenuItemRecipe(menuItemId: number, ingredients: Array<{ ingredient_id: number; quantity_required: number }>): Promise<void> {
  await ensureSchema();
  await query('DELETE FROM menu_item_ingredients WHERE menu_item_id=$1', [menuItemId]);
  for (const ing of ingredients) {
    await query('INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, quantity_required) VALUES ($1,$2,$3)',
      [menuItemId, ing.ingredient_id, ing.quantity_required]);
  }
}

export async function getAllRecipes(): Promise<Array<MenuItemIngredient & { ingredient_name?: string; ingredient_unit?: string; menu_item_name?: string }>> {
  await ensureSchema();
  return queryAll(
    `SELECT mii.*, i.name as ingredient_name, i.unit as ingredient_unit, m.name as menu_item_name
     FROM menu_item_ingredients mii
     JOIN ingredients i ON mii.ingredient_id = i.id
     JOIN menu_items m ON mii.menu_item_id = m.id`
  );
}

// ==================== INVENTORY TRANSACTIONS ====================

export interface InventoryTransaction {
  id: number; ingredient_id: number; transaction_type: string;
  quantity_change: number; order_id: number | null; notes: string; created_at: string;
}

export async function getInventoryTransactions(ingredientId?: number, limit = 50): Promise<Array<InventoryTransaction & { ingredient_name?: string }>> {
  await ensureSchema();
  if (ingredientId) {
    return queryAll(
      `SELECT it.*, i.name as ingredient_name FROM inventory_transactions it
       JOIN ingredients i ON it.ingredient_id = i.id
       WHERE it.ingredient_id = $1 ORDER BY it.created_at DESC LIMIT $2`,
      [ingredientId, limit]
    );
  }
  return queryAll(
    `SELECT it.*, i.name as ingredient_name FROM inventory_transactions it
     JOIN ingredients i ON it.ingredient_id = i.id
     ORDER BY it.created_at DESC LIMIT $1`, [limit]
  );
}

export async function addInventoryStock(ingredientId: number, quantity: number, notes = ''): Promise<Ingredient | null> {
  await ensureSchema();
  const type = quantity >= 0 ? 'manual_add' : 'manual_subtract';
  await query(
    'UPDATE ingredients SET current_quantity = current_quantity + $2, updated_at=NOW() WHERE id=$1',
    [ingredientId, quantity]
  );
  await query(
    'INSERT INTO inventory_transactions (ingredient_id, transaction_type, quantity_change, notes) VALUES ($1,$2,$3,$4)',
    [ingredientId, type, quantity, notes || `Manual ${type}`]
  );
  return getIngredientById(ingredientId);
}

export async function deductIngredientsForOrder(
  orderItems: Array<{ menu_item_id: number; quantity: number; item_name: string }>,
  orderId: number
): Promise<void> {
  await ensureSchema();
  const recipes = await queryAll<MenuItemIngredient>('SELECT * FROM menu_item_ingredients');
  if (recipes.length === 0) return;

  const deductions = new Map<number, { total: number; details: string[] }>();
  for (const oi of orderItems) {
    const itemRecipes = recipes.filter(r => r.menu_item_id === oi.menu_item_id);
    for (const recipe of itemRecipes) {
      const qty = Number(recipe.quantity_required) * oi.quantity;
      const existing = deductions.get(recipe.ingredient_id) || { total: 0, details: [] };
      existing.total += qty;
      existing.details.push(`${oi.item_name} x${oi.quantity}`);
      deductions.set(recipe.ingredient_id, existing);
    }
  }
  if (deductions.size === 0) return;

  for (const [ingredientId, { total, details }] of Array.from(deductions)) {
    await query('UPDATE ingredients SET current_quantity = current_quantity - $2, updated_at=NOW() WHERE id=$1', [ingredientId, total]);
    await query(
      'INSERT INTO inventory_transactions (ingredient_id, transaction_type, quantity_change, order_id, notes) VALUES ($1,$2,$3,$4,$5)',
      [ingredientId, 'order_deduction', -total, orderId, `Order #${orderId}: ${details.join(', ')}`]
    );
  }
}

export async function checkIngredientAvailability(
  items: Array<{ menu_item_id: number; quantity: number }>
): Promise<{ available: boolean; shortages: Array<{ ingredient_name: string; needed: number; available: number; unit: string }> }> {
  await ensureSchema();
  const recipes = await queryAll<MenuItemIngredient>('SELECT * FROM menu_item_ingredients');
  if (recipes.length === 0) return { available: true, shortages: [] };

  const ingredients = await getIngredients();
  const ingredientMap = new Map(ingredients.map(i => [i.id, i]));
  const needs = new Map<number, number>();

  for (const item of items) {
    for (const r of recipes.filter(r => r.menu_item_id === item.menu_item_id)) {
      needs.set(r.ingredient_id, (needs.get(r.ingredient_id) || 0) + Number(r.quantity_required) * item.quantity);
    }
  }

  const shortages: Array<{ ingredient_name: string; needed: number; available: number; unit: string }> = [];
  for (const [id, needed] of Array.from(needs)) {
    const ing = ingredientMap.get(id);
    if (ing && Number(ing.current_quantity) < needed) {
      shortages.push({ ingredient_name: ing.name, needed, available: Number(ing.current_quantity), unit: ing.unit });
    }
  }
  return { available: shortages.length === 0, shortages };
}

// ==================== DAILY BACKUP ====================

export async function createDailyBackup(): Promise<{ date: string; tables: Record<string, number> }> {
  await ensureSchema();
  const today = todayIST();

  const [menuItems, orders, orderItems, settings, users, ingredients, recipes, transactions] = await Promise.all([
    queryAll('SELECT * FROM menu_items'),
    queryAll('SELECT * FROM orders'),
    queryAll('SELECT * FROM order_items'),
    queryAll('SELECT * FROM settings'),
    queryAll('SELECT id, username, role, created_at FROM users'), // exclude password hashes
    queryAll('SELECT * FROM ingredients'),
    queryAll('SELECT * FROM menu_item_ingredients'),
    queryAll('SELECT * FROM inventory_transactions'),
  ]);

  const backupData = {
    backup_date: today,
    backup_time: new Date().toISOString(),
    tables: {
      menu_items: menuItems,
      orders,
      order_items: orderItems,
      settings,
      users,
      ingredients,
      menu_item_ingredients: recipes,
      inventory_transactions: transactions,
    },
  };

  // Upsert backup (one per day)
  await query(
    `INSERT INTO daily_backups (backup_date, backup_data)
     VALUES ($1, $2)
     ON CONFLICT (backup_date) DO UPDATE SET backup_data = $2, created_at = NOW()`,
    [today, JSON.stringify(backupData)]
  );

  // Keep only last 30 days of backups
  await query(`DELETE FROM daily_backups WHERE backup_date < CURRENT_DATE - INTERVAL '30 days'`);

  return {
    date: today,
    tables: {
      menu_items: menuItems.length,
      orders: orders.length,
      order_items: orderItems.length,
      settings: settings.length,
      ingredients: ingredients.length,
      recipes: recipes.length,
      transactions: transactions.length,
    },
  };
}
