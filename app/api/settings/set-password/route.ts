import { NextResponse } from 'next/server';
import { setSetting } from '@/lib/db';
import bcrypt from 'bcryptjs';

// TEMPORARY endpoint to set settlement password - DELETE after use
export async function POST(request: Request) {
  try {
    const { password, secret } = await request.json();
    
    // Simple secret to prevent unauthorized access
    if (secret !== 'setup-2025') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!password) {
      return NextResponse.json({ error: 'Password required' }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 12);
    await setSetting('settlement_password', hash);

    // Verify
    const valid = await bcrypt.compare(password, hash);

    return NextResponse.json({ 
      success: true, 
      message: 'Settlement password set!',
      verified: valid 
    });
  } catch (error) {
    console.error('Set password error:', error);
    return NextResponse.json({ error: 'Failed to set password' }, { status: 500 });
  }
}
