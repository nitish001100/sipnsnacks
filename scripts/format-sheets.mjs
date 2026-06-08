#!/usr/bin/env node

/**
 * 🎨 Google Sheets Professional Formatter
 * 
 * Makes the "Merchant POS Database" spreadsheet look clean, professional,
 * and well-organized with proper column widths, colors, frozen headers,
 * tab colors, and number formatting.
 * 
 * Usage: node scripts/format-sheets.mjs
 */

import { google } from 'googleapis';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

// ── Auth ──────────────────────────────────────────────
function getAuth() {
  const saKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (saKey) {
    const keyData = JSON.parse(saKey);
    return new google.auth.GoogleAuth({
      credentials: keyData,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN) {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );
    client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return client;
  }
  throw new Error('No Google credentials configured');
}

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
if (!SPREADSHEET_ID) { console.error('❌ GOOGLE_SPREADSHEET_ID not set'); process.exit(1); }

const sheets = google.sheets({ version: 'v4', auth: getAuth() });

// ── Color Palette ─────────────────────────────────────
const C = {
  // Brand: Dark navy header
  headerBg:    { red: 0.106, green: 0.180, blue: 0.235 },  // #1B2E3C
  headerText:  { red: 0.961, green: 0.690, blue: 0.255 },  // #F5B041 (amber)
  // Alternating row colors
  evenRow:     { red: 0.976, green: 0.980, blue: 0.984 },  // #F9FAFB very light gray
  oddRow:      { red: 1, green: 1, blue: 1 },               // white
  // Tab colors by category
  tabMenu:     { red: 0.133, green: 0.545, blue: 0.133 },  // green
  tabOrders:   { red: 0.957, green: 0.643, blue: 0.376 },  // orange
  tabAdmin:    { red: 0.255, green: 0.412, blue: 0.882 },  // blue
  tabInventory:{ red: 0.608, green: 0.349, blue: 0.714 },  // purple
};

// ── Sheet Configuration ───────────────────────────────
// Each sheet: display headers (prettier), column widths, tab color, number format hints
const SHEET_CONFIG = {
  menu_items: {
    displayHeaders: ['ID', 'Item Name', 'Price (₹)', 'Category', 'Available', 'Has Variants', 'Half Price (₹)', 'Full Price (₹)', 'Created At', 'Updated At'],
    columnWidths:   [50,   220,         90,          140,        85,          95,              100,               100,              170,          170],
    tabColor: C.tabMenu,
    currencyCols: [2, 6, 7], // 0-indexed: price, half_price, full_price
  },
  orders: {
    displayHeaders: ['ID', 'Order Number', 'Total (₹)', 'Status', 'Source', 'WhatsApp', 'Customer Name', 'Address', 'Created At'],
    columnWidths:   [50,   150,            100,         90,       80,       130,         150,             200,       170],
    tabColor: C.tabOrders,
    currencyCols: [2],
  },
  order_items: {
    displayHeaders: ['ID', 'Order ID', 'Menu Item ID', 'Item Name', 'Qty', 'Price (₹)', 'Subtotal (₹)', 'Variant'],
    columnWidths:   [50,   80,         100,             200,         50,    90,           100,             80],
    tabColor: C.tabOrders,
    currencyCols: [5, 6],
  },
  users: {
    displayHeaders: ['ID', 'Username', 'Password Hash', 'Role', 'Created At'],
    columnWidths:   [50,   120,        300,              80,     170],
    tabColor: C.tabAdmin,
  },
  settings: {
    displayHeaders: ['Key', 'Value', 'Updated At'],
    columnWidths:   [200,   300,     170],
    tabColor: C.tabAdmin,
  },
  push_tokens: {
    displayHeaders: ['ID', 'FCM Token', 'Role', 'Created At', 'Updated At'],
    columnWidths:   [50,   350,         80,     170,          170],
    tabColor: C.tabAdmin,
  },
  ingredients: {
    displayHeaders: ['ID', 'Name', 'Unit', 'Current Qty', 'Min Qty', 'Unit Cost (₹)', 'Created At', 'Updated At'],
    columnWidths:   [50,   180,    70,     100,           90,        110,               170,          170],
    tabColor: C.tabInventory,
    currencyCols: [5],
  },
  menu_item_ingredients: {
    displayHeaders: ['ID', 'Menu Item ID', 'Ingredient ID', 'Qty Required'],
    columnWidths:   [50,   110,            110,              110],
    tabColor: C.tabInventory,
  },
  inventory_transactions: {
    displayHeaders: ['ID', 'Ingredient ID', 'Type', 'Qty Change', 'Order ID', 'Notes', 'Created At'],
    columnWidths:   [50,   110,             120,    100,          90,         250,      170],
    tabColor: C.tabInventory,
  },
};

// Desired tab order (grouped logically)
const TAB_ORDER = [
  'menu_items',
  'orders',
  'order_items',
  'ingredients',
  'menu_item_ingredients',
  'inventory_transactions',
  'users',
  'settings',
  'push_tokens',
];

async function main() {
  console.log('🎨 Formatting Google Sheets — Merchant POS Database\n');

  // 1. Rename spreadsheet title
  console.log('📝 Setting spreadsheet title...');
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        updateSpreadsheetProperties: {
          properties: { title: '📊 Sip n Snacks — POS Database' },
          fields: 'title',
        },
      }],
    },
  });
  console.log('   ✅ Title set to: 📊 Sip n Snacks — POS Database');

  // 2. Get all sheet metadata
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: 'sheets.properties',
  });
  const sheetMap = {};
  for (const s of meta.data.sheets || []) {
    sheetMap[s.properties.title] = s.properties.sheetId;
  }

  const requests = [];

  // 3. Reorder tabs
  console.log('\n📑 Reordering tabs...');
  for (let i = 0; i < TAB_ORDER.length; i++) {
    const name = TAB_ORDER[i];
    if (sheetMap[name] !== undefined) {
      requests.push({
        updateSheetProperties: {
          properties: { sheetId: sheetMap[name], index: i },
          fields: 'index',
        },
      });
      console.log(`   ${i + 1}. ${name}`);
    }
  }

  // 4. For each configured sheet, apply formatting
  for (const [name, config] of Object.entries(SHEET_CONFIG)) {
    const sheetId = sheetMap[name];
    if (sheetId === undefined) {
      console.log(`   ⚠️  Sheet "${name}" not found, skipping`);
      continue;
    }
    const numCols = config.displayHeaders.length;
    console.log(`\n🎨 Formatting: ${name} (${numCols} columns)`);

    // 4a. Tab color
    requests.push({
      updateSheetProperties: {
        properties: { sheetId, tabColorStyle: { rgbColor: config.tabColor } },
        fields: 'tabColorStyle',
      },
    });

    // 4b. Freeze header row
    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 1 },
        },
        fields: 'gridProperties.frozenRowCount',
      },
    });

    // 4c. Header row: dark background + amber bold text + center align
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: numCols },
        cell: {
          userEnteredFormat: {
            backgroundColor: C.headerBg,
            textFormat: {
              bold: true,
              fontSize: 10,
              foregroundColor: C.headerText,
              fontFamily: 'Google Sans',
            },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            padding: { top: 4, bottom: 4, left: 6, right: 6 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding)',
      },
    });

    // 4d. Column widths
    for (let col = 0; col < config.columnWidths.length; col++) {
      requests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: col, endIndex: col + 1 },
          properties: { pixelSize: config.columnWidths[col] },
          fields: 'pixelSize',
        },
      });
    }

    // 4e. Header row height
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 36 },
        fields: 'pixelSize',
      },
    });

    // 4f. Data rows: set font, vertical alignment
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: numCols },
        cell: {
          userEnteredFormat: {
            textFormat: { fontSize: 10, fontFamily: 'Google Sans' },
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'CLIP',
          },
        },
        fields: 'userEnteredFormat(textFormat,verticalAlignment,wrapStrategy)',
      },
    });

    // 4g. Alternating row colors (banding)
    requests.push({
      addBanding: {
        bandedRange: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: numCols },
          rowProperties: {
            headerColor: C.headerBg,
            firstBandColor: C.oddRow,
            secondBandColor: C.evenRow,
          },
        },
      },
    });

    // 4h. ID column (col 0) — center aligned, light gray text
    if (config.displayHeaders[0] === 'ID') {
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 1 },
          cell: {
            userEnteredFormat: {
              horizontalAlignment: 'CENTER',
              textFormat: { fontSize: 10, fontFamily: 'Google Sans', foregroundColor: { red: 0.6, green: 0.6, blue: 0.6 } },
            },
          },
          fields: 'userEnteredFormat(horizontalAlignment,textFormat)',
        },
      });
    }

    // 4i. Currency columns — ₹ format, right aligned
    if (config.currencyCols) {
      for (const col of config.currencyCols) {
        requests.push({
          repeatCell: {
            range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: col, endColumnIndex: col + 1 },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: 'CURRENCY', pattern: '₹#,##0.00' },
                horizontalAlignment: 'RIGHT',
              },
            },
            fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
          },
        });
      }
    }
  }

  // 5. Execute all formatting in one batch
  console.log('\n⚡ Applying all formatting...');
  // Sheets API has a limit, batch in chunks of 100
  const CHUNK = 100;
  for (let i = 0; i < requests.length; i += CHUNK) {
    const chunk = requests.slice(i, i + CHUNK);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: chunk },
    });
    console.log(`   ✅ Applied ${Math.min(i + CHUNK, requests.length)}/${requests.length} operations`);
  }

  // 6. Update display headers (prettier names)
  console.log('\n📋 Updating display headers...');
  for (const [name, config] of Object.entries(SHEET_CONFIG)) {
    if (sheetMap[name] === undefined) continue;
    const endCol = String.fromCharCode(64 + config.displayHeaders.length);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${name}!A1:${endCol}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [config.displayHeaders] },
    });
    console.log(`   ✅ ${name}`);
  }

  console.log('\n' + '═'.repeat(55));
  console.log('✅ FORMATTING COMPLETE!');
  console.log('═'.repeat(55));
  console.log(`\n🔗 https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`);
  console.log('\n📊 Features applied:');
  console.log('   • Spreadsheet titled: 📊 Sip n Snacks — POS Database');
  console.log('   • Tabs reordered: Menu → Orders → Inventory → Admin');
  console.log('   • Tab colors: 🟢 Menu  🟠 Orders  🟣 Inventory  🔵 Admin');
  console.log('   • Headers: Dark navy bg + amber bold text + frozen');
  console.log('   • Column widths optimized per field');
  console.log('   • Alternating row colors (zebra striping)');
  console.log('   • Currency columns: ₹ formatted + right aligned');
  console.log('   • Google Sans font throughout');
  console.log('   • Professional display headers (ID, Item Name, etc.)');
}

main().catch(err => {
  console.error('\n❌ Formatting failed:', err.message);
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  process.exit(1);
});
