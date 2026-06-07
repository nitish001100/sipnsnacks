#!/usr/bin/env node

/**
 * Migrate data from PostgreSQL → Google Sheets
 * Replaces the seed data with your actual PostgreSQL data.
 */

import { google } from 'googleapis';
import pg from 'pg';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const POSTGRES_URL = process.env.POSTGRES_URL;

if (!SPREADSHEET_ID) { console.error('❌ GOOGLE_SPREADSHEET_ID not set'); process.exit(1); }
if (!POSTGRES_URL) { console.error('❌ POSTGRES_URL not set'); process.exit(1); }

function getAuth() {
  const saKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (saKey) {
    const keyData = JSON.parse(saKey);
    return new google.auth.GoogleAuth({ credentials: keyData, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  }
  const client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, 'https://developers.google.com/oauthplayground');
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return client;
}

const auth = getAuth();
const sheets = google.sheets({ version: 'v4', auth });

async function clearAndWrite(sheetName, headers, rows) {
  // Get sheet ID
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, fields: 'sheets.properties' });
  const sheet = meta.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) { console.log(`   ⚠️ Sheet "${sheetName}" not found, skipping`); return; }

  // Get current row count
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: sheetName });
  const existingRows = existing.data.values || [];

  // Clear data rows (keep header)
  if (existingRows.length > 1) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: 1, endIndex: existingRows.length },
          },
        }],
      },
    });
  }

  // Write new data
  if (rows.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    });
  }

  console.log(`   ✅ ${sheetName}: ${rows.length} rows migrated`);
}

async function main() {
  console.log('\n🔄 Migrating PostgreSQL → Google Sheets...\n');

  const pool = new pg.Pool({ connectionString: POSTGRES_URL });

  try {
    // 1. Menu Items
    console.log('📋 Migrating menu_items...');
    const menuResult = await pool.query('SELECT id, name, price, category, available, has_variants, half_price, full_price, created_at, updated_at FROM menu_items ORDER BY id');
    const menuRows = menuResult.rows.map(r => [
      r.id, r.name, parseFloat(r.price), r.category,
      r.available ? 'true' : 'false',
      r.has_variants ? 'true' : 'false',
      r.half_price || '', r.full_price || '',
      r.created_at?.toISOString() || '', r.updated_at?.toISOString() || '',
    ]);
    await clearAndWrite('menu_items', null, menuRows);

    // 2. Orders
    console.log('📋 Migrating orders...');
    const ordersResult = await pool.query('SELECT * FROM orders ORDER BY id');
    const orderRows = ordersResult.rows.map(r => [
      r.id, r.order_number, parseFloat(r.total_amount),
      r.status || 'pending', r.source || 'offline',
      r.customer_whatsapp || '', r.customer_name || '', r.customer_address || '',
      r.created_at?.toISOString() || '',
    ]);
    await clearAndWrite('orders', null, orderRows);

    // 3. Order Items
    console.log('📋 Migrating order_items...');
    const itemsResult = await pool.query('SELECT * FROM order_items ORDER BY id');
    const itemRows = itemsResult.rows.map(r => [
      r.id, r.order_id, r.menu_item_id, r.item_name,
      r.quantity, parseFloat(r.price), parseFloat(r.subtotal),
      r.variant || '',
    ]);
    await clearAndWrite('order_items', null, itemRows);

    // 4. Users
    console.log('📋 Migrating users...');
    const usersResult = await pool.query('SELECT * FROM users ORDER BY id');
    const userRows = usersResult.rows.map(r => [
      r.id, r.username, r.password_hash, r.role || 'admin',
      r.created_at?.toISOString() || '',
    ]);
    await clearAndWrite('users', null, userRows);

    // 5. Settings
    console.log('📋 Migrating settings...');
    const settingsResult = await pool.query('SELECT * FROM settings');
    const settingsRows = settingsResult.rows.map(r => [
      r.key, r.value, r.updated_at?.toISOString() || '',
    ]);
    await clearAndWrite('settings', null, settingsRows);

    // 6. Push tokens (if table exists)
    try {
      const pushResult = await pool.query('SELECT * FROM push_tokens ORDER BY id');
      if (pushResult.rows.length > 0) {
        console.log('📋 Migrating push_tokens...');
        const pushRows = pushResult.rows.map(r => [
          r.id, r.token, r.user_role || 'kitchen',
          r.created_at?.toISOString() || '', r.updated_at?.toISOString() || '',
        ]);
        await clearAndWrite('push_tokens', null, pushRows);
      }
    } catch { /* table doesn't exist, skip */ }

    console.log('\n' + '='.repeat(50));
    console.log('✅ MIGRATION COMPLETE!');
    console.log('='.repeat(50));
    console.log(`\n🔗 Your data is now at:`);
    console.log(`   https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`);
    console.log(`\n📊 Summary:`);
    console.log(`   Menu Items: ${menuRows.length}`);
    console.log(`   Orders: ${orderRows.length}`);
    console.log(`   Order Items: ${itemRows.length}`);
    console.log(`   Users: ${userRows.length}`);
    console.log(`   Settings: ${settingsRows.length}`);
    console.log('\n🎉 Google Sheets is now your primary database!\n');

  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('\n❌ Migration failed:', err.message || err);
  process.exit(1);
});
