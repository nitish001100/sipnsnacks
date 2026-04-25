import { NextResponse } from 'next/server';
import { generateDailyExcel, getExcelFilename } from '@/lib/excel';
import { uploadToGoogleDrive } from '@/lib/google-drive';
import { getAuthFromHeaders } from '@/lib/auth';
import { format, subDays } from 'date-fns';

// POST /api/sync/google-drive - Sync daily Excel to Google Drive
// Can be triggered manually (with auth) or by Vercel Cron
export async function POST(request: Request) {
  try {
    // Check if this is a cron job request
    const authHeader = request.headers.get('authorization');
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

    if (!isCron) {
      // Verify user auth for manual trigger
      const auth = getAuthFromHeaders(request);
      if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');

    // Generate Excel
    const buffer = await generateDailyExcel(date);
    const filename = getExcelFilename(date);

    // Upload to Google Drive
    const result = await uploadToGoogleDrive(filename, buffer);

    if (result) {
      return NextResponse.json({
        success: true,
        message: `File ${filename} synced to Google Drive`,
        fileId: result.fileId,
        webViewLink: result.webViewLink,
      });
    } else {
      return NextResponse.json({
        success: true,
        message: 'Google Drive credentials not configured. Excel generated but not uploaded.',
      });
    }
  } catch (error) {
    console.error('Error syncing to Google Drive:', error);
    return NextResponse.json(
      { error: 'Failed to sync to Google Drive' },
      { status: 500 }
    );
  }
}

// GET handler for Vercel Cron
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Sync yesterday's data (cron runs at midnight)
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const buffer = await generateDailyExcel(yesterday);
    const filename = getExcelFilename(yesterday);

    const result = await uploadToGoogleDrive(filename, buffer);

    return NextResponse.json({
      success: true,
      message: `Cron: Synced ${filename} to Google Drive`,
      fileId: result?.fileId,
    });
  } catch (error) {
    console.error('Cron sync error:', error);
    return NextResponse.json(
      { error: 'Cron sync failed' },
      { status: 500 }
    );
  }
}
