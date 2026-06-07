import { NextResponse } from 'next/server';
import { registerPushToken, deletePushToken } from '@/lib/db';
import { getAuthFromHeaders } from '@/lib/auth';

// POST /api/push/register - Register FCM token
export async function POST(request: Request) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    await registerPushToken(token, auth.role || 'kitchen');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push register error:', error);
    return NextResponse.json({ error: 'Failed to register token' }, { status: 500 });
  }
}

// DELETE /api/push/register - Remove FCM token
export async function DELETE(request: Request) {
  try {
    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    await deletePushToken(token);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push unregister error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
