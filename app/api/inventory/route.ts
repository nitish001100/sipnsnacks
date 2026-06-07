import { NextResponse } from 'next/server';
import {
  getIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  addInventoryStock,
  getLowStockIngredients,
} from '@/lib/db';
import { getAuthFromHeaders } from '@/lib/auth';

// GET /api/inventory - Get all ingredients (with optional ?low_stock=true filter)
export async function GET(request: Request) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lowStockOnly = searchParams.get('low_stock') === 'true';

    const ingredients = lowStockOnly
      ? await getLowStockIngredients()
      : await getIngredients();

    return NextResponse.json({ ingredients });
  } catch (error) {
    console.error('Error fetching ingredients:', error);
    return NextResponse.json({ error: 'Failed to fetch ingredients' }, { status: 500 });
  }
}

// POST /api/inventory - Create new ingredient
export async function POST(request: Request) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, unit, current_quantity, minimum_quantity, unit_cost } = await request.json();

    if (!name || !unit) {
      return NextResponse.json({ error: 'Name and unit are required' }, { status: 400 });
    }

    const ingredient = await createIngredient(
      name,
      unit,
      current_quantity || 0,
      minimum_quantity || 0,
      unit_cost || 0
    );

    return NextResponse.json({ ingredient }, { status: 201 });
  } catch (error) {
    console.error('Error creating ingredient:', error);
    return NextResponse.json({ error: 'Failed to create ingredient' }, { status: 500 });
  }
}

// PUT /api/inventory - Update ingredient
export async function PUT(request: Request) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, ...data } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Ingredient ID is required' }, { status: 400 });
    }

    const ingredient = await updateIngredient(id, data);
    if (!ingredient) {
      return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 });
    }

    return NextResponse.json({ ingredient });
  } catch (error) {
    console.error('Error updating ingredient:', error);
    return NextResponse.json({ error: 'Failed to update ingredient' }, { status: 500 });
  }
}

// DELETE /api/inventory - Delete ingredient
export async function DELETE(request: Request) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Ingredient ID is required' }, { status: 400 });
    }

    const success = await deleteIngredient(id);
    if (!success) {
      return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting ingredient:', error);
    return NextResponse.json({ error: 'Failed to delete ingredient' }, { status: 500 });
  }
}
