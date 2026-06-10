import { NextResponse } from 'next/server';
import { addInventoryStock } from '@/lib/db';
import { getAuthFromHeaders } from '@/lib/auth';
import { query, queryAll } from '@/lib/pg-client';

interface RestockItem {
  ingredient_id: number;
  quantity: number;
  unit_cost?: number;
}

// POST /api/inventory/restock - Bulk restock multiple ingredients at once
export async function POST(request: Request) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { items, notes } = await request.json() as { items: RestockItem[]; notes?: string };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items array is required and must not be empty' }, { status: 400 });
    }

    // Validate all items
    for (const item of items) {
      if (!item.ingredient_id || !item.quantity || item.quantity <= 0) {
        return NextResponse.json(
          { error: 'Each item must have ingredient_id and positive quantity' },
          { status: 400 }
        );
      }
    }

    // Generate batch ID for grouping
    const batchId = `RESTOCK-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
    const batchNote = notes ? `${batchId} | ${notes}` : batchId;

    const results: Array<{ ingredient_id: number; name: string; quantity_added: number; new_quantity: number }> = [];

    for (const item of items) {
      // Update unit_cost if provided
      if (item.unit_cost !== undefined && item.unit_cost > 0) {
        await query(
          'UPDATE ingredients SET unit_cost = $2, updated_at = NOW() WHERE id = $1',
          [item.ingredient_id, item.unit_cost]
        );
      }

      // Add stock with batch reference
      const updated = await addInventoryStock(
        item.ingredient_id,
        item.quantity,
        batchNote
      );

      if (updated) {
        results.push({
          ingredient_id: item.ingredient_id,
          name: updated.name,
          quantity_added: item.quantity,
          new_quantity: updated.current_quantity,
        });
      }
    }

    return NextResponse.json({
      success: true,
      batch_id: batchId,
      items_restocked: results.length,
      results,
      message: `${results.length} ingredient(s) restocked successfully!`,
    });
  } catch (error) {
    console.error('Error restocking:', error);
    return NextResponse.json({ error: 'Failed to restock ingredients' }, { status: 500 });
  }
}

// GET /api/inventory/restock - Get restock/purchase history grouped by batch
export async function GET(request: Request) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const dateFilter = searchParams.get('date'); // optional: YYYY-MM-DD

    // Get all manual_add transactions (restocks) - these include both single and batch
    let dateClause = '';
    const params: any[] = [limit];

    if (dateFilter) {
      dateClause = `AND (it.created_at AT TIME ZONE 'Asia/Kolkata')::date = $2`;
      params.push(dateFilter);
    }

    const transactions = await queryAll<{
      id: number;
      ingredient_id: number;
      quantity_change: number;
      notes: string;
      created_at: string;
      ingredient_name: string;
      ingredient_unit: string;
      unit_cost: number;
    }>(
      `SELECT it.id, it.ingredient_id, it.quantity_change, it.notes, it.created_at,
              i.name as ingredient_name, i.unit as ingredient_unit, i.unit_cost
       FROM inventory_transactions it
       JOIN ingredients i ON it.ingredient_id = i.id
       WHERE it.transaction_type = 'manual_add'
       ${dateClause}
       ORDER BY it.created_at DESC
       LIMIT $1`,
      params
    );

    // Group by batch (notes that start with RESTOCK-)
    const batches = new Map<string, {
      batch_id: string;
      date: string;
      notes: string;
      items: Array<{
        ingredient_name: string;
        ingredient_unit: string;
        quantity: number;
        unit_cost: number;
        cost: number;
      }>;
      total_cost: number;
    }>();

    const singleRestocks: Array<{
      id: number;
      date: string;
      ingredient_name: string;
      ingredient_unit: string;
      quantity: number;
      unit_cost: number;
      cost: number;
      notes: string;
    }> = [];

    for (const tx of transactions) {
      const qty = Math.abs(tx.quantity_change);
      const cost = qty * (tx.unit_cost || 0);

      if (tx.notes && tx.notes.startsWith('RESTOCK-')) {
        const batchId = tx.notes.split(' | ')[0];
        const userNotes = tx.notes.split(' | ').slice(1).join(' | ');

        if (!batches.has(batchId)) {
          batches.set(batchId, {
            batch_id: batchId,
            date: tx.created_at,
            notes: userNotes || '',
            items: [],
            total_cost: 0,
          });
        }

        const batch = batches.get(batchId)!;
        batch.items.push({
          ingredient_name: tx.ingredient_name,
          ingredient_unit: tx.ingredient_unit,
          quantity: qty,
          unit_cost: tx.unit_cost || 0,
          cost,
        });
        batch.total_cost += cost;
      } else {
        singleRestocks.push({
          id: tx.id,
          date: tx.created_at,
          ingredient_name: tx.ingredient_name,
          ingredient_unit: tx.ingredient_unit,
          quantity: qty,
          unit_cost: tx.unit_cost || 0,
          cost,
          notes: tx.notes || '',
        });
      }
    }

    return NextResponse.json({
      batches: Array.from(batches.values()),
      single_restocks: singleRestocks,
      total_records: transactions.length,
    });
  } catch (error) {
    console.error('Error fetching restock history:', error);
    return NextResponse.json({ error: 'Failed to fetch restock history' }, { status: 500 });
  }
}
