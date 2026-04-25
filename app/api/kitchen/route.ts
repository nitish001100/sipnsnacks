import { NextResponse } from 'next/server';
import { getKitchenOrders } from '@/lib/db';
import { getAuthFromHeaders } from '@/lib/auth';

// GET /api/kitchen - Get today's pending/accepted orders for chef
export async function GET(request: Request) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orders = await getKitchenOrders();
    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Error fetching kitchen orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}
