import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// CRITICAL: Disable Vercel caching — this endpoint must always return fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/orders/recent-online — Returns recent online orders (for WhatsApp bot polling)
// No auth required — only returns order summaries, no sensitive data
export async function GET() {
  try {
    const result = await pool.query(`
      SELECT 
        o.id,
        o.order_number,
        o.total_amount,
        o.customer_name,
        o.customer_whatsapp,
        o.customer_address,
        o.source,
        o.created_at,
        json_agg(json_build_object(
          'item_name', oi.item_name,
          'quantity', oi.quantity,
          'price', oi.price,
          'subtotal', oi.subtotal,
          'variant', oi.variant
        )) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.source = 'online'
        AND o.created_at > NOW() - INTERVAL '24 hours'
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT 20
    `);

    const response = NextResponse.json({ orders: result.rows });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return response;
  } catch (error) {
    console.error('Error fetching recent online orders:', error);
    const response = NextResponse.json({ orders: [] });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return response;
  }
}
