import { NextResponse } from 'next/server';
import { getDailySummary } from '@/lib/db';
import { getAuthFromHeaders } from '@/lib/auth';
import { format } from 'date-fns';

// GET /api/reports/daily?date=YYYY-MM-DD - Get daily sales summary
export async function GET(request: Request) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');

    const summary = await getDailySummary(date);
    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error fetching daily summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch daily summary' },
      { status: 500 }
    );
  }
}
