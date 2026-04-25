import { NextResponse } from 'next/server';
import { getDailySummary, getAllTimeRevenue, getSetting } from '@/lib/db';
import { sendSettlementEmail } from '@/lib/email';
import { getAuthFromCookies } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { format } from 'date-fns';

// POST - Send settlement email
export async function POST(request: Request) {
  const auth = getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { password } = await request.json();

    // Verify settlement password
    const storedHash = await getSetting('settlement_password');
    if (!storedHash) {
      return NextResponse.json({ error: 'Settlement password not set' }, { status: 400 });
    }

    const valid = await bcrypt.compare(password, storedHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid settlement password' }, { status: 403 });
    }

    const today = format(new Date(), 'yyyy-MM-dd');
    const summary = await getDailySummary(today);
    const allTime = await getAllTimeRevenue();

    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
      return NextResponse.json(
        { error: 'Email not configured. Set EMAIL_USER and EMAIL_APP_PASSWORD in .env.local' },
        { status: 400 }
      );
    }

    const recipientEmail = process.env.SETTLEMENT_EMAIL || 'nitish.saxena001100@gmail.com';

    await sendSettlementEmail(recipientEmail, {
      date: today,
      total_orders: summary.total_orders,
      total_revenue: summary.total_revenue,
      items_sold: summary.items_sold,
      all_time_revenue: allTime.total_revenue,
      all_time_orders: allTime.total_orders,
    });

    return NextResponse.json({
      success: true,
      message: `Settlement email sent to ${recipientEmail}`,
      summary,
    });
  } catch (error) {
    console.error('Settlement error:', error);
    return NextResponse.json(
      { error: 'Failed to send settlement email' },
      { status: 500 }
    );
  }
}
