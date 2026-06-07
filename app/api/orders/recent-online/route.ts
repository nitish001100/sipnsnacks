import { NextResponse } from 'next/server';
import { getRecentOnlineOrders } from '@/lib/db';

// CRITICAL: Disable Vercel caching — this endpoint must always return fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/orders/recent-online — Returns recent online orders (for WhatsApp bot polling)
// No auth required — only returns order summaries, no sensitive data
export async function GET() {
  try {
    const orders = await getRecentOnlineOrders();

    const response = NextResponse.json({ orders });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return response;
  } catch (error) {
    console.error('Error fetching recent online orders:', error);
    const response = NextResponse.json({ orders: [] });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return response;
  }
}
