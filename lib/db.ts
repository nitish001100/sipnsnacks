/**
 * Database layer — powered by Google Sheets (FREE forever)
 *
 * Every "table" is a sheet tab inside one Google Spreadsheet.
 * All original exports are preserved so existing API routes work unchanged.
 */

import {
  SHEET,
  readSheet,
  readDataRows,
  appendRow,
  appendRows,
  updateRow,
  deleteRow,
  deleteRows,
  clearSheet,
  getNextId,
  findDataIndex,
  findAllDataIndices,
  invalidateCache,
} from './sheets-client';

// ==================== Parse Helpers ====================

function num(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  return parseFloat(v) || 0;
}

function int(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  return parseInt(v, 10) || 0;
}

function bool(v: any): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return v === 'true' || v === 'TRUE' || v === '1';
}

function str(v: any): string {
  if (v === null || v === undefined || v === '') return '';
  return String(v);
}

function strOrNull(v: any): string | null {
  if (v === null || v === undefined || v === '') return null;
  return String(v);
}

function numOrNull(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function now(): string {
  return new Date().toISOString();
}

/** Returns YYYY-MM-DD in Asia/Kolkata timezone */
function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** Extract YYYY-MM-DD from an ISO timestamp in Asia/Kolkata timezone */
function dateOfISO(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  } catch {
    return iso.split('T')[0] || '';
  }
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

function parseMenuItem(row: string[]): MenuItem {
  return {
    id: int(row[0]),
    name: str(row[1]),
    price: num(row[2]),
    category: str(row[3]),
    available: bool(row[4]),
    has_variants: bool(row[5]),
    half_price: numOrNull(row[6]),
    full_price: numOrNull(row[7]),
    created_at: str(row[8]),
    updated_at: str(row[9]),
  };
}

export async function getMenuItems(): Promise<MenuItem[]> {
  const rows = await readDataRows(SHEET.MENU_ITEMS);
  return rows
    .map(parseMenuItem)
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

export async function getMenuItemById(id: number): Promise<MenuItem | null> {
  const rows = await readSheet(SHEET.MENU_ITEMS);
  const idx = findDataIndex(rows, 0, String(id));
  if (idx === -1) return null;
  return parseMenuItem(rows[idx + 1]);
}

export async function createMenuItem(
  name: string,
  price: number,
  category: string,
  available: boolean = true,
  hasVariants: boolean = false,
  halfPrice: number | null = null,
  fullPrice: number | null = null
): Promise<MenuItem> {
  const id = await getNextId(SHEET.MENU_ITEMS);
  const ts = now();
  await appendRow(SHEET.MENU_ITEMS, [
    id, name, price, category, available, hasVariants,
    halfPrice ?? '', fullPrice ?? '', ts, ts,
  ]);
  return {
    id, name, price, category, available,
    has_variants: hasVariants,
    half_price: halfPrice,
    full_price: fullPrice,
    created_at: ts,
    updated_at: ts,
  };
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
): Promise<MenuItem | null> {
  const rows = await readSheet(SHEET.MENU_ITEMS);
  const idx = findDataIndex(rows, 0, String(id));
  if (idx === -1) return null;

  const existing = rows[idx + 1];
  const ts = now();
  await updateRow(SHEET.MENU_ITEMS, idx, [
    id, name, price, category, available, hasVariants,
    halfPrice ?? '', fullPrice ?? '', existing[8] || ts, ts,
  ]);

  return {
    id, name, price, category, available,
    has_variants: hasVariants,
    half_price: halfPrice,
    full_price: fullPrice,
    created_at: existing[8] || ts,
    updated_at: ts,
  };
}

export async function deleteMenuItem(id: number): Promise<boolean> {
  const rows = await readSheet(SHEET.MENU_ITEMS);
  const idx = findDataIndex(rows, 0, String(id));
  if (idx === -1) return false;
  await deleteRow(SHEET.MENU_ITEMS, idx);
  return true;
}

export async function deleteAllMenuItems(): Promise<number> {
  return clearSheet(SHEET.MENU_ITEMS);
}

export async function getCategories(): Promise<string[]> {
  const items = await getMenuItems();
  const cats = Array.from(new Set(items.map(i => i.category)));
  return cats.sort();
}

// ==================== ORDERS ====================

export interface Order {
  id: number;
  order_number: string;
  total_amount: number;
  status: string;
  source: string;
  customer_whatsapp: string | null;
  customer_name: string | null;
  customer_address?: string | null;
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

function parseOrder(row: string[]): Order {
  return {
    id: int(row[0]),
    order_number: str(row[1]),
    total_amount: num(row[2]),
    status: str(row[3]) || 'pending',
    source: str(row[4]) || 'offline',
    customer_whatsapp: strOrNull(row[5]),
    customer_name: strOrNull(row[6]),
    customer_address: strOrNull(row[7]),
    created_at: str(row[8]),
  };
}

function parseOrderItem(row: string[]): OrderItem {
  return {
    id: int(row[0]),
    order_id: int(row[1]),
    menu_item_id: int(row[2]),
    item_name: str(row[3]),
    quantity: int(row[4]),
    price: num(row[5]),
    subtotal: num(row[6]),
    variant: strOrNull(row[7]),
  };
}

export async function createOrder(
  items: { menu_item_id: number; item_name: string; quantity: number; price: number; variant?: string }[],
  source: string = 'offline',
  customerWhatsapp?: string,
  customerName?: string,
  customerAddress?: string
): Promise<OrderWithItems | null> {
  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Generate daily sequential order number
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const prefix = `SNS-${dd}${mm}${yy}-`;

  // Find max sequence for today
  const orderRows = await readDataRows(SHEET.ORDERS);
  let maxSeq = 0;
  for (const row of orderRows) {
    const on = str(row[1]);
    if (on.startsWith(prefix)) {
      const seq = parseInt(on.substring(prefix.length)) || 0;
      if (seq > maxSeq) maxSeq = seq;
    }
  }
  const orderNumber = `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;

  const orderId = await getNextId(SHEET.ORDERS);
  const ts = now();

  // Append order row
  await appendRow(SHEET.ORDERS, [
    orderId, orderNumber, totalAmount, 'pending', source,
    customerWhatsapp || '', customerName || '', customerAddress || '', ts,
  ]);

  // Append order items
  let nextItemId = await getNextId(SHEET.ORDER_ITEMS);
  const orderItems: OrderItem[] = [];
  const itemRows: any[][] = [];

  for (const item of items) {
    const subtotal = item.price * item.quantity;
    const itemId = nextItemId++;
    itemRows.push([
      itemId, orderId, item.menu_item_id, item.item_name,
      item.quantity, item.price, subtotal, item.variant || '',
    ]);
    orderItems.push({
      id: itemId,
      order_id: orderId,
      menu_item_id: item.menu_item_id,
      item_name: item.item_name,
      quantity: item.quantity,
      price: item.price,
      subtotal,
      variant: item.variant || null,
    });
  }

  if (itemRows.length > 0) {
    await appendRows(SHEET.ORDER_ITEMS, itemRows);
  }

  // Auto-deduct ingredients (non-blocking, best-effort)
  deductIngredientsForOrder(orderItems, orderId).catch(err =>
    console.error('Ingredient deduction failed (non-blocking):', err)
  );

  return {
    id: orderId,
    order_number: orderNumber,
    total_amount: totalAmount,
    status: 'pending',
    source,
    customer_whatsapp: customerWhatsapp || null,
    customer_name: customerName || null,
    customer_address: customerAddress || null,
    created_at: ts,
    items: orderItems,
  };
}

export async function getOrderById(id: number): Promise<OrderWithItems | null> {
  const orderRows = await readSheet(SHEET.ORDERS);
  const idx = findDataIndex(orderRows, 0, String(id));
  if (idx === -1) return null;

  const order = parseOrder(orderRows[idx + 1]);

  const allItemRows = await readDataRows(SHEET.ORDER_ITEMS);
  const items = allItemRows
    .filter(r => int(r[1]) === id)
    .map(parseOrderItem);

  return { ...order, items };
}

export async function getOrders(
  page: number = 1,
  limit: number = 20,
  date?: string
): Promise<{ orders: OrderWithItems[]; total: number; page: number; limit: number; totalPages: number }> {
  const allOrderRows = await readDataRows(SHEET.ORDERS);
  let orders = allOrderRows.map(parseOrder);

  // Filter by date if specified
  if (date) {
    orders = orders.filter(o => dateOfISO(o.created_at) === date);
  }

  // Sort by created_at descending
  orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const total = orders.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const pagedOrders = orders.slice(offset, offset + limit);

  // Load all order items at once
  const allItemRows = await readDataRows(SHEET.ORDER_ITEMS);
  const allItems = allItemRows.map(parseOrderItem);

  const ordersWithItems: OrderWithItems[] = pagedOrders.map(order => ({
    ...order,
    items: allItems.filter(i => i.order_id === order.id),
  }));

  return { orders: ordersWithItems, total, page, limit, totalPages };
}

export async function updateOrderStatus(id: number, status: string): Promise<OrderWithItems | null> {
  const rows = await readSheet(SHEET.ORDERS);
  const idx = findDataIndex(rows, 0, String(id));
  if (idx === -1) return null;

  const existing = rows[idx + 1];
  existing[3] = status; // status column
  await updateRow(SHEET.ORDERS, idx, existing);

  return getOrderById(id);
}

export async function getKitchenOrders(): Promise<OrderWithItems[]> {
  const today = todayIST();
  const allOrderRows = await readDataRows(SHEET.ORDERS);
  const allItemRows = await readDataRows(SHEET.ORDER_ITEMS);
  const allItems = allItemRows.map(parseOrderItem);

  const orders = allOrderRows
    .map(parseOrder)
    .filter(o => {
      const orderDate = dateOfISO(o.created_at);
      const status = o.status || 'pending';
      return orderDate === today && (status === 'pending' || status === 'accepted');
    })
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return orders.map(order => ({
    ...order,
    items: allItems.filter(i => i.order_id === order.id),
  }));
}

export async function resetAllOrders(): Promise<{ orders: number; order_items: number }> {
  const itemsCount = await clearSheet(SHEET.ORDER_ITEMS);
  const ordersCount = await clearSheet(SHEET.ORDERS);
  return { orders: ordersCount, order_items: itemsCount };
}

export async function getRecentOnlineOrders(): Promise<OrderWithItems[]> {
  const allOrderRows = await readDataRows(SHEET.ORDERS);
  const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

  const onlineOrders = allOrderRows
    .map(parseOrder)
    .filter(o => o.source === 'online' && new Date(o.created_at).getTime() > cutoff)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20);

  const allItemRows = await readDataRows(SHEET.ORDER_ITEMS);
  const allItems = allItemRows.map(parseOrderItem);

  return onlineOrders.map(order => ({
    ...order,
    items: allItems.filter(i => i.order_id === order.id),
  }));
}

export async function getOverdueOrders(thresholdMinutes: number): Promise<Array<Order & { minutes_pending: number; items_summary: string }>> {
  const today = todayIST();
  const nowMs = Date.now();
  const thresholdMs = thresholdMinutes * 60 * 1000;

  const allOrderRows = await readDataRows(SHEET.ORDERS);
  const allItemRows = await readDataRows(SHEET.ORDER_ITEMS);
  const allItems = allItemRows.map(parseOrderItem);

  const overdue: Array<Order & { minutes_pending: number; items_summary: string }> = [];

  for (const row of allOrderRows) {
    const order = parseOrder(row);
    if (dateOfISO(order.created_at) !== today) continue;
    if (order.status !== 'pending') continue;

    const age = nowMs - new Date(order.created_at).getTime();
    if (age < thresholdMs) continue;

    const items = allItems.filter(i => i.order_id === order.id);
    const summary = items.map(i => `${i.item_name} x${i.quantity}`).join(', ');

    overdue.push({
      ...order,
      minutes_pending: Math.round(age / 60000),
      items_summary: summary || '-',
    });
  }

  return overdue.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

// ==================== REPORTS ====================

export interface DailySummary {
  date: string;
  total_orders: number;
  total_revenue: number;
  items_sold: number;
}

export async function getDailySummary(date: string): Promise<DailySummary> {
  const allOrderRows = await readDataRows(SHEET.ORDERS);
  const allItemRows = await readDataRows(SHEET.ORDER_ITEMS);

  const dayOrders = allOrderRows.map(parseOrder).filter(o => dateOfISO(o.created_at) === date);
  const orderIds = new Set(dayOrders.map(o => o.id));
  const dayItems = allItemRows.map(parseOrderItem).filter(i => orderIds.has(i.order_id));

  return {
    date,
    total_orders: dayOrders.length,
    total_revenue: dayOrders.reduce((s, o) => s + o.total_amount, 0),
    items_sold: dayItems.reduce((s, i) => s + i.quantity, 0),
  };
}

export async function getOrdersForDate(date: string): Promise<OrderWithItems[]> {
  const allOrderRows = await readDataRows(SHEET.ORDERS);
  const allItemRows = await readDataRows(SHEET.ORDER_ITEMS);
  const allItems = allItemRows.map(parseOrderItem);

  const dayOrders = allOrderRows
    .map(parseOrder)
    .filter(o => dateOfISO(o.created_at) === date)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return dayOrders.map(order => ({
    ...order,
    items: allItems.filter(i => i.order_id === order.id),
  }));
}

export async function getAllTimeRevenue(): Promise<{ total_revenue: number; total_orders: number; total_items: number }> {
  const allOrderRows = await readDataRows(SHEET.ORDERS);
  const allItemRows = await readDataRows(SHEET.ORDER_ITEMS);

  const orders = allOrderRows.map(parseOrder);
  const items = allItemRows.map(parseOrderItem);

  return {
    total_revenue: orders.reduce((s, o) => s + o.total_amount, 0),
    total_orders: orders.length,
    total_items: items.reduce((s, i) => s + i.quantity, 0),
  };
}

// ==================== DASHBOARD ====================

export interface DashboardStats {
  statusCounts: Record<string, number>;
  recentOrders: Array<{
    id: number; order_number: string; total_amount: number;
    status: string; created_at: string; item_count: number;
  }>;
  topItems: Array<{ item_name: string; total_qty: number; total_revenue: number }>;
  hourlySales: Array<{ hour: number; count: number; revenue: number }>;
  allTime: { total_revenue: number; total_orders: number };
  dailyBreakdown: Array<{ date: string; revenue: number; orders: number; items: number }>;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = todayIST();

  const allOrderRows = await readDataRows(SHEET.ORDERS);
  const allItemRows = await readDataRows(SHEET.ORDER_ITEMS);
  const allOrders = allOrderRows.map(parseOrder);
  const allItems = allItemRows.map(parseOrderItem);

  // Today's orders
  const todayOrders = allOrders.filter(o => dateOfISO(o.created_at) === today);
  const todayOrderIds = new Set(todayOrders.map(o => o.id));
  const todayItems = allItems.filter(i => todayOrderIds.has(i.order_id));

  // Status counts
  const statusCounts: Record<string, number> = { pending: 0, accepted: 0, completed: 0 };
  todayOrders.forEach(o => {
    const s = o.status || 'pending';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  // Recent orders (last 10 today)
  const recentOrders = [...todayOrders]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)
    .map(o => ({
      id: o.id,
      order_number: o.order_number,
      total_amount: o.total_amount,
      status: o.status || 'pending',
      created_at: o.created_at,
      item_count: todayItems.filter(i => i.order_id === o.id).reduce((s, i) => s + i.quantity, 0),
    }));

  // Top selling items today
  const itemMap = new Map<string, { qty: number; revenue: number }>();
  todayItems.forEach(i => {
    const existing = itemMap.get(i.item_name) || { qty: 0, revenue: 0 };
    existing.qty += i.quantity;
    existing.revenue += i.subtotal;
    itemMap.set(i.item_name, existing);
  });
  const topItems = Array.from(itemMap.entries())
    .map(([name, data]) => ({ item_name: name, total_qty: data.qty, total_revenue: data.revenue }))
    .sort((a, b) => b.total_qty - a.total_qty)
    .slice(0, 8);

  // Hourly sales
  const hourMap = new Map<number, { count: number; revenue: number }>();
  todayOrders.forEach(o => {
    const hour = new Date(o.created_at).getHours();
    const existing = hourMap.get(hour) || { count: 0, revenue: 0 };
    existing.count += 1;
    existing.revenue += o.total_amount;
    hourMap.set(hour, existing);
  });
  const hourlySales = Array.from(hourMap.entries())
    .map(([hour, data]) => ({ hour, count: data.count, revenue: data.revenue }))
    .sort((a, b) => a.hour - b.hour);

  // All-time stats
  const allTime = {
    total_revenue: allOrders.reduce((s, o) => s + o.total_amount, 0),
    total_orders: allOrders.length,
  };

  // Daily breakdown
  const dayMap = new Map<string, { revenue: number; orders: number; items: number }>();
  allOrders.forEach(o => {
    const d = dateOfISO(o.created_at);
    if (!d) return;
    const existing = dayMap.get(d) || { revenue: 0, orders: 0, items: 0 };
    existing.revenue += o.total_amount;
    existing.orders += 1;
    dayMap.set(d, existing);
  });
  allItems.forEach(i => {
    // Find the order to get its date
    const order = allOrders.find(o => o.id === i.order_id);
    if (!order) return;
    const d = dateOfISO(order.created_at);
    if (!d) return;
    const existing = dayMap.get(d);
    if (existing) existing.items += i.quantity;
  });
  const dailyBreakdown = Array.from(dayMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return { statusCounts, recentOrders, topItems, hourlySales, allTime, dailyBreakdown };
}

// ==================== USERS ====================

export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  created_at: string;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const rows = await readSheet(SHEET.USERS);
  const idx = findDataIndex(rows, 1, username); // column 1 = username
  if (idx === -1) return null;

  const row = rows[idx + 1];
  return {
    id: int(row[0]),
    username: str(row[1]),
    password_hash: str(row[2]),
    role: str(row[3]) || 'admin',
    created_at: str(row[4]),
  };
}

// ==================== SETTINGS ====================

export async function getSetting(key: string): Promise<string | null> {
  const rows = await readSheet(SHEET.SETTINGS);
  const idx = findDataIndex(rows, 0, key); // column 0 = key
  if (idx === -1) return null;
  return strOrNull(rows[idx + 1][1]); // column 1 = value
}

export async function setSetting(key: string, value: string): Promise<void> {
  const rows = await readSheet(SHEET.SETTINGS);
  const idx = findDataIndex(rows, 0, key);
  const ts = now();

  if (idx === -1) {
    // Insert new setting
    await appendRow(SHEET.SETTINGS, [key, value, ts]);
  } else {
    // Update existing setting
    await updateRow(SHEET.SETTINGS, idx, [key, value, ts]);
  }
}

// ==================== PUSH TOKENS ====================

export async function getPushTokens(): Promise<string[]> {
  const rows = await readDataRows(SHEET.PUSH_TOKENS);
  return rows.map(r => str(r[1])).filter(Boolean);
}

export async function registerPushToken(token: string, role: string = 'kitchen'): Promise<void> {
  const rows = await readSheet(SHEET.PUSH_TOKENS);
  const idx = findDataIndex(rows, 1, token); // column 1 = token
  const ts = now();

  if (idx === -1) {
    const id = await getNextId(SHEET.PUSH_TOKENS);
    await appendRow(SHEET.PUSH_TOKENS, [id, token, role, ts, ts]);
  } else {
    const existing = rows[idx + 1];
    await updateRow(SHEET.PUSH_TOKENS, idx, [existing[0], token, role, existing[3], ts]);
  }
}

export async function deletePushToken(token: string): Promise<void> {
  const rows = await readSheet(SHEET.PUSH_TOKENS);
  const idx = findDataIndex(rows, 1, token);
  if (idx !== -1) {
    await deleteRow(SHEET.PUSH_TOKENS, idx);
  }
}

// ==================== INGREDIENTS (Inventory) ====================

export interface Ingredient {
  id: number;
  name: string;
  unit: string;
  current_quantity: number;
  minimum_quantity: number;
  unit_cost: number;
  created_at: string;
  updated_at: string;
}

function parseIngredient(row: string[]): Ingredient {
  return {
    id: int(row[0]),
    name: str(row[1]),
    unit: str(row[2]),
    current_quantity: num(row[3]),
    minimum_quantity: num(row[4]),
    unit_cost: num(row[5]),
    created_at: str(row[6]),
    updated_at: str(row[7]),
  };
}

export async function getIngredients(): Promise<Ingredient[]> {
  const rows = await readDataRows(SHEET.INGREDIENTS);
  return rows.map(parseIngredient).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getIngredientById(id: number): Promise<Ingredient | null> {
  const rows = await readSheet(SHEET.INGREDIENTS);
  const idx = findDataIndex(rows, 0, String(id));
  if (idx === -1) return null;
  return parseIngredient(rows[idx + 1]);
}

export async function createIngredient(
  name: string,
  unit: string,
  currentQuantity: number = 0,
  minimumQuantity: number = 0,
  unitCost: number = 0
): Promise<Ingredient> {
  const id = await getNextId(SHEET.INGREDIENTS);
  const ts = now();
  await appendRow(SHEET.INGREDIENTS, [
    id, name, unit, currentQuantity, minimumQuantity, unitCost, ts, ts,
  ]);
  return {
    id, name, unit,
    current_quantity: currentQuantity,
    minimum_quantity: minimumQuantity,
    unit_cost: unitCost,
    created_at: ts,
    updated_at: ts,
  };
}

export async function updateIngredient(
  id: number,
  data: Partial<{ name: string; unit: string; current_quantity: number; minimum_quantity: number; unit_cost: number }>
): Promise<Ingredient | null> {
  const rows = await readSheet(SHEET.INGREDIENTS);
  const idx = findDataIndex(rows, 0, String(id));
  if (idx === -1) return null;

  const existing = parseIngredient(rows[idx + 1]);
  const updated: Ingredient = {
    ...existing,
    ...data,
    updated_at: now(),
  };

  await updateRow(SHEET.INGREDIENTS, idx, [
    updated.id, updated.name, updated.unit,
    updated.current_quantity, updated.minimum_quantity, updated.unit_cost,
    updated.created_at, updated.updated_at,
  ]);

  return updated;
}

export async function deleteIngredient(id: number): Promise<boolean> {
  const rows = await readSheet(SHEET.INGREDIENTS);
  const idx = findDataIndex(rows, 0, String(id));
  if (idx === -1) return false;

  // Also delete related recipes
  const recipeRows = await readSheet(SHEET.MENU_ITEM_INGREDIENTS);
  const recipeIndices = findAllDataIndices(recipeRows, 2, String(id)); // column 2 = ingredient_id
  if (recipeIndices.length > 0) {
    await deleteRows(SHEET.MENU_ITEM_INGREDIENTS, recipeIndices);
  }

  await deleteRow(SHEET.INGREDIENTS, idx);
  return true;
}

export async function getLowStockIngredients(): Promise<Ingredient[]> {
  const ingredients = await getIngredients();
  return ingredients.filter(i => i.current_quantity <= i.minimum_quantity && i.minimum_quantity > 0);
}

// ==================== MENU ITEM INGREDIENTS (Recipes) ====================

export interface MenuItemIngredient {
  id: number;
  menu_item_id: number;
  ingredient_id: number;
  quantity_required: number;
}

function parseMenuItemIngredient(row: string[]): MenuItemIngredient {
  return {
    id: int(row[0]),
    menu_item_id: int(row[1]),
    ingredient_id: int(row[2]),
    quantity_required: num(row[3]),
  };
}

export async function getMenuItemRecipe(menuItemId: number): Promise<Array<MenuItemIngredient & { ingredient_name?: string; ingredient_unit?: string }>> {
  const recipeRows = await readDataRows(SHEET.MENU_ITEM_INGREDIENTS);
  const recipes = recipeRows
    .map(parseMenuItemIngredient)
    .filter(r => r.menu_item_id === menuItemId);

  // Enrich with ingredient names
  const ingredients = await getIngredients();
  const ingredientMap = new Map(ingredients.map(i => [i.id, i]));

  return recipes.map(r => ({
    ...r,
    ingredient_name: ingredientMap.get(r.ingredient_id)?.name,
    ingredient_unit: ingredientMap.get(r.ingredient_id)?.unit,
  }));
}

export async function setMenuItemRecipe(
  menuItemId: number,
  ingredients: Array<{ ingredient_id: number; quantity_required: number }>
): Promise<void> {
  // Delete existing recipe entries for this menu item
  const rows = await readSheet(SHEET.MENU_ITEM_INGREDIENTS);
  const existingIndices = findAllDataIndices(rows, 1, String(menuItemId)); // column 1 = menu_item_id
  if (existingIndices.length > 0) {
    await deleteRows(SHEET.MENU_ITEM_INGREDIENTS, existingIndices);
  }

  // Add new recipe entries
  if (ingredients.length === 0) return;

  let nextId = await getNextId(SHEET.MENU_ITEM_INGREDIENTS);
  const newRows = ingredients.map(ing => [
    nextId++,
    menuItemId,
    ing.ingredient_id,
    ing.quantity_required,
  ]);

  await appendRows(SHEET.MENU_ITEM_INGREDIENTS, newRows);
}

export async function getAllRecipes(): Promise<Array<MenuItemIngredient & { ingredient_name?: string; ingredient_unit?: string; menu_item_name?: string }>> {
  const recipeRows = await readDataRows(SHEET.MENU_ITEM_INGREDIENTS);
  const recipes = recipeRows.map(parseMenuItemIngredient);

  const ingredients = await getIngredients();
  const ingredientMap = new Map(ingredients.map(i => [i.id, i]));

  const menuItems = await getMenuItems();
  const menuMap = new Map(menuItems.map(m => [m.id, m]));

  return recipes.map(r => ({
    ...r,
    ingredient_name: ingredientMap.get(r.ingredient_id)?.name,
    ingredient_unit: ingredientMap.get(r.ingredient_id)?.unit,
    menu_item_name: menuMap.get(r.menu_item_id)?.name,
  }));
}

// ==================== INVENTORY TRANSACTIONS ====================

export interface InventoryTransaction {
  id: number;
  ingredient_id: number;
  transaction_type: string; // 'order_deduction' | 'manual_add' | 'manual_subtract' | 'adjustment'
  quantity_change: number;
  order_id: number | null;
  notes: string;
  created_at: string;
}

function parseInventoryTransaction(row: string[]): InventoryTransaction {
  return {
    id: int(row[0]),
    ingredient_id: int(row[1]),
    transaction_type: str(row[2]),
    quantity_change: num(row[3]),
    order_id: row[4] ? int(row[4]) : null,
    notes: str(row[5]),
    created_at: str(row[6]),
  };
}

export async function getInventoryTransactions(
  ingredientId?: number,
  limit: number = 50
): Promise<Array<InventoryTransaction & { ingredient_name?: string }>> {
  const rows = await readDataRows(SHEET.INVENTORY_TRANSACTIONS);
  let transactions = rows.map(parseInventoryTransaction);

  if (ingredientId) {
    transactions = transactions.filter(t => t.ingredient_id === ingredientId);
  }

  transactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  transactions = transactions.slice(0, limit);

  // Enrich with ingredient names
  const ingredients = await getIngredients();
  const ingredientMap = new Map(ingredients.map(i => [i.id, i]));

  return transactions.map(t => ({
    ...t,
    ingredient_name: ingredientMap.get(t.ingredient_id)?.name,
  }));
}

export async function addInventoryStock(
  ingredientId: number,
  quantity: number,
  notes: string = ''
): Promise<Ingredient | null> {
  const rows = await readSheet(SHEET.INGREDIENTS);
  const idx = findDataIndex(rows, 0, String(ingredientId));
  if (idx === -1) return null;

  const ingredient = parseIngredient(rows[idx + 1]);
  const newQuantity = ingredient.current_quantity + quantity;
  const ts = now();

  // Update ingredient quantity
  await updateRow(SHEET.INGREDIENTS, idx, [
    ingredient.id, ingredient.name, ingredient.unit,
    newQuantity, ingredient.minimum_quantity, ingredient.unit_cost,
    ingredient.created_at, ts,
  ]);

  // Log transaction
  const txId = await getNextId(SHEET.INVENTORY_TRANSACTIONS);
  const type = quantity >= 0 ? 'manual_add' : 'manual_subtract';
  await appendRow(SHEET.INVENTORY_TRANSACTIONS, [
    txId, ingredientId, type, quantity, '', notes || `Manual ${type}`, ts,
  ]);

  return {
    ...ingredient,
    current_quantity: newQuantity,
    updated_at: ts,
  };
}

/** Auto-deduct ingredients when an order is placed */
export async function deductIngredientsForOrder(
  orderItems: Array<{ menu_item_id: number; quantity: number; item_name: string }>,
  orderId: number
): Promise<void> {
  // Load all recipes
  const recipeRows = await readDataRows(SHEET.MENU_ITEM_INGREDIENTS);
  const recipes = recipeRows.map(parseMenuItemIngredient);

  if (recipes.length === 0) return; // No recipes configured yet

  // Load current ingredient data
  const ingredientRows = await readSheet(SHEET.INGREDIENTS);
  if (ingredientRows.length <= 1) return; // No ingredients

  const ts = now();
  const transactionRows: any[][] = [];
  let txNextId = await getNextId(SHEET.INVENTORY_TRANSACTIONS);

  // Map of ingredientId → total quantity to deduct
  const deductions = new Map<number, { total: number; details: string[] }>();

  for (const orderItem of orderItems) {
    const itemRecipes = recipes.filter(r => r.menu_item_id === orderItem.menu_item_id);
    for (const recipe of itemRecipes) {
      const deductQty = recipe.quantity_required * orderItem.quantity;
      const existing = deductions.get(recipe.ingredient_id) || { total: 0, details: [] };
      existing.total += deductQty;
      existing.details.push(`${orderItem.item_name} x${orderItem.quantity}`);
      deductions.set(recipe.ingredient_id, existing);
    }
  }

  if (deductions.size === 0) return;

  // Apply deductions
  for (const [ingredientId, { total, details }] of Array.from(deductions)) {
    const idx = findDataIndex(ingredientRows, 0, String(ingredientId));
    if (idx === -1) continue;

    const ingredient = parseIngredient(ingredientRows[idx + 1]);
    const newQty = ingredient.current_quantity - total;

    // Update ingredient quantity
    await updateRow(SHEET.INGREDIENTS, idx, [
      ingredient.id, ingredient.name, ingredient.unit,
      newQty, ingredient.minimum_quantity, ingredient.unit_cost,
      ingredient.created_at, ts,
    ]);

    // Re-read to keep cache fresh for next iteration
    invalidateCache(SHEET.INGREDIENTS);

    // Prepare transaction log
    transactionRows.push([
      txNextId++, ingredientId, 'order_deduction', -total, orderId,
      `Order #${orderId}: ${details.join(', ')}`, ts,
    ]);
  }

  // Batch insert transaction logs
  if (transactionRows.length > 0) {
    await appendRows(SHEET.INVENTORY_TRANSACTIONS, transactionRows);
  }
}

/** Check if ingredients are available for an order (optional pre-check) */
export async function checkIngredientAvailability(
  items: Array<{ menu_item_id: number; quantity: number }>
): Promise<{ available: boolean; shortages: Array<{ ingredient_name: string; needed: number; available: number; unit: string }> }> {
  const recipeRows = await readDataRows(SHEET.MENU_ITEM_INGREDIENTS);
  const recipes = recipeRows.map(parseMenuItemIngredient);

  if (recipes.length === 0) return { available: true, shortages: [] };

  const ingredients = await getIngredients();
  const ingredientMap = new Map(ingredients.map(i => [i.id, i]));

  // Calculate total needs
  const needs = new Map<number, number>();
  for (const item of items) {
    const itemRecipes = recipes.filter(r => r.menu_item_id === item.menu_item_id);
    for (const recipe of itemRecipes) {
      needs.set(recipe.ingredient_id, (needs.get(recipe.ingredient_id) || 0) + recipe.quantity_required * item.quantity);
    }
  }

  const shortages: Array<{ ingredient_name: string; needed: number; available: number; unit: string }> = [];

  for (const [ingredientId, needed] of Array.from(needs)) {
    const ingredient = ingredientMap.get(ingredientId);
    if (!ingredient) continue;
    if (ingredient.current_quantity < needed) {
      shortages.push({
        ingredient_name: ingredient.name,
        needed,
        available: ingredient.current_quantity,
        unit: ingredient.unit,
      });
    }
  }

  return { available: shortages.length === 0, shortages };
}
