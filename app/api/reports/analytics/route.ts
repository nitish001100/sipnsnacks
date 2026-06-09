import { NextResponse } from 'next/server';
import { getAuthFromHeaders } from '@/lib/auth';
import { query, queryOne, queryAll } from '@/lib/pg-client';

// GET /api/reports/analytics?days=30 — Deep business analytics
export async function GET(request: Request) {
  try {
    const auth = getAuthFromHeaders(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    // 1. Revenue Trend (daily for last N days)
    const revenueTrend = await queryAll<any>(
      `SELECT (created_at AT TIME ZONE 'Asia/Kolkata')::date as date,
              COUNT(DISTINCT id) as orders, 
              COALESCE(SUM(total_amount), 0) as revenue
       FROM orders 
       WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY date ORDER BY date`, [days]
    );

    // 2. Top Selling Items (by quantity)
    const topItems = await queryAll<any>(
      `SELECT oi.item_name, 
              SUM(oi.quantity) as total_qty, 
              SUM(oi.subtotal) as total_revenue,
              COUNT(DISTINCT oi.order_id) as order_count
       FROM order_items oi JOIN orders o ON oi.order_id = o.id
       WHERE o.created_at >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY oi.item_name ORDER BY total_qty DESC LIMIT 15`, [days]
    );

    // 3. Category Performance
    const categoryPerf = await queryAll<any>(
      `SELECT m.category, 
              SUM(oi.quantity) as total_qty,
              SUM(oi.subtotal) as total_revenue,
              COUNT(DISTINCT oi.order_id) as order_count
       FROM order_items oi 
       JOIN orders o ON oi.order_id = o.id
       JOIN menu_items m ON oi.menu_item_id = m.id
       WHERE o.created_at >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY m.category ORDER BY total_revenue DESC`, [days]
    );

    // 4. Peak Hours
    const peakHours = await queryAll<any>(
      `SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata') as hour,
              COUNT(*) as order_count, 
              SUM(total_amount) as revenue,
              AVG(total_amount) as avg_order_value
       FROM orders 
       WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY hour ORDER BY hour`, [days]
    );

    // 5. Day of Week Performance
    const dayOfWeek = await queryAll<any>(
      `SELECT EXTRACT(DOW FROM created_at AT TIME ZONE 'Asia/Kolkata') as dow,
              TO_CHAR(created_at AT TIME ZONE 'Asia/Kolkata', 'Day') as day_name,
              COUNT(*) as order_count,
              SUM(total_amount) as revenue,
              AVG(total_amount) as avg_order_value
       FROM orders
       WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY dow, day_name ORDER BY dow`, [days]
    );

    // 6. Overall KPIs
    const overallKpi = await queryOne<any>(
      `SELECT COUNT(*) as total_orders,
              COALESCE(SUM(total_amount), 0) as total_revenue,
              COALESCE(AVG(total_amount), 0) as avg_order_value,
              COALESCE(MAX(total_amount), 0) as max_order_value,
              COALESCE(MIN(total_amount), 0) as min_order_value
       FROM orders
       WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL`, [days]
    );

    const totalItems = await queryOne<any>(
      `SELECT COALESCE(SUM(oi.quantity), 0) as total_items
       FROM order_items oi JOIN orders o ON oi.order_id = o.id
       WHERE o.created_at >= NOW() - ($1 || ' days')::INTERVAL`, [days]
    );

    // 7. Average items per order
    const avgItemsPerOrder = await queryOne<any>(
      `SELECT AVG(item_count) as avg_items FROM (
         SELECT o.id, SUM(oi.quantity) as item_count
         FROM orders o JOIN order_items oi ON oi.order_id = o.id
         WHERE o.created_at >= NOW() - ($1 || ' days')::INTERVAL
         GROUP BY o.id
       ) sub`, [days]
    );

    // 8. Order Source breakdown (online vs offline)
    const sourceBreakdown = await queryAll<any>(
      `SELECT source, COUNT(*) as order_count, SUM(total_amount) as revenue
       FROM orders
       WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY source`, [days]
    );

    // 9. Repeat items — items that appear together often
    const itemPairs = await queryAll<any>(
      `SELECT a.item_name as item1, b.item_name as item2, COUNT(*) as pair_count
       FROM order_items a 
       JOIN order_items b ON a.order_id = b.order_id AND a.item_name < b.item_name
       JOIN orders o ON a.order_id = o.id
       WHERE o.created_at >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY a.item_name, b.item_name
       HAVING COUNT(*) >= 2
       ORDER BY pair_count DESC LIMIT 10`, [days]
    );

    // 10. Inventory Health
    const inventoryHealth = await queryAll<any>(
      `SELECT name, unit, current_quantity, minimum_quantity, unit_cost,
              current_quantity * unit_cost as stock_value,
              CASE 
                WHEN current_quantity <= 0 THEN 'out_of_stock'
                WHEN minimum_quantity > 0 AND current_quantity <= minimum_quantity THEN 'low_stock'
                ELSE 'healthy'
              END as status
       FROM ingredients ORDER BY status, name`
    );

    // 11. Slow-moving items (in menu but rarely ordered)
    const slowMovers = await queryAll<any>(
      `SELECT m.name, m.category, m.price,
              COALESCE(sub.total_qty, 0) as total_qty,
              COALESCE(sub.total_revenue, 0) as total_revenue
       FROM menu_items m
       LEFT JOIN (
         SELECT oi.menu_item_id, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total_revenue
         FROM order_items oi JOIN orders o ON oi.order_id = o.id
         WHERE o.created_at >= NOW() - ($1 || ' days')::INTERVAL
         GROUP BY oi.menu_item_id
       ) sub ON m.id = sub.menu_item_id
       WHERE m.available = true
       ORDER BY total_qty ASC LIMIT 10`, [days]
    );

    // 12. Revenue per day average
    const activeDays = await queryOne<any>(
      `SELECT COUNT(DISTINCT (created_at AT TIME ZONE 'Asia/Kolkata')::date) as active_days
       FROM orders WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL`, [days]
    );

    const kpis = {
      total_orders: parseInt(overallKpi?.total_orders || '0'),
      total_revenue: parseFloat(overallKpi?.total_revenue || '0'),
      avg_order_value: parseFloat(overallKpi?.avg_order_value || '0'),
      max_order_value: parseFloat(overallKpi?.max_order_value || '0'),
      min_order_value: parseFloat(overallKpi?.min_order_value || '0'),
      total_items_sold: parseInt(totalItems?.total_items || '0'),
      avg_items_per_order: parseFloat(avgItemsPerOrder?.avg_items || '0'),
      active_days: parseInt(activeDays?.active_days || '0'),
      revenue_per_day: parseInt(activeDays?.active_days || '0') > 0
        ? parseFloat(overallKpi?.total_revenue || '0') / parseInt(activeDays?.active_days || '1')
        : 0,
      orders_per_day: parseInt(activeDays?.active_days || '0') > 0
        ? parseInt(overallKpi?.total_orders || '0') / parseInt(activeDays?.active_days || '1')
        : 0,
    };

    return NextResponse.json({
      period_days: days,
      kpis,
      revenue_trend: revenueTrend.map(r => ({
        date: r.date,
        orders: parseInt(r.orders),
        revenue: parseFloat(r.revenue),
      })),
      top_items: topItems.map(r => ({
        item_name: r.item_name,
        total_qty: parseInt(r.total_qty),
        total_revenue: parseFloat(r.total_revenue),
        order_count: parseInt(r.order_count),
      })),
      category_performance: categoryPerf.map(r => ({
        category: r.category,
        total_qty: parseInt(r.total_qty),
        total_revenue: parseFloat(r.total_revenue),
        order_count: parseInt(r.order_count),
      })),
      peak_hours: peakHours.map(r => ({
        hour: parseInt(r.hour),
        order_count: parseInt(r.order_count),
        revenue: parseFloat(r.revenue),
        avg_order_value: parseFloat(r.avg_order_value),
      })),
      day_of_week: dayOfWeek.map(r => ({
        dow: parseInt(r.dow),
        day_name: r.day_name.trim(),
        order_count: parseInt(r.order_count),
        revenue: parseFloat(r.revenue),
        avg_order_value: parseFloat(r.avg_order_value),
      })),
      source_breakdown: sourceBreakdown.map(r => ({
        source: r.source,
        order_count: parseInt(r.order_count),
        revenue: parseFloat(r.revenue),
      })),
      frequently_bought_together: itemPairs.map(r => ({
        item1: r.item1,
        item2: r.item2,
        pair_count: parseInt(r.pair_count),
      })),
      inventory_health: inventoryHealth.map(r => ({
        name: r.name,
        unit: r.unit,
        current_quantity: parseFloat(r.current_quantity),
        minimum_quantity: parseFloat(r.minimum_quantity),
        unit_cost: parseFloat(r.unit_cost),
        stock_value: parseFloat(r.stock_value),
        status: r.status,
      })),
      slow_movers: slowMovers.map(r => ({
        name: r.name,
        category: r.category,
        price: parseFloat(r.price),
        total_qty: parseInt(r.total_qty),
        total_revenue: parseFloat(r.total_revenue),
      })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Analytics error:', msg);
    return NextResponse.json({ error: 'Failed to fetch analytics', detail: msg }, { status: 500 });
  }
}
