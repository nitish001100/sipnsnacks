#!/usr/bin/env node

/**
 * 🟢 Sip & Snacks WhatsApp Order Notification Bot
 * 
 * 100% FREE — Uses whatsapp-web.js (open source)
 * 
 * HOW TO USE:
 * 1. Run: npm run whatsapp:bot
 * 2. Open http://localhost:3001/qr in your browser to scan the QR code
 * 3. The bot will auto-detect the group "sipnsnacks online order"
 * 4. Keep this running — orders will be posted to the group automatically!
 */

import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import QRCode from 'qrcode';
import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = process.env.WHATSAPP_BOT_PORT || 3001;
const GROUP_NAME = process.env.WHATSAPP_GROUP_NAME || 'sipsnacks online order';

let client = null;
let isReady = false;
let targetGroupId = null;
let latestQR = null; // Store latest QR data for web display

// ========== WhatsApp Client ==========

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🟢 Sip & Snacks WhatsApp Bot Starting...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('📱 Open this URL in your browser to scan QR code:');
console.log(`   👉 http://localhost:${PORT}/qr`);
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

client = new Client({
  authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  },
});

client.on('qr', async (qr) => {
  latestQR = qr;
  
  // Save QR code as image file
  const qrImagePath = path.join(process.cwd(), 'whatsapp-qr.png');
  try {
    await QRCode.toFile(qrImagePath, qr, { width: 400, margin: 2 });
    console.log(`\n📱 QR Code ready! Scan it using one of these methods:`);
    console.log(`   1. Open in browser: http://localhost:${PORT}/qr`);
    console.log(`   2. Open image file: ${qrImagePath}`);
    console.log(`\n   (WhatsApp > Settings > Linked Devices > Link a Device)\n`);
  } catch (err) {
    console.error('Error saving QR image:', err);
  }
});

client.on('authenticated', () => {
  latestQR = null; // Clear QR after authentication
  console.log('✅ WhatsApp authenticated successfully!');
});

client.on('auth_failure', (msg) => {
  console.error('❌ Authentication failed:', msg);
  console.log('💡 Try deleting the .wwebjs_auth folder and restarting');
});

client.on('ready', async () => {
  isReady = true;
  latestQR = null;
  console.log('✅ WhatsApp client is ready!\n');
  console.log('⏳ Waiting for WhatsApp to fully load before searching groups...\n');

  // Find the target group with retry (WhatsApp Web needs time to load)
  await findGroup();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🟢 Bot is running! Keep this terminal open.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

async function findGroup(retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Wait before trying (WhatsApp Web needs time to fully initialize)
      const waitTime = attempt * 5000;
      console.log(`   Attempt ${attempt}/${retries} — waiting ${waitTime / 1000}s...`);
      await new Promise(r => setTimeout(r, waitTime));

      const chats = await client.getChats();
      const group = chats.find(
        (chat) => chat.isGroup && chat.name.toLowerCase() === GROUP_NAME.toLowerCase()
      );

      if (group) {
        targetGroupId = group.id._serialized;
        console.log(`\n✅ Found group: "${group.name}" (${targetGroupId})`);
        return;
      } else {
        console.log(`\n⚠️  Group "${GROUP_NAME}" not found!`);
        console.log('📋 Available groups:');
        const groups = chats.filter((c) => c.isGroup);
        if (groups.length === 0) {
          console.log('   (No groups found)');
        } else {
          groups.forEach((g) => console.log(`   • ${g.name}`));
        }
        console.log(`\n💡 Create a WhatsApp group called "${GROUP_NAME}" and restart the bot`);
        return;
      }
    } catch (err) {
      console.log(`   ⚠️ Attempt ${attempt} failed: ${err.message || err}`);
      if (attempt === retries) {
        console.log(`\n⚠️  Could not fetch groups. The bot is still running!`);
        console.log(`   Orders will still work once the group is detected.`);
        console.log(`   Restart the bot to retry: npm run whatsapp:bot\n`);
      }
    }
  }
}

client.on('disconnected', (reason) => {
  isReady = false;
  targetGroupId = null;
  console.log('❌ WhatsApp disconnected:', reason);
  console.log('Attempting to reconnect...');
  client.initialize();
});

client.initialize();

// ========== HTTP Server ==========

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // QR Code page (browser-friendly)
  if (req.method === 'GET' && (req.url === '/qr' || req.url === '/')) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    
    if (isReady) {
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>WhatsApp Bot - Connected</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f0fdf4;text-align:center}
        .card{background:white;border-radius:20px;padding:40px;box-shadow:0 4px 20px rgba(0,0,0,0.1);max-width:400px}
        h1{color:#16a34a;font-size:24px}p{color:#666;margin:10px 0}</style></head>
        <body><div class="card">
          <h1>✅ WhatsApp Connected!</h1>
          <p>Bot is running and connected to WhatsApp.</p>
          <p><strong>Group:</strong> ${targetGroupId ? GROUP_NAME : '⚠️ Not found — create the group and restart'}</p>
          <p style="margin-top:20px;color:#999;font-size:14px">Orders will be automatically posted to the group.</p>
        </div></body></html>
      `);
      return;
    }
    
    if (!latestQR) {
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>WhatsApp Bot - Loading</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="refresh" content="3">
        <style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#fffbeb;text-align:center}
        .card{background:white;border-radius:20px;padding:40px;box-shadow:0 4px 20px rgba(0,0,0,0.1);max-width:400px}
        h1{color:#d97706;font-size:24px}.spinner{display:inline-block;width:40px;height:40px;border:4px solid #fbbf24;border-top-color:#d97706;border-radius:50%;animation:spin 1s linear infinite;margin:20px}
        @keyframes spin{to{transform:rotate(360deg)}}</style></head>
        <body><div class="card">
          <div class="spinner"></div>
          <h1>⏳ Loading...</h1>
          <p>WhatsApp is starting up. This page will refresh automatically.</p>
        </div></body></html>
      `);
      return;
    }

    // Generate QR code as data URL
    try {
      const qrDataUrl = await QRCode.toDataURL(latestQR, { width: 350, margin: 2 });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>WhatsApp Bot - Scan QR Code</title>
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
        </div></body></html>
      `);
    } catch (err) {
      res.end(`<html><body><h1>Error generating QR code</h1><p>${err.message}</p></body></html>`);
    }
    return;
  }

  // Health/status check
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
        if (!isReady) {
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

        const result = await client.sendMessage(targetGroupId, message);
        console.log(`📤 Order sent to group! (${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })})`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messageId: result.id.id }));
      } catch (err) {
        console.error('Error sending message:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to send message' }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  // Server started
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down WhatsApp bot...');
  // Clean up QR image
  try { fs.unlinkSync(path.join(process.cwd(), 'whatsapp-qr.png')); } catch {}
  if (client) {
    await client.destroy();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  try { fs.unlinkSync(path.join(process.cwd(), 'whatsapp-qr.png')); } catch {}
  if (client) {
    await client.destroy();
  }
  process.exit(0);
});

// Prevent crashes from unhandled puppeteer errors (WhatsApp Web navigation)
process.on('uncaughtException', (err) => {
  console.log(`\n⚠️ Non-fatal error (bot still running): ${err.message}\n`);
});

process.on('unhandledRejection', (err) => {
  console.log(`\n⚠️ Non-fatal error (bot still running): ${err?.message || err}\n`);
});
