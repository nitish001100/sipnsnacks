import { google, sheets_v4 } from 'googleapis';

// ========== Configuration ==========
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '';

// ========== Sheet Names ==========
export const SHEET = {
  MENU_ITEMS: 'menu_items',
  ORDERS: 'orders',
  ORDER_ITEMS: 'order_items',
  USERS: 'users',
  SETTINGS: 'settings',
  PUSH_TOKENS: 'push_tokens',
  INGREDIENTS: 'ingredients',
  MENU_ITEM_INGREDIENTS: 'menu_item_ingredients',
  INVENTORY_TRANSACTIONS: 'inventory_transactions',
} as const;

// Headers for each sheet tab
export const HEADERS: Record<string, string[]> = {
  [SHEET.MENU_ITEMS]: ['id', 'name', 'price', 'category', 'available', 'has_variants', 'half_price', 'full_price', 'created_at', 'updated_at'],
  [SHEET.ORDERS]: ['id', 'order_number', 'total_amount', 'status', 'source', 'customer_whatsapp', 'customer_name', 'customer_address', 'created_at'],
  [SHEET.ORDER_ITEMS]: ['id', 'order_id', 'menu_item_id', 'item_name', 'quantity', 'price', 'subtotal', 'variant'],
  [SHEET.USERS]: ['id', 'username', 'password_hash', 'role', 'created_at'],
  [SHEET.SETTINGS]: ['key', 'value', 'updated_at'],
  [SHEET.PUSH_TOKENS]: ['id', 'token', 'user_role', 'created_at', 'updated_at'],
  [SHEET.INGREDIENTS]: ['id', 'name', 'unit', 'current_quantity', 'minimum_quantity', 'unit_cost', 'created_at', 'updated_at'],
  [SHEET.MENU_ITEM_INGREDIENTS]: ['id', 'menu_item_id', 'ingredient_id', 'quantity_required'],
  [SHEET.INVENTORY_TRANSACTIONS]: ['id', 'ingredient_id', 'transaction_type', 'quantity_change', 'order_id', 'notes', 'created_at'],
};

// ========== Auth ==========
// Supports two auth methods:
// 1. Service Account (preferred) — set GOOGLE_SERVICE_ACCOUNT_KEY as JSON string
// 2. OAuth2 (fallback) — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN

function getAuth() {
  // Method 1: Service Account (preferred — no expiry, no consent screen)
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
      console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY:', err);
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

  throw new Error(
    'Google auth not configured! Set GOOGLE_SERVICE_ACCOUNT_KEY (preferred) ' +
    'or GOOGLE_CLIENT_ID + GOOGLE_REFRESH_TOKEN in .env.local'
  );
}

let _sheets: sheets_v4.Sheets | null = null;
function getSheets(): sheets_v4.Sheets {
  if (!_sheets) {
    _sheets = google.sheets({ version: 'v4', auth: getAuth() as any });
  }
  return _sheets;
}

// ========== Cache ==========
const cache = new Map<string, { rows: string[][]; ts: number }>();
const CACHE_TTL = 10_000; // 10 seconds

export function invalidateCache(sheetName?: string) {
  if (sheetName) cache.delete(sheetName);
  else cache.clear();
}

// ========== Helpers ==========
function colLetter(n: number): string {
  let result = '';
  let c = n;
  while (c > 0) {
    c--;
    result = String.fromCharCode(65 + (c % 26)) + result;
    c = Math.floor(c / 26);
  }
  return result;
}

// ========== Core Read Operations ==========

/** Read all rows from a sheet (including header row). Returns string[][] */
export async function readSheet(sheetName: string): Promise<string[][]> {
  if (!SPREADSHEET_ID) {
    throw new Error('GOOGLE_SPREADSHEET_ID is not configured. Run: npm run db:setup-sheets');
  }

  const cached = cache.get(sheetName);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.rows;
  }

  try {
    const res = await getSheets().spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetName,
    });

    const rows = (res.data.values as string[][]) || [];
    cache.set(sheetName, { rows, ts: Date.now() });
    return rows;
  } catch (error: any) {
    if (error?.code === 400 || error?.message?.includes('Unable to parse range')) {
      // Sheet tab doesn't exist yet
      console.warn(`Sheet "${sheetName}" not found. Run: npm run db:setup-sheets`);
      return [];
    }
    throw error;
  }
}

/** Read data rows only (skip header), returns raw string arrays */
export async function readDataRows(sheetName: string): Promise<string[][]> {
  const rows = await readSheet(sheetName);
  return rows.length > 1 ? rows.slice(1) : [];
}

// ========== Core Write Operations ==========

/** Append a single row of data */
export async function appendRow(sheetName: string, values: any[]): Promise<void> {
  const cleaned = values.map(v => (v === null || v === undefined) ? '' : v);

  await getSheets().spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [cleaned] },
  });
  invalidateCache(sheetName);
}

/** Append multiple rows at once */
export async function appendRows(sheetName: string, rows: any[][]): Promise<void> {
  if (rows.length === 0) return;
  const cleaned = rows.map(row =>
    row.map(v => (v === null || v === undefined) ? '' : v)
  );

  await getSheets().spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: cleaned },
  });
  invalidateCache(sheetName);
}

/** Update a specific row by data index (0 = first data row after header) */
export async function updateRow(sheetName: string, dataIndex: number, values: any[]): Promise<void> {
  const sheetRow = dataIndex + 2; // +1 for header, +1 for 1-based indexing
  const endCol = colLetter(values.length);
  const cleaned = values.map(v => (v === null || v === undefined) ? '' : v);

  await getSheets().spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${sheetRow}:${endCol}${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [cleaned] },
  });
  invalidateCache(sheetName);
}

/** Delete a row by data index (0 = first data row after header) */
export async function deleteRow(sheetName: string, dataIndex: number): Promise<void> {
  const sheetId = await getSheetId(sheetName);
  if (sheetId === null) return;

  const startIndex = dataIndex + 1; // +1 for header row (0-based in batchUpdate API)

  await getSheets().spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex,
            endIndex: startIndex + 1,
          },
        },
      }],
    },
  });
  invalidateCache(sheetName);
}

/** Delete multiple rows by data indices (sorted descending to avoid index shifts) */
export async function deleteRows(sheetName: string, dataIndices: number[]): Promise<void> {
  if (dataIndices.length === 0) return;

  const sheetId = await getSheetId(sheetName);
  if (sheetId === null) return;

  // Sort descending to avoid index shift issues
  const sorted = [...dataIndices].sort((a, b) => b - a);

  const requests = sorted.map(idx => ({
    deleteDimension: {
      range: {
        sheetId,
        dimension: 'ROWS',
        startIndex: idx + 1, // +1 for header
        endIndex: idx + 2,
      },
    },
  }));

  await getSheets().spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });
  invalidateCache(sheetName);
}

/** Delete ALL data rows (keep header). Returns count of deleted rows. */
export async function clearSheet(sheetName: string): Promise<number> {
  const rows = await readSheet(sheetName);
  if (rows.length <= 1) return 0;

  const count = rows.length - 1;
  const sheetId = await getSheetId(sheetName);
  if (sheetId === null) return 0;

  await getSheets().spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: 1,
            endIndex: rows.length,
          },
        },
      }],
    },
  });
  invalidateCache(sheetName);
  return count;
}

// ========== Utility Functions ==========

/** Get next auto-increment ID for a sheet (column 0 = id) */
export async function getNextId(sheetName: string): Promise<number> {
  const rows = await readSheet(sheetName);
  if (rows.length <= 1) return 1;
  const ids = rows.slice(1).map(row => parseInt(row[0]) || 0);
  return Math.max(0, ...ids) + 1;
}

/** Get the internal sheetId for batchUpdate operations */
async function getSheetId(sheetName: string): Promise<number | null> {
  const meta = await getSheets().spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: 'sheets.properties',
  });
  const sheet = meta.data.sheets?.find(s => s.properties?.title === sheetName);
  return sheet?.properties?.sheetId ?? null;
}

/** Find data index of first row where column matches value. Returns -1 if not found. */
export function findDataIndex(rows: string[][], colIndex: number, value: string): number {
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i]?.[colIndex] ?? '') === String(value)) {
      return i - 1; // data index (0-based, excluding header)
    }
  }
  return -1;
}

/** Find all data indices where column matches value */
export function findAllDataIndices(rows: string[][], colIndex: number, value: string): number[] {
  const indices: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i]?.[colIndex] ?? '') === String(value)) {
      indices.push(i - 1);
    }
  }
  return indices;
}
