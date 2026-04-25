import ExcelJS from 'exceljs';
import { getOrdersForDate, getDailySummary, OrderWithItems } from './db';

export async function generateDailyExcel(date: string): Promise<Buffer> {
  const orders = await getOrdersForDate(date);
  const summary = await getDailySummary(date);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sip n Snacks';
  workbook.created = new Date();

  // ---- Orders Sheet ----
  const ordersSheet = workbook.addWorksheet('Orders');

  // Header styling
  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2E3C' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    },
  };

  // Define columns
  ordersSheet.columns = [
    { header: 'Order ID', key: 'order_number', width: 22 },
    { header: 'Items', key: 'items', width: 40 },
    { header: 'Quantity', key: 'quantity', width: 12 },
    { header: 'Total Amount (₹)', key: 'total_amount', width: 18 },
    { header: 'Timestamp', key: 'timestamp', width: 22 },
  ];

  // Style header row
  ordersSheet.getRow(1).eachCell((cell) => {
    Object.assign(cell, { style: headerStyle });
  });
  ordersSheet.getRow(1).height = 30;

  // Add data rows
  orders.forEach((order: OrderWithItems) => {
    const itemNames = order.items.map((i) => `${i.item_name} x${i.quantity}`).join(', ');
    const totalQty = order.items.reduce((sum, i) => sum + i.quantity, 0);
    const timestamp = new Date(order.created_at).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
    });

    const row = ordersSheet.addRow({
      order_number: order.order_number,
      items: itemNames,
      quantity: totalQty,
      total_amount: order.total_amount,
      timestamp: timestamp,
    });

    // Alternate row coloring
    if (row.number % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF8E7' },
        };
      });
    }

    // Border all cells
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  });

  // ---- Summary Sheet ----
  const summarySheet = workbook.addWorksheet('Summary');

  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 25 },
    { header: 'Value', key: 'value', width: 25 },
  ];

  summarySheet.getRow(1).eachCell((cell) => {
    Object.assign(cell, { style: headerStyle });
  });
  summarySheet.getRow(1).height = 30;

  const summaryData = [
    { metric: 'Date', value: date },
    { metric: 'Total Orders', value: summary.total_orders },
    { metric: 'Total Revenue (₹)', value: summary.total_revenue },
    { metric: 'Items Sold', value: summary.items_sold },
  ];

  summaryData.forEach((row) => {
    const addedRow = summarySheet.addRow(row);
    addedRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function getExcelFilename(date: string): string {
  return `sipnsnacks_orders_${date}.xlsx`;
}
