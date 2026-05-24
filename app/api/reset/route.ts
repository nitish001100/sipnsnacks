import { NextResponse } from 'next/server';
import { getSetting, pool } from '@/lib/db';
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

    // Delete all order items first (foreign key constraint)
    const itemsResult = await pool.query('DELETE FROM order_items');
    const ordersResult = await pool.query('DELETE FROM orders');

    return NextResponse.json({
      message: 'All data has been reset successfully!',
      deleted: {
        orders: ordersResult.rowCount ?? 0,
        order_items: itemsResult.rowCount ?? 0,
      },
    });
  } catch (error) {
    console.error('Reset error:', error);
    return NextResponse.json({ error: 'Failed to reset data' }, { status: 500 });
  }
}
