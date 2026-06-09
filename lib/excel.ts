import ExcelJS from 'exceljs';
import { getOrdersForDate, getDailySummary, OrderWithItems, getIngredients, getInventoryTransactions, getLowStockIngredients, getAllRecipes } from './db';

const headerStyle: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2E3C' } },
  alignment: { horizontal: 'center', vertical: 'middle' },
  border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } },
};

function styleHeader(sheet: ExcelJS.Worksheet) {
  sheet.getRow(1).eachCell((cell) => { Object.assign(cell, { style: headerStyle }); });
  sheet.getRow(1).height = 30;
}

function addBorders(row: ExcelJS.Row) {
  row.eachCell((cell) => { cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; });
}

export async function generateDailyExcel(date: string): Promise<Buffer> {
  const orders = await getOrdersForDate(date);
  const summary = await getDailySummary(date);
  const ingredients = await getIngredients();
  const transactions = await getInventoryTransactions(undefined, 200);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sip n Snacks';
  workbook.created = new Date();

  // ---- Orders Sheet ----
  const ordersSheet = workbook.addWorksheet('Orders');
  ordersSheet.columns = [
    { header: 'Order ID', key: 'order_number', width: 22 },
    { header: 'Items', key: 'items', width: 40 },
    { header: 'Quantity', key: 'quantity', width: 12 },
    { header: 'Total Amount (₹)', key: 'total_amount', width: 18 },
    { header: 'Timestamp', key: 'timestamp', width: 22 },
  ];
  styleHeader(ordersSheet);

  orders.forEach((order: OrderWithItems) => {
    const itemNames = order.items.map((i) => `${i.item_name} x${i.quantity}`).join(', ');
    const totalQty = order.items.reduce((sum, i) => sum + i.quantity, 0);
    const timestamp = new Date(order.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const row = ordersSheet.addRow({ order_number: order.order_number, items: itemNames, quantity: totalQty, total_amount: order.total_amount, timestamp });
    if (row.number % 2 === 0) row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E7' } }; });
    addBorders(row);
  });

  // ---- Summary Sheet ----
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 25 },
  ];
  styleHeader(summarySheet);

  const totalStockValue = ingredients.reduce((s, i) => s + i.current_quantity * i.unit_cost, 0);
  const lowStock = ingredients.filter(i => i.minimum_quantity > 0 && i.current_quantity <= i.minimum_quantity);
  const outOfStock = ingredients.filter(i => i.current_quantity <= 0);

  [
    { metric: 'Date', value: date },
    { metric: 'Total Orders', value: summary.total_orders },
    { metric: 'Total Revenue (₹)', value: summary.total_revenue },
    { metric: 'Items Sold', value: summary.items_sold },
    { metric: '---', value: '---' },
    { metric: 'Total Inventory Items', value: ingredients.length },
    { metric: 'Total Stock Value (₹)', value: Math.round(totalStockValue) },
    { metric: 'Low Stock Items', value: lowStock.length },
    { metric: 'Out of Stock Items', value: outOfStock.length },
  ].forEach((d) => { const r = summarySheet.addRow(d); addBorders(r); });

  // ---- Inventory Sheet ----
  const invSheet = workbook.addWorksheet('Inventory');
  invSheet.columns = [
    { header: 'Ingredient', key: 'name', width: 25 },
    { header: 'Unit', key: 'unit', width: 12 },
    { header: 'Current Stock', key: 'current_quantity', width: 15 },
    { header: 'Min Level', key: 'minimum_quantity', width: 12 },
    { header: 'Unit Cost (₹)', key: 'unit_cost', width: 14 },
    { header: 'Stock Value (₹)', key: 'stock_value', width: 15 },
    { header: 'Status', key: 'status', width: 14 },
  ];
  styleHeader(invSheet);

  ingredients.forEach((ing) => {
    const status = ing.current_quantity <= 0 ? 'OUT OF STOCK' : (ing.minimum_quantity > 0 && ing.current_quantity <= ing.minimum_quantity) ? 'LOW STOCK' : 'OK';
    const row = invSheet.addRow({ name: ing.name, unit: ing.unit, current_quantity: ing.current_quantity, minimum_quantity: ing.minimum_quantity, unit_cost: ing.unit_cost, stock_value: Math.round(ing.current_quantity * ing.unit_cost), status });
    addBorders(row);
    if (status === 'OUT OF STOCK') row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; });
    else if (status === 'LOW STOCK') row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } }; });
  });

  // ---- Stock Transactions Sheet ----
  const txSheet = workbook.addWorksheet('Stock Transactions');
  txSheet.columns = [
    { header: 'Date/Time', key: 'created_at', width: 22 },
    { header: 'Ingredient', key: 'ingredient_name', width: 22 },
    { header: 'Type', key: 'transaction_type', width: 18 },
    { header: 'Change', key: 'quantity_change', width: 12 },
    { header: 'Notes', key: 'notes', width: 35 },
  ];
  styleHeader(txSheet);

  // Filter today's transactions for settlement
  const dayTxns = transactions.filter((t) => {
    const txDate = new Date(t.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    return txDate === date;
  });

  (dayTxns.length > 0 ? dayTxns : transactions.slice(0, 50)).forEach((tx) => {
    const typeLabel = tx.transaction_type === 'order_deduction' ? 'Order Deduction' : tx.transaction_type === 'manual_add' ? 'Manual Add' : 'Manual Subtract';
    const row = txSheet.addRow({
      created_at: new Date(tx.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      ingredient_name: tx.ingredient_name || `#${tx.ingredient_id}`,
      transaction_type: typeLabel,
      quantity_change: tx.quantity_change,
      notes: tx.notes,
    });
    addBorders(row);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generateInventoryExcel(): Promise<Buffer> {
  const ingredients = await getIngredients();
  const transactions = await getInventoryTransactions(undefined, 500);
  const recipes = await getAllRecipes();
  const lowStock = await getLowStockIngredients();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sip n Snacks';

  // ---- Inventory Sheet ----
  const invSheet = workbook.addWorksheet('Inventory');
  invSheet.columns = [
    { header: 'Ingredient', key: 'name', width: 25 },
    { header: 'Unit', key: 'unit', width: 12 },
    { header: 'Current Stock', key: 'current_quantity', width: 15 },
    { header: 'Min Level', key: 'minimum_quantity', width: 12 },
    { header: 'Unit Cost (₹)', key: 'unit_cost', width: 14 },
    { header: 'Stock Value (₹)', key: 'stock_value', width: 15 },
    { header: 'Status', key: 'status', width: 14 },
  ];
  styleHeader(invSheet);
  ingredients.forEach((ing) => {
    const status = ing.current_quantity <= 0 ? 'OUT OF STOCK' : (ing.minimum_quantity > 0 && ing.current_quantity <= ing.minimum_quantity) ? 'LOW STOCK' : 'OK';
    const row = invSheet.addRow({ name: ing.name, unit: ing.unit, current_quantity: ing.current_quantity, minimum_quantity: ing.minimum_quantity, unit_cost: ing.unit_cost, stock_value: Math.round(ing.current_quantity * ing.unit_cost), status });
    addBorders(row);
  });

  // ---- Recipes Sheet ----
  const recSheet = workbook.addWorksheet('Recipes');
  recSheet.columns = [
    { header: 'Menu Item', key: 'menu_item_name', width: 25 },
    { header: 'Ingredient', key: 'ingredient_name', width: 22 },
    { header: 'Qty Required', key: 'quantity_required', width: 15 },
    { header: 'Unit', key: 'ingredient_unit', width: 12 },
  ];
  styleHeader(recSheet);
  recipes.forEach((r) => { const row = recSheet.addRow(r); addBorders(row); });

  // ---- Transactions Sheet ----
  const txSheet = workbook.addWorksheet('Transactions');
  txSheet.columns = [
    { header: 'Date/Time', key: 'created_at', width: 22 },
    { header: 'Ingredient', key: 'ingredient_name', width: 22 },
    { header: 'Type', key: 'transaction_type', width: 18 },
    { header: 'Change', key: 'quantity_change', width: 12 },
    { header: 'Notes', key: 'notes', width: 35 },
  ];
  styleHeader(txSheet);
  transactions.forEach((tx) => {
    const row = txSheet.addRow({ ...tx, created_at: new Date(tx.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) });
    addBorders(row);
  });

  // ---- Low Stock Sheet ----
  if (lowStock.length > 0) {
    const lsSheet = workbook.addWorksheet('Low Stock Alerts');
    lsSheet.columns = [
      { header: 'Ingredient', key: 'name', width: 25 },
      { header: 'Current Stock', key: 'current_quantity', width: 15 },
      { header: 'Min Level', key: 'minimum_quantity', width: 12 },
      { header: 'Unit', key: 'unit', width: 12 },
      { header: 'Shortage', key: 'shortage', width: 12 },
    ];
    styleHeader(lsSheet);
    lowStock.forEach((ing) => {
      const row = lsSheet.addRow({ ...ing, shortage: ing.minimum_quantity - ing.current_quantity });
      addBorders(row);
      row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } }; });
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function getExcelFilename(date: string): string {
  return `sipnsnacks_report_${date}.xlsx`;
}
