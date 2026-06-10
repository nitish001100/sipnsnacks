import { NextResponse } from 'next/server';
import { getMenuItemRecipe, setMenuItemRecipe, getAllRecipes } from '@/lib/db';
import { getAuthFromHeaders } from '@/lib/auth';

// GET /api/inventory/recipes?menu_item_id=X - Get recipe for a menu item, or all recipes
export async function GET(request: Request) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const menuItemId = searchParams.get('menu_item_id');

    if (menuItemId) {
      const recipe = await getMenuItemRecipe(parseInt(menuItemId));
      return NextResponse.json({ recipe });
    } else {
      const recipes = await getAllRecipes();
      return NextResponse.json({ recipes });
    }
  } catch (error) {
    console.error('Error fetching recipes:', error);
    return NextResponse.json({ error: 'Failed to fetch recipes' }, { status: 500 });
  }
}

// POST /api/inventory/recipes - Set recipe for a menu item
export async function POST(request: Request) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { menu_item_id, ingredients } = await request.json();

    if (!menu_item_id || !Array.isArray(ingredients)) {
      return NextResponse.json(
        { error: 'menu_item_id and ingredients array are required' },
        { status: 400 }
      );
    }

    // Validate each ingredient entry
    for (const ing of ingredients) {
      if (!ing.ingredient_id || !ing.quantity_required || ing.quantity_required <= 0) {
        return NextResponse.json(
          { error: 'Each ingredient must have ingredient_id and positive quantity_required' },
          { status: 400 }
        );
      }
    }

    await setMenuItemRecipe(menu_item_id, ingredients.map((ing: { ingredient_id: number; quantity_required: number; recipe_unit?: string }) => ({
      ingredient_id: ing.ingredient_id,
      quantity_required: ing.quantity_required,
      recipe_unit: ing.recipe_unit || undefined,
    })));
    const recipe = await getMenuItemRecipe(menu_item_id);

    return NextResponse.json({ success: true, recipe });
  } catch (error) {
    console.error('Error setting recipe:', error);
    return NextResponse.json({ error: 'Failed to set recipe' }, { status: 500 });
  }
}
