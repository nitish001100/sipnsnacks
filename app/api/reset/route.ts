import { NextResponse } from 'next/server';
import { getSetting, resetAllOrders } from '@/lib/db';
import bcrypt from 'bcryptjs';

// POST /api/reset - Reset all orders, order items, and sales data
export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    // Verify settlement password
    const storedHash = await getSetting('settlement_password');
    if (!storedHash) {
      return NextResponse.json({ error: 'Settlement password not configured' }, { status: 500 });
    }

    const isValid = await bcrypt.compare(password, storedHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    const deleted = await resetAllOrders();

    return NextResponse.json({
      message: 'All data has been reset successfully!',
      deleted,
    });
  } catch (error) {
    console.error('Reset error:', error);
    return NextResponse.json({ error: 'Failed to reset data' }, { status: 500 });
  }
}
