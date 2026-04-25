import { NextResponse } from 'next/server';
import { getSetting, getDailySummary, getAllTimeRevenue } from '@/lib/db';
import { getAuthFromCookies } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { format } from 'date-fns';

// POST - Verify settlement password and return earnings data
export async function POST(request: Request) {
  const auth = getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { password } = await request.json();

    const storedHash = await getSetting('settlement_password');
    if (!storedHash) {
      return NextResponse.json({ error: 'Settlement password not set' }, { status: 400 });
    }

    const valid = await bcrypt.compare(password, storedHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 403 });
    }

    // Return earnings data
    const today = format(new Date(), 'yyyy-MM-dd');
    const todaySummary = await getDailySummary(today);
    const allTime = await getAllTimeRevenue();

    return NextResponse.json({
      success: true,
      today: todaySummary,
      allTime,
    });
  } catch (error) {
    console.error('Password verification error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
