import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

export interface SettlementData {
  date: string;
  total_orders: number;
  total_revenue: number;
  items_sold: number;
  all_time_revenue: number;
  all_time_orders: number;
}

export async function sendSettlementEmail(to: string, data: SettlementData) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
      <div style="background: #1B2E3C; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: #F5B041; margin: 0; font-size: 28px;">☕Sip n Snacks</h1>
        <p style="color: #fde68a; margin: 4px 0 0; font-size: 12px; letter-spacing: 2px;">CAFE · REFRESHMENTS · BITES</p>
      </div>
      
      <div style="padding: 24px; background: #f8fafc; border: 1px solid #e2e8f0;">
        <h2 style="color: #1B2E3C; margin: 0 0 4px;">Daily Settlement Report</h2>
        <p style="color: #64748b; margin: 0 0 20px; font-size: 14px;">Date: <strong>${data.date}</strong></p>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="background: #F5B041;">
            <th style="padding: 12px 16px; text-align: left; color: #1B2E3C; font-size: 14px;" colspan="2">Today's Summary</th>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 16px; color: #475569;">Total Orders</td>
            <td style="padding: 12px 16px; text-align: right; font-weight: bold; color: #1B2E3C;">${data.total_orders}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0; background: #fffbeb;">
            <td style="padding: 12px 16px; color: #475569;">Total Revenue</td>
            <td style="padding: 12px 16px; text-align: right; font-weight: bold; color: #15803d; font-size: 18px;">₹${data.total_revenue.toLocaleString('en-IN')}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 16px; color: #475569;">Items Sold</td>
            <td style="padding: 12px 16px; text-align: right; font-weight: bold; color: #1B2E3C;">${data.items_sold}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0; background: #fffbeb;">
            <td style="padding: 12px 16px; color: #475569;">Avg Order Value</td>
            <td style="padding: 12px 16px; text-align: right; font-weight: bold; color: #1B2E3C;">₹${data.total_orders > 0 ? Math.round(data.total_revenue / data.total_orders).toLocaleString('en-IN') : '0'}</td>
          </tr>
        </table>

        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background: #1B2E3C;">
            <th style="padding: 12px 16px; text-align: left; color: #F5B041; font-size: 14px;" colspan="2">All-Time Totals</th>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 16px; color: #475569;">Total Revenue (All Time)</td>
            <td style="padding: 12px 16px; text-align: right; font-weight: bold; color: #1B2E3C;">₹${data.all_time_revenue.toLocaleString('en-IN')}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0; background: #f1f5f9;">
            <td style="padding: 12px 16px; color: #475569;">Total Orders (All Time)</td>
            <td style="padding: 12px 16px; text-align: right; font-weight: bold; color: #1B2E3C;">${data.all_time_orders}</td>
          </tr>
        </table>
      </div>

      <div style="padding: 16px; text-align: center; background: #f1f5f9; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: 0;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">This is an automated settlement report from Sip n Snacks POS</p>
        <p style="color: #94a3b8; font-size: 12px; margin: 4px 0 0;">Generated at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Sip n Snacks POS" <${process.env.EMAIL_USER}>`,
    to,
    subject: `☕ Settlement Report - ${data.date} | ₹${data.total_revenue.toLocaleString('en-IN')}`,
    html,
  });
}
