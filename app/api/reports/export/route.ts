import { NextResponse } from 'next/server';
import { getAuthFromHeaders } from '@/lib/auth';
import { generateDailyExcel, getExcelFilename } from '@/lib/excel';
import { format } from 'date-fns';

// GET /api/reports/export?date=YYYY-MM-DD - Download Excel report
export async function GET(request: Request) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');

    const buffer = await generateDailyExcel(date);
    const filename = getExcelFilename(date);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating Excel report:', error);
    return NextResponse.json(
      { error: 'Failed to generate Excel report' },
      { status: 500 }
    );
  }
}
