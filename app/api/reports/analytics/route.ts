import { NextResponse } from 'next/server';
import { getAuthFromHeaders } from '@/lib/auth';
import { queryOne, queryAll } from '@/lib/pg-client';

// GET /api/reports/analytics?days=30 OR ?from=2026-01-01&to=2026-01-31
export async function GET(request: Request) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days');
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');

    // Build reusable WHERE snippets
    const isCustomRange = !!(fromDate && toDate);
    
    // For queries on orders table directly
    const oWhere = isCustomRange
      ? `(created_at AT TIME ZONE 'Asia/Kolkata')::date >= '${fromDate}' AND (created_at AT TIME ZONE 'Asia/Kolkata')::date <= '${toDate}'`
      : `created_at >= NOW() - INTERVAL '${parseInt(daysParam || '30')} days'`;

    // For queries with orders aliased as 'o'
    const oAliasWhere = isCustomRange
      ? `(o.created_at AT TIME ZONE 'Asia/Kolkata')::date >= '${fromDate}' AND (o.created_at AT TIME ZONE 'Asia/Kolkata')::date <= '${toDate}'`
      : `o.created_at >= NOW() - INTERVAL '${parseInt(daysParam || '30')} days'`;

    const periodLabel = isCustomRange ? `${fromDate} to ${toDate}` : `Last ${parseInt(daysParam || '30')} days`;
    const periodDays = isCustomRange
      ? Math.ceil((new Date(toDate!).getTime() - new Date(fromDate!).getTime()) / 86400000) + 1
      : parseInt(daysParam || '30');

    // 1. Revenue Trend
    const revenueTrend = await queryAll<any>(
      `SELECT (created_at AT TIME ZONE 'Asia/Kolkata')::date as date,
              COUNT(DISTINCT id) as orders, COALESCE(SUM(total_amount), 0) as revenue
       FROM orders WHERE ${oWhere} GROUP BY date ORDER BY date`
    );

    // 2. Top Selling Items
    const topItems = await queryAll<any>(
      `SELECT oi.item_name, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total_revenue,
              COUNT(DISTINCT oi.order_id) as order_count
       FROM order_items oi JOIN orders o ON oi.order_id = o.id
       WHERE ${oAliasWhere} GROUP BY oi.item_name ORDER BY total_qty DESC LIMIT 15`
    );

    // 3. Category Performance
    const categoryPerf = await queryAll<any>(
      `SELECT m.category, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total_revenue,
              COUNT(DISTINCT oi.order_id) as order_count
       FROM order_items oi JOIN orders o ON oi.order_id = o.id JOIN menu_items m ON oi.menu_item_id = m.id
       WHERE ${oAliasWhere} GROUP BY m.category ORDER BY total_revenue DESC`
    );

    // 4. Peak Hours
    const peakHours = await queryAll<any>(
      `SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata') as hour,
              COUNT(*) as order_count, SUM(total_amount) as revenue, AVG(total_amount) as avg_order_value
       FROM orders WHERE ${oWhere} GROUP BY hour ORDER BY hour`
    );

    // 5. Day of Week
    const dayOfWeek = await queryAll<any>(
      `SELECT EXTRACT(DOW FROM created_at AT TIME ZONE 'Asia/Kolkata') as dow,
              TO_CHAR(created_at AT TIME ZONE 'Asia/Kolkata', 'Day') as day_name,
              COUNT(*) as order_count, SUM(total_amount) as revenue, AVG(total_amount) as avg_order_value
       FROM orders WHERE ${oWhere} GROUP BY dow, day_name ORDER BY dow`
    );

    // 6. Overall KPIs
    const overallKpi = await queryOne<any>(
      `SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount), 0) as total_revenue,
              COALESCE(AVG(total_amount), 0) as avg_order_value,
              COALESCE(MAX(total_amount), 0) as max_order_value,
              COALESCE(MIN(total_amount), 0) as min_order_value
       FROM orders WHERE ${oWhere}`
    );

    const totalItems = await queryOne<any>(
      `SELECT COALESCE(SUM(oi.quantity), 0) as total_items
       FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE ${oAliasWhere}`
    );

    // 7. Avg items per order
    const avgItemsPerOrder = await queryOne<any>(
      `SELECT AVG(item_count) as avg_items FROM (
         SELECT o.id, SUM(oi.quantity) as item_count
         FROM orders o JOIN order_items oi ON oi.order_id = o.id
         WHERE ${oAliasWhere} GROUP BY o.id
       ) sub`
    );

    // 8. Source breakdown
    const sourceBreakdown = await queryAll<any>(
      `SELECT source, COUNT(*) as order_count, SUM(total_amount) as revenue
       FROM orders WHERE ${oWhere} GROUP BY source`
    );

    // 9. Frequently bought together
    const itemPairs = await queryAll<any>(
      `SELECT a.item_name as item1, b.item_name as item2, COUNT(*) as pair_count
       FROM order_items a JOIN order_items b ON a.order_id = b.order_id AND a.item_name < b.item_name
       JOIN orders o ON a.order_id = o.id
       WHERE ${oAliasWhere}
       GROUP BY a.item_name, b.item_name HAVING COUNT(*) >= 2
       ORDER BY pair_count DESC LIMIT 10`
    );

    // 10. Inventory Health (not date-dependent)
    const inventoryHealth = await queryAll<any>(
      `SELECT name, unit, current_quantity, minimum_quantity, unit_cost,
              current_quantity * unit_cost as stock_value,
              CASE WHEN current_quantity <= 0 THEN 'out_of_stock'
                   WHEN minimum_quantity > 0 AND current_quantity <= minimum_quantity THEN 'low_stock'
                   ELSE 'healthy' END as status
       FROM ingredients ORDER BY status, name`
    );

    // 11. Slow movers
    const slowMovers = await queryAll<any>(
      `SELECT m.name, m.category, m.price,
              COALESCE(sub.total_qty, 0) as total_qty, COALESCE(sub.total_revenue, 0) as total_revenue
       FROM menu_items m LEFT JOIN (
         SELECT oi.menu_item_id, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total_revenue
         FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE ${oAliasWhere} GROUP BY oi.menu_item_id
       ) sub ON m.id = sub.menu_item_id
       WHERE m.available = true ORDER BY total_qty ASC LIMIT 10`
    );

    // 12. Active days
    const activeDays = await queryOne<any>(
      `SELECT COUNT(DISTINCT (created_at AT TIME ZONE 'Asia/Kolkata')::date) as active_days
       FROM orders WHERE ${oWhere}`
    );

    const ad = parseInt(activeDays?.active_days || '0');
    const tr = parseFloat(overallKpi?.total_revenue || '0');
    const to2 = parseInt(overallKpi?.total_orders || '0');

    return NextResponse.json({
      period_days: periodDays,
      period_label: periodLabel,
      kpis: {
        total_orders: to2,
        total_revenue: tr,
        avg_order_value: parseFloat(overallKpi?.avg_order_value || '0'),
        max_order_value: parseFloat(overallKpi?.max_order_value || '0'),
        min_order_value: parseFloat(overallKpi?.min_order_value || '0'),
        total_items_sold: parseInt(totalItems?.total_items || '0'),
        avg_items_per_order: parseFloat(avgItemsPerOrder?.avg_items || '0'),
        active_days: ad,
        revenue_per_day: ad > 0 ? tr / ad : 0,
        orders_per_day: ad > 0 ? to2 / ad : 0,
      },
      revenue_trend: revenueTrend.map((r: any) => ({ date: r.date, orders: parseInt(r.orders), revenue: parseFloat(r.revenue) })),
      top_items: topItems.map((r: any) => ({ item_name: r.item_name, total_qty: parseInt(r.total_qty), total_revenue: parseFloat(r.total_revenue), order_count: parseInt(r.order_count) })),
      category_performance: categoryPerf.map((r: any) => ({ category: r.category, total_qty: parseInt(r.total_qty), total_revenue: parseFloat(r.total_revenue), order_count: parseInt(r.order_count) })),
      peak_hours: peakHours.map((r: any) => ({ hour: parseInt(r.hour), order_count: parseInt(r.order_count), revenue: parseFloat(r.revenue), avg_order_value: parseFloat(r.avg_order_value) })),
      day_of_week: dayOfWeek.map((r: any) => ({ dow: parseInt(r.dow), day_name: r.day_name.trim(), order_count: parseInt(r.order_count), revenue: parseFloat(r.revenue), avg_order_value: parseFloat(r.avg_order_value) })),
      source_breakdown: sourceBreakdown.map((r: any) => ({ source: r.source, order_count: parseInt(r.order_count), revenue: parseFloat(r.revenue) })),
      frequently_bought_together: itemPairs.map((r: any) => ({ item1: r.item1, item2: r.item2, pair_count: parseInt(r.pair_count) })),
      inventory_health: inventoryHealth.map((r: any) => ({ name: r.name, unit: r.unit, current_quantity: parseFloat(r.current_quantity), minimum_quantity: parseFloat(r.minimum_quantity), unit_cost: parseFloat(r.unit_cost), stock_value: parseFloat(r.stock_value), status: r.status })),
      slow_movers: slowMovers.map((r: any) => ({ name: r.name, category: r.category, price: parseFloat(r.price), total_qty: parseInt(r.total_qty), total_revenue: parseFloat(r.total_revenue) })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Analytics error:', msg);
    return NextResponse.json({ error: 'Failed to fetch analytics', detail: msg }, { status: 500 });
  }
}
