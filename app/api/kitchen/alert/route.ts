import { NextResponse } from 'next/server';
import { getOverdueOrders, getSetting, setSetting } from '@/lib/db';
import nodemailer from 'nodemailer';

const ALERT_EMAIL = 'nitish.saxena001100@gmail.com';
const PENDING_THRESHOLD_MINUTES = 20;

// GET /api/kitchen/alert - Cron job: check for orders pending > 20 mins and send email
export async function GET() {
  try {
    const overdueOrders = await getOverdueOrders(PENDING_THRESHOLD_MINUTES);

    if (overdueOrders.length === 0) {
      return NextResponse.json({ message: 'No overdue orders', count: 0 });
    }

    // Check if we already sent an alert recently (within last 15 mins)
    const lastAlertStr = await getSetting('last_overdue_alert');
    const lastAlertTime = lastAlertStr ? new Date(lastAlertStr) : null;
    const now = new Date();

    if (lastAlertTime && (now.getTime() - lastAlertTime.getTime()) < 15 * 60 * 1000) {
      return NextResponse.json({
        message: 'Alert already sent recently, skipping',
        count: overdueOrders.length,
        lastAlert: lastAlertTime.toISOString(),
      });
    }

    // Build email
    const orderRows = overdueOrders.map((o) => {
      return `
        <tr style="border-bottom: 1px solid #fee2e2;">
          <td style="padding: 10px 12px; font-weight: bold; color: #1B2E3C;">${o.order_number}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #475569;">${o.items_summary || '-'}</td>
          <td style="padding: 10px 12px; text-align: right;">₹${o.total_amount.toLocaleString('en-IN')}</td>
          <td style="padding: 10px 12px; text-align: center; color: #dc2626; font-weight: bold;">${o.minutes_pending} min</td>
        </tr>
      `;
    }).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; padding: 20px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 22px;">⚠️ Overdue Order Alert</h1>
          <p style="color: #fecaca; margin: 4px 0 0; font-size: 13px;">Sip n Snacks Kitchen</p>
        </div>
        
        <div style="padding: 20px; background: #fff; border: 1px solid #fecaca;">
          <p style="color: #dc2626; font-weight: bold; font-size: 15px; margin: 0 0 4px;">
            🚨 ${overdueOrders.length} order(s) pending for over ${PENDING_THRESHOLD_MINUTES} minutes!
          </p>
          <p style="color: #64748b; font-size: 13px; margin: 0 0 16px;">
            These orders need immediate attention in the kitchen.
          </p>
          
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #fef2f2;">
                <th style="padding: 10px 12px; text-align: left; color: #991b1b; font-size: 11px; text-transform: uppercase;">Order</th>
                <th style="padding: 10px 12px; text-align: left; color: #991b1b; font-size: 11px; text-transform: uppercase;">Items</th>
                <th style="padding: 10px 12px; text-align: right; color: #991b1b; font-size: 11px; text-transform: uppercase;">Amount</th>
                <th style="padding: 10px 12px; text-align: center; color: #991b1b; font-size: 11px; text-transform: uppercase;">Waiting</th>
              </tr>
            </thead>
            <tbody>
              ${orderRows}
            </tbody>
          </table>
        </div>

        <div style="padding: 16px; text-align: center; background: #fef2f2; border-radius: 0 0 12px 12px; border: 1px solid #fecaca; border-top: 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://sipnsnacks.vercel.app'}/kitchen" 
             style="display: inline-block; background: #dc2626; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
            Open Kitchen Display →
          </a>
          <p style="color: #94a3b8; font-size: 11px; margin: 10px 0 0;">
            Alert sent at ${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
          </p>
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

    await transporter.sendMail({
      from: `"Sip n Snacks Kitchen" <${process.env.EMAIL_USER}>`,
      to: ALERT_EMAIL,
      subject: `🚨 ${overdueOrders.length} Order(s) Pending > ${PENDING_THRESHOLD_MINUTES}min - Action Needed!`,
      html,
    });

    // Update last alert timestamp
    await setSetting('last_overdue_alert', now.toISOString());

    return NextResponse.json({
      message: `Alert sent for ${overdueOrders.length} overdue order(s)`,
      count: overdueOrders.length,
      sentTo: ALERT_EMAIL,
    });
  } catch (error) {
    console.error('Kitchen alert error:', error);
    return NextResponse.json({ error: 'Failed to check overdue orders' }, { status: 500 });
  }
}
