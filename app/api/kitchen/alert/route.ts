import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import nodemailer from 'nodemailer';

const ALERT_EMAIL = 'nitish.saxena001100@gmail.com';
const PENDING_THRESHOLD_MINUTES = 20;

// GET /api/kitchen/alert - Cron job: check for orders pending > 20 mins and send email
export async function GET() {
  try {
    // Find orders that are 'pending' and older than 20 minutes
    const { rows: overdueOrders } = await pool.query(
      `SELECT o.id, o.order_number, o.total_amount, o.created_at,
              EXTRACT(EPOCH FROM (NOW() - o.created_at))/60 AS minutes_pending,
              (SELECT string_agg(oi.item_name || ' x' || oi.quantity, ', ')
               FROM order_items oi WHERE oi.order_id = o.id) AS items_summary
       FROM orders o
       WHERE o.status = 'pending'
         AND o.created_at < NOW() - INTERVAL '${PENDING_THRESHOLD_MINUTES} minutes'
         AND DATE(o.created_at) = CURRENT_DATE
       ORDER BY o.created_at ASC`
    );

    if (overdueOrders.length === 0) {
      return NextResponse.json({ message: 'No overdue orders', count: 0 });
    }

    // Check if we already sent an alert for these orders recently (within last 15 mins)
    // Use a simple approach: check a settings key
    const { rows: lastAlert } = await pool.query(
      "SELECT value FROM settings WHERE key = 'last_overdue_alert'"
    );

    const lastAlertTime = lastAlert[0]?.value ? new Date(lastAlert[0].value) : null;
    const now = new Date();

    // Only send email if no alert was sent in the last 15 minutes
    if (lastAlertTime && (now.getTime() - lastAlertTime.getTime()) < 15 * 60 * 1000) {
      return NextResponse.json({
        message: 'Alert already sent recently, skipping',
        count: overdueOrders.length,
        lastAlert: lastAlertTime.toISOString(),
      });
    }

    // Build email
    const orderRows = overdueOrders.map((o) => {
      const mins = Math.round(parseFloat(o.minutes_pending));
      return `
        <tr style="border-bottom: 1px solid #fee2e2;">
          <td style="padding: 10px 12px; font-weight: bold; color: #1B2E3C;">${o.order_number}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #475569;">${o.items_summary || '-'}</td>
          <td style="padding: 10px 12px; text-align: right;">₹${parseFloat(o.total_amount).toLocaleString('en-IN')}</td>
          <td style="padding: 10px 12px; text-align: center; color: #dc2626; font-weight: bold;">${mins} min</td>
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
    await pool.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ('last_overdue_alert', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [now.toISOString()]
    );

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
