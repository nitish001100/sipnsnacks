// WhatsApp Group Notification — 100% FREE
// Uses a local whatsapp-web.js bot server (scripts/whatsapp-bot.mjs)
//
// Setup:
// 1. Create a WhatsApp group called "sipnsnacks online order" on your phone
// 2. Run: npm run whatsapp:bot
// 3. Scan the QR code with your WhatsApp
// 4. Done! Orders will be automatically posted to the group

const WHATSAPP_BOT_URL = process.env.WHATSAPP_BOT_URL || 'http://localhost:3001';

interface OrderDetails {
  order_number: string;
  total_amount: number;
  customer_name?: string;
  customer_whatsapp?: string;
  source: string;
  items: Array<{
    item_name: string;
    quantity: number;
    price: number;
    subtotal: number;
    variant?: string | null;
  }>;
}

function formatOrderMessage(order: OrderDetails): string {
  const now = new Date();
  const time = now.toLocaleTimeString('en-IN', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  });
  const date = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  });

  const isOnline = order.source === 'online';
  const orderType = isOnline ? '🌐 ONLINE ORDER' : '🏪 IN-STORE ORDER';

  let msg = `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🧾 *NEW ORDER - ${order.order_number}*\n`;
  msg += `${orderType}\n`;
  msg += `📅 ${date} | ⏰ ${time}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Customer info
  if (order.customer_name || order.customer_whatsapp) {
    msg += `👤 *Customer Details:*\n`;
    if (order.customer_name) {
      msg += `   Name: ${order.customer_name}\n`;
    }
    if (order.customer_whatsapp) {
      msg += `   📱 WhatsApp: ${order.customer_whatsapp}\n`;
    }
    msg += `\n`;
  }

  // Items
  msg += `📋 *Order Items:*\n`;
  msg += `─────────────────────\n`;
  order.items.forEach((item, idx) => {
    const variantInfo = item.variant ? ` (${item.variant})` : '';
    msg += `${idx + 1}. ${item.item_name}${variantInfo}\n`;
    msg += `   ${item.quantity} × ₹${item.price} = ₹${item.subtotal}\n`;
  });
  msg += `─────────────────────\n`;
  msg += `💰 *TOTAL: ₹${order.total_amount.toLocaleString('en-IN')}*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━`;

  return msg;
}

export async function sendOrderToWhatsAppGroup(order: OrderDetails): Promise<boolean> {
  try {
    const message = formatOrderMessage(order);
    const url = `${WHATSAPP_BOT_URL}/send-order`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ WhatsApp group notification sent:', data.messageId);
      return true;
    } else {
      const errorData = await response.json();
      console.error('❌ WhatsApp bot error:', response.status, errorData.error);
      return false;
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('⏱️ WhatsApp bot timeout — bot may not be running');
    } else {
      console.log('📱 WhatsApp bot not available — run "npm run whatsapp:bot" to enable');
    }
    return false;
  }
}
