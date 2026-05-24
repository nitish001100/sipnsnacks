import { NextResponse } from 'next/server';
import { getMenuItems, createMenuItem, pool } from '@/lib/db';
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

    const { name, price, category, available, has_variants, half_price, full_price } = await request.json();

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

    // Validate variant prices if has_variants is true
    if (has_variants) {
      if (!half_price || !full_price || half_price <= 0 || full_price <= 0) {
        return NextResponse.json(
          { error: 'Half price and Full price are required for variant items' },
          { status: 400 }
        );
      }
    }

    const item = await createMenuItem(
      name,
      price,
      category,
      available ?? true,
      has_variants ?? false,
      has_variants ? half_price : null,
      has_variants ? full_price : null
    );

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Error creating menu item:', error);
    return NextResponse.json(
      { error: 'Failed to create menu item' },
      { status: 500 }
    );
  }
}

// DELETE /api/menu - Clear all menu items (requires auth)
export async function DELETE(request: Request) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await pool.query('DELETE FROM menu_items');
    return NextResponse.json({
      message: 'All menu items deleted',
      deleted: result.rowCount ?? 0,
    });
  } catch (error) {
    console.error('Error clearing menu:', error);
    return NextResponse.json(
      { error: 'Failed to clear menu items' },
      { status: 500 }
    );
  }
}
