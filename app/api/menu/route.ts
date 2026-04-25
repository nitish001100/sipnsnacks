import { NextResponse } from 'next/server';
import { getMenuItems, createMenuItem } from '@/lib/db';
import { getAuthFromHeaders } from '@/lib/auth';

// GET /api/menu - Get all menu items (public)
export async function GET() {
  try {
    const items = await getMenuItems();
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch menu items' },
      { status: 500 }
    );
  }
}

// POST /api/menu - Add new menu item (requires auth)
export async function POST(request: Request) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, price, category, available } = await request.json();

    if (!name || price === undefined || !category) {
      return NextResponse.json(
        { error: 'Name, price, and category are required' },
        { status: 400 }
      );
    }

    if (typeof price !== 'number' || price < 0) {
      return NextResponse.json(
        { error: 'Price must be a positive number' },
        { status: 400 }
      );
    }

    const item = await createMenuItem(name, price, category, available ?? true);

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Error creating menu item:', error);
    return NextResponse.json(
      { error: 'Failed to create menu item' },
      { status: 500 }
    );
  }
}
