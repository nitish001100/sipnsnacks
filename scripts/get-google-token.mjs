#!/usr/bin/env node
import { google } from 'googleapis';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { exec } from 'child_process';
import http from 'http';
import { URL } from 'url';
import fs from 'fs';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PORT = 8844;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
  ],
  prompt: 'consent',
});

console.log('\n🔐 Opening browser for Google Sign-In...\n');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== '/callback') { res.writeHead(404); res.end(); return; }

  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error || !code) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<h2>❌ Error: ${error || 'no code'}</h2>`);
    server.close(); process.exit(1);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body style="font-family:system-ui;text-align:center;padding:60px;background:#f0fdf4"><h2>✅ Success!</h2><p>Token saved. You can close this window.</p><p>Now run: <code>npm run db:setup-sheets</code></p></body></html>');

    const envPath = resolve(process.cwd(), '.env.local');
    let env = fs.readFileSync(envPath, 'utf-8');
    if (tokens.refresh_token) {
      env = env.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN="${tokens.refresh_token}"`);
      fs.writeFileSync(envPath, env);
      console.log('✅ GOOGLE_REFRESH_TOKEN saved to .env.local!');
      console.log(`\n📝 Next: npm run db:setup-sheets\n`);
    } else {
      console.log('⚠️ No refresh token returned. Try again with prompt=consent.');
    }
    setTimeout(() => { server.close(); process.exit(0); }, 500);
  } catch (err) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<h2>❌ ${err.message}</h2>`);
    console.error('Error:', err.message);
    server.close(); process.exit(1);
  }
});

server.listen(PORT, () => {
  try { exec(`open "${authUrl}"`); } catch {}
});

setTimeout(() => { console.log('⏰ Timeout'); server.close(); process.exit(1); }, 300000);
