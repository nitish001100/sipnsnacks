import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthFromHeaders } from '@/lib/auth';

/**
 * POST /api/settings/format-sheets
 * One-time API to professionally format the Google Sheets database.
 * Requires admin auth.
 */

function getGoogleAuth() {
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
  throw new Error('No Google credentials');
}

const C = {
  headerBg:    { red: 0.106, green: 0.180, blue: 0.235 },
  headerText:  { red: 0.961, green: 0.690, blue: 0.255 },
  evenRow:     { red: 0.976, green: 0.980, blue: 0.984 },
  oddRow:      { red: 1, green: 1, blue: 1 },
  tabMenu:     { red: 0.133, green: 0.545, blue: 0.133 },
  tabOrders:   { red: 0.957, green: 0.643, blue: 0.376 },
  tabAdmin:    { red: 0.255, green: 0.412, blue: 0.882 },
  tabInventory:{ red: 0.608, green: 0.349, blue: 0.714 },
};

const SHEET_CONFIG: Record<string, { displayHeaders: string[]; columnWidths: number[]; tabColor: any; currencyCols?: number[] }> = {
  menu_items: {
    displayHeaders: ['ID', 'Item Name', 'Price (₹)', 'Category', 'Available', 'Has Variants', 'Half Price (₹)', 'Full Price (₹)', 'Created At', 'Updated At'],
    columnWidths:   [50,   220,         90,          140,        85,          95,              100,               100,              170,          170],
    tabColor: C.tabMenu,
    currencyCols: [2, 6, 7],
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

const TAB_ORDER = [
  'menu_items', 'orders', 'order_items',
  'ingredients', 'menu_item_ingredients', 'inventory_transactions',
  'users', 'settings', 'push_tokens',
];

export async function POST(request: NextRequest) {
  const auth = getAuthFromHeaders(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
  if (!SPREADSHEET_ID) {
    return NextResponse.json({ error: 'GOOGLE_SPREADSHEET_ID not set' }, { status: 500 });
  }

  try {
    const sheetsApi = google.sheets({ version: 'v4', auth: getGoogleAuth() as any });
    const log: string[] = [];

    // 1. Rename spreadsheet
    await sheetsApi.spreadsheets.batchUpdate({
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
    log.push('✅ Title: 📊 Sip n Snacks — POS Database');

    // 2. Get sheet metadata
    const meta = await sheetsApi.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      fields: 'sheets.properties',
    });
    const sheetMap: Record<string, number> = {};
    for (const s of meta.data.sheets || []) {
      if (s.properties?.title) sheetMap[s.properties.title] = s.properties.sheetId!;
    }

    // 3. First remove existing banding to avoid duplicates
    const removeBandingRequests: any[] = [];
    const fullMeta = await sheetsApi.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      fields: 'sheets.bandedRanges',
    });
    for (const s of fullMeta.data.sheets || []) {
      for (const br of s.bandedRanges || []) {
        if (br.bandedRangeId) {
          removeBandingRequests.push({ deleteBanding: { bandedRangeId: br.bandedRangeId } });
        }
      }
    }
    if (removeBandingRequests.length > 0) {
      await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: removeBandingRequests },
      });
      log.push(`✅ Cleared ${removeBandingRequests.length} old banding ranges`);
    }

    const requests: any[] = [];

    // 4. Reorder tabs
    for (let i = 0; i < TAB_ORDER.length; i++) {
      const name = TAB_ORDER[i];
      if (sheetMap[name] !== undefined) {
        requests.push({
          updateSheetProperties: {
            properties: { sheetId: sheetMap[name], index: i },
            fields: 'index',
          },
        });
      }
    }
    log.push('✅ Tabs reordered: Menu → Orders → Inventory → Admin');

    // 5. Format each sheet
    for (const [name, config] of Object.entries(SHEET_CONFIG)) {
      const sheetId = sheetMap[name];
      if (sheetId === undefined) continue;
      const numCols = config.displayHeaders.length;

      // Tab color
      requests.push({
        updateSheetProperties: {
          properties: { sheetId, tabColorStyle: { rgbColor: config.tabColor } },
          fields: 'tabColorStyle',
        },
      });

      // Freeze header
      requests.push({
        updateSheetProperties: {
          properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
          fields: 'gridProperties.frozenRowCount',
        },
      });

      // Header styling
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: numCols },
          cell: {
            userEnteredFormat: {
              backgroundColor: C.headerBg,
              textFormat: { bold: true, fontSize: 10, foregroundColor: C.headerText, fontFamily: 'Google Sans' },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
        },
      });

      // Column widths
      for (let col = 0; col < config.columnWidths.length; col++) {
        requests.push({
          updateDimensionProperties: {
            range: { sheetId, dimension: 'COLUMNS', startIndex: col, endIndex: col + 1 },
            properties: { pixelSize: config.columnWidths[col] },
            fields: 'pixelSize',
          },
        });
      }

      // Header row height
      requests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
          properties: { pixelSize: 36 },
          fields: 'pixelSize',
        },
      });

      // Data rows font
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

      // Banding (zebra stripes)
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

      // ID column center + gray
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

      // Currency columns
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

      log.push(`✅ ${name}: formatted (${numCols} cols)`);
    }

    // 6. Batch execute in chunks of 80
    for (let i = 0; i < requests.length; i += 80) {
      await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: requests.slice(i, i + 80) },
      });
    }
    log.push(`✅ ${requests.length} formatting operations applied`);

    // 7. Update display headers
    for (const [name, config] of Object.entries(SHEET_CONFIG)) {
      if (sheetMap[name] === undefined) continue;
      const endCol = String.fromCharCode(64 + config.displayHeaders.length);
      await sheetsApi.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${name}!A1:${endCol}1`,
        valueInputOption: 'RAW',
        requestBody: { values: [config.displayHeaders] },
      });
    }
    log.push('✅ Display headers updated (ID, Item Name, Price ₹, etc.)');

    return NextResponse.json({
      success: true,
      message: '🎨 Spreadsheet formatted professionally!',
      log,
      url: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`,
    });
  } catch (error: any) {
    console.error('Format sheets error:', error);
    return NextResponse.json({ error: error.message || 'Formatting failed' }, { status: 500 });
  }
}
