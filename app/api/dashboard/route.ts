import { NextResponse } from 'next/server';
import { getAuthFromHeaders } from '@/lib/auth';
import { Pool, QueryResultRow } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function query<T extends QueryResultRow>(text: string, params?: unknown[]) {
  return pool.query<T>(text, params);
}

export async function GET(request: Request) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Order status counts for today
    const { rows: statusCounts } = await query<{ status: string; count: string }>(
      "SELECT COALESCE(status, 'pending') as status, COUNT(*) as count FROM orders WHERE DATE(created_at) = CURRENT_DATE GROUP BY status"
    );

    const statusMap: Record<string, number> = { pending: 0, accepted: 0, completed: 0 };
    statusCounts.forEach((r) => { statusMap[r.status] = parseInt(r.count); });

    // Recent orders (last 10 today)
    const { rows: recentOrders } = await query<{
      id: number; order_number: string; total_amount: number; status: string; created_at: string; item_count: string;
    }>(
      `SELECT o.id, o.order_number, o.total_amount, COALESCE(o.status, 'pending') as status, o.created_at,
       (SELECT COALESCE(SUM(oi.quantity),0) FROM order_items oi WHERE oi.order_id = o.id) as item_count
       FROM orders o WHERE DATE(o.created_at) = CURRENT_DATE ORDER BY o.created_at DESC LIMIT 10`
    );

    // Top selling items today
    const { rows: topItems } = await query<{ item_name: string; total_qty: string; total_revenue: string }>(
      `SELECT oi.item_name, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total_revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE DATE(o.created_at) = CURRENT_DATE
       GROUP BY oi.item_name ORDER BY total_qty DESC LIMIT 8`
    );

    // Hourly sales (for mini chart)
    const { rows: hourlySales } = await query<{ hour: string; count: string; revenue: string }>(
      `SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count, SUM(total_amount) as revenue
       FROM orders WHERE DATE(created_at) = CURRENT_DATE GROUP BY hour ORDER BY hour`
    );

    return NextResponse.json({
      statusCounts: statusMap,
      recentOrders: recentOrders.map((r) => ({
        ...r,
        total_amount: parseFloat(r.total_amount as unknown as string),
        item_count: parseInt(r.item_count),
      })),
      topItems: topItems.map((r) => ({
        item_name: r.item_name,
        total_qty: parseInt(r.total_qty),
        total_revenue: parseFloat(r.total_revenue),
      })),
      hourlySales: hourlySales.map((r) => ({
        hour: parseInt(r.hour),
        count: parseInt(r.count),
        revenue: parseFloat(r.revenue),
      })),
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
