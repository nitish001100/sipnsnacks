import { NextRequest, NextResponse } from 'next/server';
import { createDailyBackup } from '@/lib/db';

/**
 * GET /api/cron/backup
 * 
 * Daily backup cron job — runs at 11:59 PM IST (18:29 UTC).
 * Stores a JSONB snapshot of all tables in the `daily_backups` table.
 * Keeps the last 30 days of backups.
 * 
 * Protected by CRON_SECRET to prevent unauthorized access.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await createDailyBackup();

    console.log(`✅ Daily backup completed for ${result.date}:`, result.tables);

    return NextResponse.json({
      success: true,
      message: `Backup completed for ${result.date}`,
      ...result,
    });
  } catch (error: any) {
    console.error('❌ Daily backup failed:', error);
    return NextResponse.json(
      { error: 'Backup failed', details: error.message },
      { status: 500 }
    );
  }
}
