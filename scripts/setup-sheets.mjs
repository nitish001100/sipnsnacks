#!/usr/bin/env node

/**
 * Google Sheets Database Setup Script
 * 
 * Creates a Google Spreadsheet with all required sheet tabs and headers.
 * Also seeds initial data (admin user, sample menu items).
 * 
 * Usage:
 *   npm run db:setup-sheets
 * 
 * Prerequisites:
 *   - Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN in .env.local
 *   - After running, copy the SPREADSHEET_ID into .env.local
 */

import { google } from 'googleapis';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const SHEET_TABS = {
  menu_items: ['id', 'name', 'price', 'category', 'available', 'has_variants', 'half_price', 'full_price', 'created_at', 'updated_at'],
  orders: ['id', 'order_number', 'total_amount', 'status', 'source', 'customer_whatsapp', 'customer_name', 'customer_address', 'created_at'],
  order_items: ['id', 'order_id', 'menu_item_id', 'item_name', 'quantity', 'price', 'subtotal', 'variant'],
  users: ['id', 'username', 'password_hash', 'role', 'created_at'],
  settings: ['key', 'value', 'updated_at'],
  push_tokens: ['id', 'token', 'user_role', 'created_at', 'updated_at'],
  ingredients: ['id', 'name', 'unit', 'current_quantity', 'minimum_quantity', 'unit_cost', 'created_at', 'updated_at'],
  menu_item_ingredients: ['id', 'menu_item_id', 'ingredient_id', 'quantity_required'],
  inventory_transactions: ['id', 'ingredient_id', 'transaction_type', 'quantity_change', 'order_id', 'notes', 'created_at'],
};

function getAuth() {
  // Method 1: Service Account (preferred)
  const saKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (saKey) {
    try {
      const keyData = JSON.parse(saKey);
      return new google.auth.GoogleAuth({
        credentials: keyData,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file',
        ],
      });
    } catch (err) {
      console.error('❌ Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY:', err.message);
      process.exit(1);
    }
  }

  // Method 2: OAuth2 (fallback)
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN) {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );
    client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });
    return client;
  }

  console.error('❌ Missing Google API credentials!');
  console.error('   Set GOOGLE_SERVICE_ACCOUNT_KEY in .env.local');
  console.error('   (See: npm run db:setup-sa for setup guide)');
  process.exit(1);
}

async function main() {
  console.log('🔧 Setting up Google Sheets database...\n');

  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  let spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  if (spreadsheetId) {
    console.log(`📄 Using existing spreadsheet: ${spreadsheetId}`);
    
    // Check which tabs already exist
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existingTabs = new Set(meta.data.sheets?.map(s => s.properties?.title) || []);

    // Add missing tabs
    const tabsToCreate = Object.keys(SHEET_TABS).filter(name => !existingTabs.has(name));
    
    if (tabsToCreate.length > 0) {
      console.log(`\n📑 Adding missing tabs: ${tabsToCreate.join(', ')}`);
      
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: tabsToCreate.map(name => ({
            addSheet: { properties: { title: name } },
          })),
        },
      });

      // Add headers to new tabs
      for (const name of tabsToCreate) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${name}!A1:${String.fromCharCode(64 + SHEET_TABS[name].length)}1`,
          valueInputOption: 'RAW',
          requestBody: { values: [SHEET_TABS[name]] },
        });
        console.log(`   ✅ ${name} — headers added`);
      }
    } else {
      console.log('   All tabs already exist! ✅');
    }
  } else {
    // Create new spreadsheet
    console.log('📝 Creating new spreadsheet...');
    
    const response = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: 'Merchant POS Database',
        },
        sheets: Object.entries(SHEET_TABS).map(([name, headers], index) => ({
          properties: {
            title: name,
            index,
          },
        })),
      },
    });

    spreadsheetId = response.data.spreadsheetId;
    console.log(`   ✅ Created spreadsheet: ${spreadsheetId}`);

    // Remove the default "Sheet1" if it exists
    const defaultSheet = response.data.sheets?.find(s => s.properties?.title === 'Sheet1');
    if (defaultSheet?.properties?.sheetId !== undefined) {
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{
              deleteSheet: { sheetId: defaultSheet.properties.sheetId },
            }],
          },
        });
      } catch {
        // Ignore if can't delete
      }
    }

    // Add headers to all tabs
    console.log('\n📑 Adding headers to all tabs...');
    for (const [name, headers] of Object.entries(SHEET_TABS)) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${name}!A1:${String.fromCharCode(64 + headers.length)}1`,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] },
      });
      console.log(`   ✅ ${name}`);
    }

    // Format header rows (bold, background color)
    const allSheets = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
    const formatRequests = (allSheets.data.sheets || []).map(s => ({
      repeatCell: {
        range: {
          sheetId: s.properties?.sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.1, green: 0.18, blue: 0.24 },
            textFormat: { bold: true, foregroundColor: { red: 0.96, green: 0.69, blue: 0.25 } },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    }));

    if (formatRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: formatRequests },
      });
    }

    // Freeze header rows
    const freezeRequests = (allSheets.data.sheets || []).map(s => ({
      updateSheetProperties: {
        properties: {
          sheetId: s.properties?.sheetId,
          gridProperties: { frozenRowCount: 1 },
        },
        fields: 'gridProperties.frozenRowCount',
      },
    }));

    if (freezeRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: freezeRequests },
      });
    }
  }

  // Seed admin user if users sheet is empty
  console.log('\n👤 Checking for admin user...');
  const usersData = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'users',
  });

  if (!usersData.data.values || usersData.data.values.length <= 1) {
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = await bcrypt.hash(adminPass, 12);
    const ts = new Date().toISOString();

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'users!A1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          [1, adminUser, hash, 'admin', ts],
          [2, 'chef', await bcrypt.hash('chef123', 12), 'chef', ts],
        ],
      },
    });
    console.log(`   ✅ Created admin user: ${adminUser}`);
    console.log(`   ✅ Created chef user: chef`);
  } else {
    console.log('   Users already exist, skipping seed.');
  }

  // Seed sample menu items if menu is empty
  console.log('\n🍔 Checking for menu items...');
  const menuData = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'menu_items',
  });

  if (!menuData.data.values || menuData.data.values.length <= 1) {
    const ts = new Date().toISOString();
    const sampleItems = [
      [1, 'Paneer Tikka', 220, 'Starters', true, false, '', '', ts, ts],
      [2, 'Chicken 65', 280, 'Starters', true, false, '', '', ts, ts],
      [3, 'Veg Spring Roll', 180, 'Starters', true, false, '', '', ts, ts],
      [4, 'Butter Chicken', 350, 'Main Course', true, false, '', '', ts, ts],
      [5, 'Paneer Butter Masala', 280, 'Main Course', true, false, '', '', ts, ts],
      [6, 'Dal Makhani', 220, 'Main Course', true, false, '', '', ts, ts],
      [7, 'Biryani (Chicken)', 300, 'Main Course', true, false, '', '', ts, ts],
      [8, 'Biryani (Veg)', 240, 'Main Course', true, false, '', '', ts, ts],
      [9, 'Butter Naan', 60, 'Breads', true, false, '', '', ts, ts],
      [10, 'Garlic Naan', 70, 'Breads', true, false, '', '', ts, ts],
      [11, 'Roti', 30, 'Breads', true, false, '', '', ts, ts],
      [12, 'Masala Chai', 40, 'Beverages', true, false, '', '', ts, ts],
      [13, 'Cold Coffee', 120, 'Beverages', true, false, '', '', ts, ts],
      [14, 'Fresh Lime Soda', 80, 'Beverages', true, false, '', '', ts, ts],
      [15, 'Gulab Jamun', 80, 'Desserts', true, false, '', '', ts, ts],
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'menu_items!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: sampleItems },
    });
    console.log(`   ✅ Seeded ${sampleItems.length} sample menu items`);
  } else {
    console.log('   Menu items already exist, skipping seed.');
  }

  // Seed settlement password
  console.log('\n🔒 Checking settings...');
  const settingsData = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'settings',
  });

  if (!settingsData.data.values || settingsData.data.values.length <= 1) {
    const settleHash = await bcrypt.hash('settle123', 12);
    const ts = new Date().toISOString();
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'settings!A1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['settlement_password', settleHash, ts]],
      },
    });
    console.log('   ✅ Created default settlement password');
  } else {
    console.log('   Settings already exist, skipping seed.');
  }

  // Move spreadsheet to specific folder if configured
  if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
    try {
      // Get current parents
      const file = await drive.files.get({
        fileId: spreadsheetId,
        fields: 'parents',
      });

      const prevParents = file.data.parents?.join(',') || '';
      
      await drive.files.update({
        fileId: spreadsheetId,
        addParents: process.env.GOOGLE_DRIVE_FOLDER_ID,
        removeParents: prevParents,
        fields: 'id, parents',
      });
      console.log(`\n📁 Moved to Google Drive folder: ${process.env.GOOGLE_DRIVE_FOLDER_ID}`);
    } catch (err) {
      console.log('\n⚠️  Could not move to folder (this is okay, spreadsheet still works)');
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ SETUP COMPLETE!');
  console.log('='.repeat(60));
  console.log(`\n📋 Spreadsheet ID: ${spreadsheetId}`);
  console.log(`🔗 URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
  console.log(`\n📝 Add this to your .env.local:\n`);
  console.log(`   GOOGLE_SPREADSHEET_ID="${spreadsheetId}"`);
  console.log('\n' + '='.repeat(60));
}

main().catch(err => {
  console.error('\n❌ Setup failed:', err.message || err);
  process.exit(1);
});
