import { NextResponse } from 'next/server';
import { createOrder, getOrders } from '@/lib/db';
import { getAuthFromHeaders } from '@/lib/auth';
import { notifyKitchen } from '@/lib/push-notify';

// GET /api/orders - Get all orders with pagination
export async function GET(request: Request) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const date = searchParams.get('date') || undefined;

    const result = await getOrders(page, limit, date);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

// POST /api/orders - Create new order (checkout)
export async function POST(request: Request) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { items } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'At least one item is required' },
        { status: 400 }
      );
    }

    // Validate each item
    for (const item of items) {
      if (!item.menu_item_id || !item.item_name || !item.quantity || !item.price) {
        return NextResponse.json(
          { error: 'Each item must have menu_item_id, item_name, quantity, and price' },
          { status: 400 }
        );
      }
      if (item.quantity < 1) {
        return NextResponse.json(
          { error: 'Quantity must be at least 1' },
          { status: 400 }
        );
      }
    }

    const order = await createOrder(items);

    // Send push notification to kitchen (non-blocking)
    if (order) {
      const totalItems = items.reduce((sum: number, i: { quantity: number }) => sum + i.quantity, 0);
      const orderNum = order.order_number?.split('-').pop()?.replace(/^0+/, '') || '?';
      notifyKitchen(orderNum, totalItems).catch(() => {});
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
