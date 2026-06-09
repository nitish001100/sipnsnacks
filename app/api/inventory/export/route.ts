import { NextResponse } from 'next/server';
import { getAuthFromHeaders } from '@/lib/auth';
import { generateInventoryExcel } from '@/lib/excel';

// GET /api/inventory/export - Download inventory Excel report
export async function GET(request: Request) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const buffer = await generateInventoryExcel();
    const date = new Date().toISOString().split('T')[0];

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="sipnsnacks_inventory_${date}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Error generating inventory Excel:', error);
    return NextResponse.json({ error: 'Failed to generate inventory report' }, { status: 500 });
  }
}
