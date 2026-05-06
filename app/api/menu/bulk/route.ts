import { NextResponse } from 'next/server';
import { getAuthFromHeaders } from '@/lib/auth';
import { createMenuItem } from '@/lib/db';

// POST /api/menu/bulk - Bulk upload menu items from CSV
export async function POST(request: Request) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { items } = await request.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    const results: { success: number; failed: number; errors: string[] } = {
      success: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const row = i + 1;

      // Validate
      if (!item.name || !item.name.trim()) {
        results.failed++;
        results.errors.push(`Row ${row}: Item name is required`);
        continue;
      }
      if (!item.category || !item.category.trim()) {
        results.failed++;
        results.errors.push(`Row ${row}: Category is required`);
        continue;
      }

      const priceStr = String(item.price).trim();

      // Check if price has variants (e.g., "149 / 179" or "149/179")
      const variantMatch = priceStr.match(/^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/);

      if (variantMatch) {
        // Item has half/full pricing
        const halfPrice = parseFloat(variantMatch[1]);
        const fullPrice = parseFloat(variantMatch[2]);

        if (isNaN(halfPrice) || halfPrice <= 0) {
          results.failed++;
          results.errors.push(`Row ${row}: Invalid half price "${variantMatch[1]}"`);
          continue;
        }
        if (isNaN(fullPrice) || fullPrice <= 0) {
          results.failed++;
          results.errors.push(`Row ${row}: Invalid full price "${variantMatch[2]}"`);
          continue;
        }

        try {
          await createMenuItem(
            item.name.trim(),
            halfPrice, // Use half_price as default price
            item.category.trim(),
            true,
            true,       // has_variants
            halfPrice,  // half_price
            fullPrice   // full_price
          );
          results.success++;
        } catch (err: unknown) {
          results.failed++;
          const msg = err instanceof Error ? err.message : 'Unknown error';
          results.errors.push(`Row ${row}: ${msg}`);
        }
      } else {
        // Single price item
        const price = parseFloat(priceStr);
        if (isNaN(price) || price <= 0) {
          results.failed++;
          results.errors.push(`Row ${row}: Invalid price "${item.price}"`);
          continue;
        }

        try {
          await createMenuItem(
            item.name.trim(),
            price,
            item.category.trim(),
            true,
            false,  // has_variants
            null,   // half_price
            null    // full_price
          );
          results.success++;
        } catch (err: unknown) {
          results.failed++;
          const msg = err instanceof Error ? err.message : 'Unknown error';
          results.errors.push(`Row ${row}: ${msg}`);
        }
      }
    }

    return NextResponse.json({
      message: `Uploaded ${results.success} items successfully${results.failed > 0 ? `, ${results.failed} failed` : ''}`,
      ...results,
    });
  } catch (error) {
    console.error('Bulk upload error:', error);
    return NextResponse.json({ error: 'Failed to process CSV' }, { status: 500 });
  }
}
