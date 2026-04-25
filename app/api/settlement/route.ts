import { NextResponse } from 'next/server';
import { getDailySummary, getAllTimeRevenue, getSetting, setSetting } from '@/lib/db';
import { getAuthFromCookies } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { format, addDays, differenceInDays } from 'date-fns';
import nodemailer from 'nodemailer';

interface DaySummary {
  date: string;
  total_orders: number;
  total_revenue: number;
  items_sold: number;
}

// POST - Send settlement email for all unsettled days
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

    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
      return NextResponse.json(
        { error: 'Email not configured. Set EMAIL_USER and EMAIL_APP_PASSWORD in .env.local' },
        { status: 400 }
      );
    }

    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    // Get last settlement date
    const lastSettleDateStr = await getSetting('last_settlement_date');
    let startDate: Date;

    if (lastSettleDateStr) {
      // Start from the day AFTER last settlement
      startDate = addDays(new Date(lastSettleDateStr), 1);
    } else {
      // First time settling - just settle today
      startDate = today;
    }

    // Collect summaries for all unsettled days
    const days: DaySummary[] = [];
    const numDays = differenceInDays(today, startDate) + 1;

    for (let i = 0; i < Math.min(numDays, 30); i++) { // Cap at 30 days
      const date = addDays(startDate, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const summary = await getDailySummary(dateStr);

      // Only include days that had activity
      if (summary.total_orders > 0 || dateStr === todayStr) {
        days.push(summary);
      }
    }

    // If no days with activity and today is empty, still include today
    if (days.length === 0) {
      const todaySummary = await getDailySummary(todayStr);
      days.push(todaySummary);
    }

    const allTime = await getAllTimeRevenue();

    // Calculate grand totals across all days
    const grandTotal = {
      orders: days.reduce((s, d) => s + d.total_orders, 0),
      revenue: days.reduce((s, d) => s + d.total_revenue, 0),
      items: days.reduce((s, d) => s + d.items_sold, 0),
    };

    // Build email
    const isMultiDay = days.length > 1;

    const dayRows = days.map((day) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 12px; font-weight: 600; color: #1B2E3C;">${day.date}</td>
        <td style="padding: 10px 12px; text-align: center;">${day.total_orders}</td>
        <td style="padding: 10px 12px; text-align: center;">${day.items_sold}</td>
        <td style="padding: 10px 12px; text-align: right; font-weight: bold; color: #15803d;">₹${day.total_revenue.toLocaleString('en-IN')}</td>
        <td style="padding: 10px 12px; text-align: right; color: #475569;">₹${day.total_orders > 0 ? Math.round(day.total_revenue / day.total_orders).toLocaleString('en-IN') : '0'}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #fff;">
        <div style="background: #1B2E3C; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #F5B041; margin: 0; font-size: 28px;">Sip n Snacks</h1>
          <p style="color: #fde68a; margin: 4px 0 0; font-size: 12px; letter-spacing: 2px;">CAFE · REFRESHMENTS · BITES</p>
        </div>
        
        <div style="padding: 24px; background: #f8fafc; border: 1px solid #e2e8f0;">
          <h2 style="color: #1B2E3C; margin: 0 0 4px;">
            ${isMultiDay ? `Settlement Report (${days.length} Days)` : 'Daily Settlement Report'}
          </h2>
          <p style="color: #64748b; margin: 0 0 20px; font-size: 14px;">
            ${isMultiDay
              ? `Period: <strong>${days[0].date}</strong> to <strong>${days[days.length - 1].date}</strong>`
              : `Date: <strong>${days[0].date}</strong>`
            }
          </p>

          ${isMultiDay ? `
            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
              <p style="color: #92400e; font-size: 13px; margin: 0; font-weight: 600;">
                ⚠️ This settlement covers ${days.length} unsettled days
              </p>
            </div>
          ` : ''}
          
          <!-- Day-wise Breakdown -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
            <tr style="background: #F5B041;">
              <th style="padding: 10px 12px; text-align: left; color: #1B2E3C;">Date</th>
              <th style="padding: 10px 12px; text-align: center; color: #1B2E3C;">Orders</th>
              <th style="padding: 10px 12px; text-align: center; color: #1B2E3C;">Items</th>
              <th style="padding: 10px 12px; text-align: right; color: #1B2E3C;">Revenue</th>
              <th style="padding: 10px 12px; text-align: right; color: #1B2E3C;">Avg Order</th>
            </tr>
            ${dayRows}
            ${isMultiDay ? `
              <tr style="background: #1B2E3C;">
                <td style="padding: 12px; color: #F5B041; font-weight: bold;">GRAND TOTAL</td>
                <td style="padding: 12px; text-align: center; color: #F5B041; font-weight: bold;">${grandTotal.orders}</td>
                <td style="padding: 12px; text-align: center; color: #F5B041; font-weight: bold;">${grandTotal.items}</td>
                <td style="padding: 12px; text-align: right; color: #F5B041; font-weight: bold; font-size: 16px;">₹${grandTotal.revenue.toLocaleString('en-IN')}</td>
                <td style="padding: 12px; text-align: right; color: #F5B041; font-weight: bold;">₹${grandTotal.orders > 0 ? Math.round(grandTotal.revenue / grandTotal.orders).toLocaleString('en-IN') : '0'}</td>
              </tr>
            ` : ''}
          </table>

          <!-- All-Time Stats -->
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background: #1B2E3C;">
              <th style="padding: 12px 16px; text-align: left; color: #F5B041; font-size: 14px;" colspan="2">All-Time Totals</th>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px 16px; color: #475569;">Total Revenue (All Time)</td>
              <td style="padding: 12px 16px; text-align: right; font-weight: bold; color: #1B2E3C;">₹${allTime.total_revenue.toLocaleString('en-IN')}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0; background: #f1f5f9;">
              <td style="padding: 12px 16px; color: #475569;">Total Orders (All Time)</td>
              <td style="padding: 12px 16px; text-align: right; font-weight: bold; color: #1B2E3C;">${allTime.total_orders}</td>
            </tr>
          </table>
        </div>

        <div style="padding: 16px; text-align: center; background: #f1f5f9; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: 0;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">This is an automated settlement report from Sip n Snacks POS</p>
          <p style="color: #94a3b8; font-size: 12px; margin: 4px 0 0;">Generated at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
        </div>
      </div>
    `;

    // Send email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });

    const recipientEmail = process.env.SETTLEMENT_EMAIL || 'nitish.saxena001100@gmail.com';
    const subject = isMultiDay
      ? `Sip n Snacks Settlement (${days.length} Days) | ₹${grandTotal.revenue.toLocaleString('en-IN')}`
      : `Sip n Snacks Settlement - ${todayStr} | ₹${grandTotal.revenue.toLocaleString('en-IN')}`;

    await transporter.sendMail({
      from: `"Sip n Snacks POS" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject,
      html,
    });

    // Save last settlement date
    await setSetting('last_settlement_date', todayStr);

    return NextResponse.json({
      success: true,
      message: `Settlement email sent to ${recipientEmail}${isMultiDay ? ` covering ${days.length} days` : ''}`,
      days: days.length,
      grandTotal,
    });
  } catch (error) {
    console.error('Settlement error:', error);
    return NextResponse.json(
      { error: 'Failed to send settlement email' },
      { status: 500 }
    );
  }
}
