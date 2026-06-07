import { NextResponse } from 'next/server';
import { getInventoryTransactions } from '@/lib/db';
import { getAuthFromHeaders } from '@/lib/auth';

// GET /api/inventory/transactions?ingredient_id=X&limit=50 - Get inventory transaction history
export async function GET(request: Request) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ingredientId = searchParams.get('ingredient_id');
    const limit = parseInt(searchParams.get('limit') || '50');

    const transactions = await getInventoryTransactions(
      ingredientId ? parseInt(ingredientId) : undefined,
      limit
    );

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
