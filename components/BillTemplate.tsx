'use client';

import Image from 'next/image';

interface BillItem {
  item_name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

interface BillData {
  order_number: string;
  created_at: string;
  total_amount: number;
  items: BillItem[];
}

interface BillTemplateProps {
  order: BillData;
}

export default function BillTemplate({ order }: BillTemplateProps) {
  const orderDate = new Date(order.created_at);
  const formattedDate = orderDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  const formattedTime = orderDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });

  // Extract daily sequence number from order_number (e.g., SNS-250426-003 → #3)
  const dailyNumber = order.order_number.split('-').pop()?.replace(/^0+/, '') || '1';
  const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div id="bill-template" className="bill-container">
      {/* ===== BILL CONTENT ===== */}
      <div className="bill-content">

        {/* Header with Logo */}
        <div className="bill-header">
          <div className="bill-logo-wrap">
            <Image
              src="/logo.png"
              alt="Sip n Snacks"
              width={72}
              height={72}
              className="bill-logo"
            />
          </div>
          <h1 className="bill-store-name">Sip n Snacks</h1>
          <p className="bill-tagline">Cafe · Refreshments · Bites</p>
        </div>

        {/* Divider */}
        <div className="bill-divider bill-divider-double" />

        {/* Order Info */}
        <div className="bill-info-row">
          <div className="bill-info-left">
            <span className="bill-label">Order</span>
            <span className="bill-value-big">#{dailyNumber}</span>
          </div>
          <div className="bill-info-right">
            <span className="bill-label">{formattedDate}</span>
            <span className="bill-label">{formattedTime}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="bill-divider" />

        {/* Items Table */}
        <table className="bill-table">
          <thead>
            <tr>
              <th className="bill-th-left">ITEM</th>
              <th className="bill-th-center">QTY</th>
              <th className="bill-th-right">RATE</th>
              <th className="bill-th-right">AMT</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, idx) => (
              <tr key={idx} className="bill-item-row">
                <td className="bill-td-left">{item.item_name}</td>
                <td className="bill-td-center">{item.quantity}</td>
                <td className="bill-td-right">₹{item.price}</td>
                <td className="bill-td-right bill-td-bold">₹{item.subtotal}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Divider */}
        <div className="bill-divider" />

        {/* Summary */}
        <div className="bill-summary">
          <div className="bill-summary-row">
            <span>Items</span>
            <span>{totalItems}</span>
          </div>
          <div className="bill-summary-row">
            <span>Subtotal</span>
            <span>₹{order.total_amount.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Total */}
        <div className="bill-divider bill-divider-double" />
        <div className="bill-total-row">
          <span>TOTAL</span>
          <span>₹{order.total_amount.toLocaleString('en-IN')}</span>
        </div>
        <div className="bill-divider bill-divider-double" />

        {/* Feedback QR Code */}
        <div className="bill-feedback">
          <p className="bill-feedback-title">Rate your experience!</p>
          <div className="bill-qr-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(
                process.env.NEXT_PUBLIC_FEEDBACK_URL || 'https://g.page/r/YOUR_GOOGLE_REVIEW_LINK/review'
              )}`}
              alt="Scan for feedback"
              width={80}
              height={80}
              className="bill-qr"
            />
          </div>
          <p className="bill-feedback-sub">Scan to give us feedback on Google</p>
        </div>

        <div className="bill-divider" />

        {/* Footer */}
        <div className="bill-footer">
          <p className="bill-thanks">Thank you! Visit again</p>
          <p className="bill-powered">sipnsnacks.vercel.app</p>
        </div>

      </div>
    </div>
  );
}
