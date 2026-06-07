import { NextResponse } from 'next/server';
import { addInventoryStock } from '@/lib/db';
import { getAuthFromHeaders } from '@/lib/auth';

// POST /api/inventory/stock - Add or subtract stock for an ingredient
export async function POST(request: Request) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ingredient_id, quantity, notes } = await request.json();

    if (!ingredient_id || quantity === undefined) {
      return NextResponse.json({ error: 'ingredient_id and quantity are required' }, { status: 400 });
    }

    const ingredient = await addInventoryStock(ingredient_id, quantity, notes || '');
    if (!ingredient) {
      return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 });
    }

    return NextResponse.json({ ingredient });
  } catch (error) {
    console.error('Error adjusting stock:', error);
    return NextResponse.json({ error: 'Failed to adjust stock' }, { status: 500 });
  }
}
