import { NextRequest, NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';
import { getAuthFromHeaders } from '@/lib/auth';

// Default hours: 10:30 AM - 9:45 PM IST
const DEFAULTS = { open: '10:30', close: '21:45', forced_closed: false };

export async function GET() {
  try {
    const [open, close, forcedClosed] = await Promise.all([
      getSetting('store_open_time'),
      getSetting('store_close_time'),
      getSetting('store_forced_closed'),
    ]);

    return NextResponse.json({
      open_time: open || DEFAULTS.open,
      close_time: close || DEFAULTS.close,
      forced_closed: forcedClosed === 'true',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Use header-based auth (robust across all Next.js runtime contexts)
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { open_time, close_time, forced_closed } = body;

    if (open_time !== undefined) {
      if (!/^\d{1,2}:\d{2}$/.test(open_time)) {
        return NextResponse.json({ error: 'Invalid open_time format. Use HH:MM' }, { status: 400 });
      }
      await setSetting('store_open_time', open_time);
    }

    if (close_time !== undefined) {
      if (!/^\d{1,2}:\d{2}$/.test(close_time)) {
        return NextResponse.json({ error: 'Invalid close_time format. Use HH:MM' }, { status: 400 });
      }
      await setSetting('store_close_time', close_time);
    }

    if (forced_closed !== undefined) {
      await setSetting('store_forced_closed', String(forced_closed));
    }

    // Fetch updated values
    const [open, close, fc] = await Promise.all([
      getSetting('store_open_time'),
      getSetting('store_close_time'),
      getSetting('store_forced_closed'),
    ]);

    return NextResponse.json({
      open_time: open || DEFAULTS.open,
      close_time: close || DEFAULTS.close,
      forced_closed: fc === 'true',
      message: 'Store hours updated!',
    });
  } catch (error: any) {
    console.error('Store hours update error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update store hours' }, { status: 500 });
  }
}
