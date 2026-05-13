#!/usr/bin/env node

/**
 * 🟢 Sip & Snacks WhatsApp Order Notification Bot
 * 
 * 100% FREE — Uses Baileys (lightweight, no Chrome needed)
 * 
 * HOW TO USE:
 * 1. Run: npm run whatsapp:bot
 * 2. Open http://localhost:3001/qr in browser to scan QR
 * 3. Orders will auto-post to the group!
 */

import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import http from 'http';
import fs from 'fs';
import path from 'path';
import pino from 'pino';

const PORT = process.env.WHATSAPP_BOT_PORT || 3001;
const GROUP_NAME = process.env.WHATSAPP_GROUP_NAME || 'sipsnacks online order';
const AUTH_DIR = path.join(process.cwd(), '.wwebjs_auth');

let sock = null;
let isReady = false;
let targetGroupId = null;
let latestQR = null;

const logger = pino({ level: 'silent' }); // Suppress Baileys internal logs

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🟢 Sip & Snacks WhatsApp Bot Starting...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('📱 Open this URL in your browser to scan QR code:');
console.log(`   👉 http://localhost:${PORT}/qr`);
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Start HTTP server first (so QR page is available immediately)
startHttpServer();

// Connect to WhatsApp
connectWhatsApp();

async function connectWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = (makeWASocket.default || makeWASocket)({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ['Sip & Snacks Bot', 'Chrome', '120.0.0'],
    connectTimeoutMs: 60000,
  });

  // Save credentials on update
  sock.ev.on('creds.update', saveCreds);

  // Handle connection updates
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQR = qr;
      // Save QR as image file
      const qrImagePath = path.join(process.cwd(), 'whatsapp-qr.png');
      try {
        await QRCode.toFile(qrImagePath, qr, { width: 400, margin: 2 });
        console.log(`\n📱 QR Code ready! Scan it:`);
        console.log(`   1. Browser: http://localhost:${PORT}/qr`);
        console.log(`   2. Image:   ${qrImagePath}`);
        console.log(`\n   (WhatsApp > Settings > Linked Devices > Link a Device)\n`);
      } catch (err) {
        console.error('Error saving QR:', err.message);
      }
    }

    if (connection === 'open') {
      isReady = true;
      latestQR = null;
      console.log('✅ WhatsApp connected!\n');

      // Find the target group
      await findGroup();

      // Start polling for new orders
      if (targetGroupId) {
        startPolling();
      }

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🟢 Bot is running! Keep this terminal open.');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

    if (connection === 'close') {
      isReady = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log('⚠️ Connection lost. Reconnecting in 3s...');
        setTimeout(connectWhatsApp, 3000);
      } else {
        console.log('❌ Logged out. Delete .wwebjs_auth folder and restart to re-scan QR.');
      }
    }
  });
}

async function findGroup() {
  try {
    console.log('🔍 Searching for group...');
    
    // Wait a moment for groups to sync
    await new Promise(r => setTimeout(r, 3000));
    
    const groups = await sock.groupFetchAllParticipating();
    
    for (const [id, group] of Object.entries(groups)) {
      if (group.subject.toLowerCase() === GROUP_NAME.toLowerCase()) {
        targetGroupId = id;
        console.log(`\n✅ Found group: "${group.subject}" (${id})`);
        return;
      }
    }

    // Not found — show available groups
    console.log(`\n⚠️ Group "${GROUP_NAME}" not found!`);
    console.log('📋 Available groups:');
    const groupList = Object.values(groups);
    if (groupList.length === 0) {
      console.log('   (No groups found)');
    } else {
      // Show first 20 groups
      groupList.slice(0, 20).forEach(g => console.log(`   • ${g.subject}`));
      if (groupList.length > 20) {
        console.log(`   ... and ${groupList.length - 20} more`);
      }
    }
    console.log(`\n💡 Create a group called "${GROUP_NAME}" and restart the bot`);
  } catch (err) {
    console.error('Error finding groups:', err.message);
  }
}

// ========== HTTP Server ==========

function startHttpServer() {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    // QR Code page
    if (req.method === 'GET' && (req.url === '/qr' || req.url === '/')) {
      res.writeHead(200, { 'Content-Type': 'text/html' });

      if (isReady) {
        res.end(`<!DOCTYPE html><html><head><title>WhatsApp Bot - Connected</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f0fdf4;text-align:center}
        .card{background:white;border-radius:20px;padding:40px;box-shadow:0 4px 20px rgba(0,0,0,0.1);max-width:400px}
        h1{color:#16a34a;font-size:24px}p{color:#666;margin:10px 0}</style></head>
        <body><div class="card">
          <h1>✅ WhatsApp Connected!</h1>
          <p>Bot is running and connected.</p>
          <p><strong>Group:</strong> ${targetGroupId ? GROUP_NAME : '⚠️ Not found'}</p>
          <p style="margin-top:20px;color:#999;font-size:14px">Orders will be posted to the group.</p>
        </div></body></html>`);
        return;
      }

      if (!latestQR) {
        res.end(`<!DOCTYPE html><html><head><title>Loading</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="refresh" content="3">
        <style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#fffbeb;text-align:center}
        .card{background:white;border-radius:20px;padding:40px;box-shadow:0 4px 20px rgba(0,0,0,0.1);max-width:400px}
        h1{color:#d97706;font-size:24px}.spinner{display:inline-block;width:40px;height:40px;border:4px solid #fbbf24;border-top-color:#d97706;border-radius:50%;animation:spin 1s linear infinite;margin:20px}
        @keyframes spin{to{transform:rotate(360deg)}}</style></head>
        <body><div class="card"><div class="spinner"></div><h1>⏳ Loading...</h1>
        <p>WhatsApp is starting up. Page will refresh.</p></div></body></html>`);
        return;
      }

      try {
        const qrDataUrl = await QRCode.toDataURL(latestQR, { width: 350, margin: 2 });
        res.end(`<!DOCTYPE html><html><head><title>Scan QR Code</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="refresh" content="30">
        <style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f0f9ff;text-align:center}
        .card{background:white;border-radius:20px;padding:30px;box-shadow:0 4px 20px rgba(0,0,0,0.1);max-width:420px}
        h1{color:#25D366;font-size:22px;margin-bottom:5px}
        .subtitle{color:#666;font-size:14px;margin-bottom:20px}
        img{border-radius:10px;border:3px solid #25D366}
        .steps{text-align:left;background:#f8fafc;border-radius:10px;padding:15px 20px;margin-top:20px;font-size:14px;color:#555}
        .steps li{margin:6px 0}
        .brand{color:#25D366;font-weight:bold;font-size:18px;margin-bottom:5px}</style></head>
        <body><div class="card">
          <p class="brand">📱 Sip & Snacks</p>
          <h1>Scan QR Code</h1>
          <p class="subtitle">Connect WhatsApp to receive order notifications</p>
          <img src="${qrDataUrl}" alt="WhatsApp QR Code" />
          <ol class="steps">
            <li>Open <strong>WhatsApp</strong> on your phone</li>
            <li>Go to <strong>Settings → Linked Devices</strong></li>
            <li>Tap <strong>"Link a Device"</strong></li>
            <li>Point your phone camera at this QR code</li>
          </ol>
        </div></body></html>`);
      } catch (err) {
        res.end(`<html><body><h1>Error</h1><p>${err.message}</p></body></html>`);
      }
      return;
    }

    // Status check
    if (req.method === 'GET' && req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: isReady ? 'connected' : latestQR ? 'waiting_for_scan' : 'initializing',
        group: targetGroupId ? GROUP_NAME : null,
        groupId: targetGroupId,
      }));
      return;
    }

    // Send order to WhatsApp group
    if (req.method === 'POST' && req.url === '/send-order') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          if (!isReady || !sock) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'WhatsApp not connected' }));
            return;
          }
          if (!targetGroupId) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Group "${GROUP_NAME}" not found` }));
            return;
          }

          const { message } = JSON.parse(body);
          if (!message) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Message is required' }));
            return;
          }

          const result = await sock.sendMessage(targetGroupId, { text: message });
          console.log(`📤 Order sent to group! (${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })})`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, messageId: result.key.id }));
        } catch (err) {
          console.error('Error sending:', err.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to send message' }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(PORT);
}

// ========== Order Polling ==========
const VERCEL_APP_URL = process.env.VERCEL_APP_URL || 'https://sipnsnacks.vercel.app';
const POLL_INTERVAL = 15000; // 15 seconds
const sentOrderIds = new Set();

async function pollForNewOrders() {
  if (!isReady || !sock || !targetGroupId) return;

  try {
    const res = await fetch(`${VERCEL_APP_URL}/api/orders/recent-online`);
    const data = await res.json();

    if (!data.orders || data.orders.length === 0) return;

    for (const order of data.orders) {
      if (sentOrderIds.has(order.id)) continue;
      sentOrderIds.add(order.id);

      // Skip orders older than 2 minutes (on first boot, don't spam old orders)
      const orderAge = Date.now() - new Date(order.created_at).getTime();
      if (orderAge > 2 * 60 * 1000 && sentOrderIds.size <= data.orders.length) continue;

      // Format the message
      const items = order.items || [];
      let msg = `🛒 *New Online Order!*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━\n`;
      if (order.order_number) msg += `📋 *Order:* #${order.order_number}\n`;
      if (order.customer_name) msg += `👤 *Customer:* ${order.customer_name}\n`;
      if (order.customer_whatsapp) msg += `📱 *Phone:* ${order.customer_whatsapp}\n`;
      msg += `\n*Items:*\n`;
      items.forEach((item, i) => {
        msg += `${i + 1}. ${item.item_name} x ${item.quantity} = ₹${Number(item.subtotal).toLocaleString('en-IN')}\n`;
      });
      msg += `\n💰 *Total: ₹${Number(order.total_amount).toLocaleString('en-IN')}*`;
      msg += `\n━━━━━━━━━━━━━━━━━━━━`;

      try {
        await sock.sendMessage(targetGroupId, { text: msg });
        console.log(`📤 Order #${order.order_number || order.id} sent to group! (${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })})`);
      } catch (err) {
        console.error(`Error sending order ${order.id}:`, err.message);
      }
    }
  } catch (err) {
    // Silently fail — will retry next poll
  }
}

// Start polling when connected
function startPolling() {
  console.log(`🔄 Polling ${VERCEL_APP_URL} for new orders every ${POLL_INTERVAL / 1000}s...\n`);
  // Initial poll
  setTimeout(pollForNewOrders, 3000);
  // Periodic polling
  setInterval(pollForNewOrders, POLL_INTERVAL);

  // Self-ping to keep free hosting (Render, etc.) alive
  setInterval(() => {
    fetch(`http://localhost:${PORT}/status`).catch(() => {});
  }, 5 * 60 * 1000); // every 5 min
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  try { fs.unlinkSync(path.join(process.cwd(), 'whatsapp-qr.png')); } catch {}
  if (sock) sock.end();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.log(`⚠️ Error (bot still running): ${err.message}`);
});

process.on('unhandledRejection', (err) => {
  console.log(`⚠️ Error (bot still running): ${err?.message || err}`);
});
