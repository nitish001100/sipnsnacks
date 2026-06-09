'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import {
  Download,
  Loader2,
  Calendar,
  IndianRupee,
  ShoppingBag,
  Package,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  TrendingUp,
  BarChart3,
  Clock,
  Star,
  AlertTriangle,
  Zap,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Layers,
  ShoppingCart,
  Flame,
  Snowflake,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, subDays, addDays } from 'date-fns';
import { useHideMoney } from '@/hooks/useHideMoney';
import HideMoneyToggle from '@/components/HideMoneyToggle';
import dynamic from 'next/dynamic';

// Dynamically import Recharts to avoid SSR issues
const AreaChart = dynamic(() => import('recharts').then(m => m.AreaChart), { ssr: false });
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false });
const Area = dynamic(() => import('recharts').then(m => m.Area), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const Legend = dynamic(() => import('recharts').then(m => m.Legend), { ssr: false });

const COLORS = ['#f59e0b', '#10b981', '#6366f1', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#84cc16'];

interface DailySummary {
  date: string;
  total_orders: number;
  total_revenue: number;
  items_sold: number;
}

interface Order {
  id: number;
  order_number: string;
  total_amount: number;
  created_at: string;
  items: Array<{ item_name: string; quantity: number; price: number; subtotal: number }>;
}

interface Analytics {
  period_days: number;
  kpis: {
    total_orders: number; total_revenue: number; avg_order_value: number;
    max_order_value: number; min_order_value: number; total_items_sold: number;
    avg_items_per_order: number; active_days: number; revenue_per_day: number; orders_per_day: number;
  };
  revenue_trend: Array<{ date: string; orders: number; revenue: number }>;
  top_items: Array<{ item_name: string; total_qty: number; total_revenue: number; order_count: number }>;
  category_performance: Array<{ category: string; total_qty: number; total_revenue: number; order_count: number }>;
  peak_hours: Array<{ hour: number; order_count: number; revenue: number; avg_order_value: number }>;
  day_of_week: Array<{ dow: number; day_name: string; order_count: number; revenue: number; avg_order_value: number }>;
  source_breakdown: Array<{ source: string; order_count: number; revenue: number }>;
  frequently_bought_together: Array<{ item1: string; item2: string; pair_count: number }>;
  inventory_health: Array<{ name: string; unit: string; current_quantity: number; minimum_quantity: number; unit_cost: number; stock_value: number; status: string }>;
  slow_movers: Array<{ name: string; category: string; price: number; total_qty: number; total_revenue: number }>;
}

export default function ReportsPage() {
  const [tab, setTab] = useState<'daily' | 'analytics'>('analytics');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [earningsUnlocked, setEarningsUnlocked] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const { hidden: moneyHidden, show: moneyShow, hide: moneyHide, mask, isChef } = useHideMoney();

  // Analytics state
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsDays, setAnalyticsDays] = useState<number | null>(null); // null = custom range
  const [analyticsFrom, setAnalyticsFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [analyticsTo, setAnalyticsTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('today');

  useEffect(() => {
    if (tab === 'daily') fetchData();
  }, [date, tab]);

  useEffect(() => {
    if (tab === 'analytics') fetchAnalytics();
  }, [analyticsDays, analyticsFrom, analyticsTo, selectedPreset, tab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [summaryRes, ordersRes] = await Promise.all([
        fetch(`/api/reports/daily?date=${date}`),
        fetch(`/api/orders?date=${date}&limit=100`),
      ]);
      const summaryData = await summaryRes.json();
      const ordersData = await ordersRes.json();
      setSummary(summaryData.summary);
      setOrders(ordersData.orders || []);
    } catch {
      toast.error('Failed to fetch report data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      let url: string;
      if (selectedPreset === 'custom') {
        url = `/api/reports/analytics?from=${analyticsFrom}&to=${analyticsTo}`;
      } else if (selectedPreset === 'today') {
        const today = format(new Date(), 'yyyy-MM-dd');
        url = `/api/reports/analytics?from=${today}&to=${today}`;
      } else if (selectedPreset === 'yesterday') {
        const y = format(subDays(new Date(), 1), 'yyyy-MM-dd');
        url = `/api/reports/analytics?from=${y}&to=${y}`;
      } else {
        url = `/api/reports/analytics?days=${analyticsDays}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) setAnalytics(data);
      else toast.error(data.error || 'Failed to fetch analytics');
    } catch {
      toast.error('Failed to fetch analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const selectPreset = (preset: string, days?: number) => {
    setSelectedPreset(preset);
    setShowCustomRange(preset === 'custom');
    if (days) setAnalyticsDays(days);
    else setAnalyticsDays(null);
  };

  const applyCustomRange = () => {
    if (analyticsFrom && analyticsTo) {
      setSelectedPreset('custom');
      // Trigger refetch
      fetchAnalytics();
    }
  };

  const handleExport = () => {
    window.open(`/api/reports/export?date=${date}`, '_blank');
    toast.success('Downloading Excel report...');
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const current = new Date(date);
    const newDate = direction === 'prev' ? subDays(current, 1) : addDays(current, 1);
    if (newDate <= new Date()) setDate(format(newDate, 'yyyy-MM-dd'));
  };

  const unlockEarnings = async () => {
    if (!password) return;
    setVerifying(true);
    try {
      const res = await fetch('/api/settings/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) {
        setEarningsUnlocked(true);
        setPasswordModal(false);
        setPassword('');
        toast.success('Revenue data unlocked!');
      } else {
        toast.error(data.error || 'Invalid password');
      }
    } catch {
      toast.error('Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const fmtHour = (h: number) => {
    if (h === 0) return '12 AM';
    if (h < 12) return `${h} AM`;
    if (h === 12) return '12 PM';
    return `${h - 12} PM`;
  };

  return (
    <div className="flex min-h-screen">
      <Navbar />
      <main className="flex-1 md:ml-64 p-6 pt-16 md:pt-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
            <p className="text-gray-500 mt-1">Business insights to grow your revenue</p>
          </div>
          <div className="flex gap-3 mt-4 sm:mt-0">
            <HideMoneyToggle hidden={moneyHidden} show={moneyShow} hide={moneyHide} isChef={isChef} />
            {tab === 'daily' && (
              <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm">
                <Download className="w-4 h-4" /> Export Excel
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setTab('analytics')}
            className={`px-4 py-2.5 font-medium text-sm border-b-2 transition-colors ${
              tab === 'analytics' ? 'border-amber-500 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-1.5" /> Analytics
          </button>
          <button
            onClick={() => setTab('daily')}
            className={`px-4 py-2.5 font-medium text-sm border-b-2 transition-colors ${
              tab === 'daily' ? 'border-amber-500 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Calendar className="w-4 h-4 inline mr-1.5" /> Daily Report
          </button>
        </div>

        {/* ==================== ANALYTICS TAB ==================== */}
        {tab === 'analytics' && (
          <>
            {/* Period Selector */}
            <div className="card mb-6 p-4">
              <div className="flex flex-wrap gap-2 items-center">
                {/* Today */}
                <button
                  onClick={() => selectPreset('today')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedPreset === 'today' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Today
                </button>
                {/* Yesterday */}
                <button
                  onClick={() => {
                    const y = format(subDays(new Date(), 1), 'yyyy-MM-dd');
                    setAnalyticsFrom(y);
                    setAnalyticsTo(y);
                    selectPreset('yesterday');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedPreset === 'yesterday' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Yesterday
                </button>
                {/* Preset days */}
                {[7, 14, 30, 60, 90].map(d => (
                  <button
                    key={d}
                    onClick={() => selectPreset(`${d}d`, d)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedPreset === `${d}d` ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
                {/* Custom */}
                <button
                  onClick={() => { setShowCustomRange(!showCustomRange); selectPreset('custom'); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                    selectedPreset === 'custom' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" /> Custom
                </button>
              </div>
              {/* Custom Date Range */}
              {showCustomRange && (
                <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">From</label>
                    <input
                      type="date" value={analyticsFrom}
                      onChange={(e) => setAnalyticsFrom(e.target.value)}
                      max={analyticsTo}
                      className="input w-auto text-sm py-1.5"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">To</label>
                    <input
                      type="date" value={analyticsTo}
                      onChange={(e) => setAnalyticsTo(e.target.value)}
                      min={analyticsFrom}
                      max={format(new Date(), 'yyyy-MM-dd')}
                      className="input w-auto text-sm py-1.5"
                    />
                  </div>
                  <button
                    onClick={applyCustomRange}
                    className="btn-primary text-sm py-1.5 px-4"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>

            {analyticsLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              </div>
            ) : analytics ? (
              <div className="space-y-6">
                {/* KPI Cards Row 1 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  <KpiCard
                    icon={<IndianRupee className="w-5 h-5" />}
                    label="Total Revenue"
                    value={earningsUnlocked ? mask(analytics.kpis.total_revenue) : null}
                    locked={!earningsUnlocked}
                    onUnlock={() => setPasswordModal(true)}
                    color="green"
                  />
                  <KpiCard
                    icon={<ShoppingBag className="w-5 h-5" />}
                    label="Total Orders"
                    value={analytics.kpis.total_orders.toString()}
                    color="amber"
                  />
                  <KpiCard
                    icon={<Target className="w-5 h-5" />}
                    label="Avg Order Value"
                    value={earningsUnlocked ? mask(analytics.kpis.avg_order_value) : null}
                    locked={!earningsUnlocked}
                    onUnlock={() => setPasswordModal(true)}
                    color="indigo"
                  />
                  <KpiCard
                    icon={<Package className="w-5 h-5" />}
                    label="Items Sold"
                    value={analytics.kpis.total_items_sold.toString()}
                    color="purple"
                  />
                  <KpiCard
                    icon={<TrendingUp className="w-5 h-5" />}
                    label="Revenue/Day"
                    value={earningsUnlocked ? mask(analytics.kpis.revenue_per_day) : null}
                    locked={!earningsUnlocked}
                    onUnlock={() => setPasswordModal(true)}
                    color="cyan"
                  />
                </div>

                {/* KPI Cards Row 2 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <KpiCard
                    icon={<ShoppingCart className="w-5 h-5" />}
                    label="Orders/Day"
                    value={analytics.kpis.orders_per_day.toFixed(1)}
                    color="orange"
                  />
                  <KpiCard
                    icon={<Layers className="w-5 h-5" />}
                    label="Avg Items/Order"
                    value={analytics.kpis.avg_items_per_order.toFixed(1)}
                    color="rose"
                  />
                  <KpiCard
                    icon={<ArrowUpRight className="w-5 h-5" />}
                    label="Highest Order"
                    value={earningsUnlocked ? mask(analytics.kpis.max_order_value) : null}
                    locked={!earningsUnlocked}
                    onUnlock={() => setPasswordModal(true)}
                    color="emerald"
                  />
                  <KpiCard
                    icon={<Calendar className="w-5 h-5" />}
                    label="Active Days"
                    value={`${analytics.kpis.active_days} / ${analytics.period_days}`}
                    color="blue"
                  />
                </div>

                {/* Revenue Trend Chart */}
                {analytics.revenue_trend.length > 0 && (
                  <div className="card">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-600" /> Revenue Trend
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analytics.revenue_trend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => {
                            const d = new Date(v);
                            return `${d.getDate()}/${d.getMonth() + 1}`;
                          }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => earningsUnlocked ? `₹${v}` : '🔒'} />
                          <Tooltip formatter={((v: any, n: any) => [earningsUnlocked ? fmt(v) : '🔒', n === 'revenue' ? 'Revenue' : 'Orders']) as any} />
                          <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#d1fae5" strokeWidth={2} />
                          <Area type="monotone" dataKey="orders" stroke="#f59e0b" fill="#fef3c7" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Top Sellers + Category Performance */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Top Selling Items */}
                  <div className="card">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Flame className="w-5 h-5 text-orange-500" /> Top Selling Items
                    </h3>
                    {analytics.top_items.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-8">No data yet</p>
                    ) : (
                      <div className="space-y-3">
                        {analytics.top_items.slice(0, 10).map((item, i) => {
                          const maxQty = analytics.top_items[0]?.total_qty || 1;
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                i < 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {i + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium truncate">{item.item_name}</span>
                                  <span className="text-sm font-bold text-gray-700 ml-2">{item.total_qty}</span>
                                </div>
                                <div className="mt-1 bg-gray-100 rounded-full h-2">
                                  <div
                                    className="bg-gradient-to-r from-amber-400 to-orange-500 h-2 rounded-full transition-all"
                                    style={{ width: `${(item.total_qty / maxQty) * 100}%` }}
                                  />
                                </div>
                                <div className="flex justify-between mt-0.5">
                                  <span className="text-xs text-gray-400">{item.order_count} orders</span>
                                  <span className="text-xs text-green-600 font-medium">
                                    {earningsUnlocked ? mask(item.total_revenue) : '🔒'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Category Performance */}
                  <div className="card">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-indigo-500" /> Category Performance
                    </h3>
                    {analytics.category_performance.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-8">No data yet</p>
                    ) : (
                      <>
                        <div className="h-48 mb-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={analytics.category_performance}
                                dataKey="total_revenue"
                                nameKey="category"
                                cx="50%" cy="50%"
                                outerRadius={80}
                                label={({ category, percent }: any) => `${category} ${(percent * 100).toFixed(0)}%`}
                                labelLine={false}
                              >
                                {analytics.category_performance.map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={((v: any) => earningsUnlocked ? fmt(v) : '🔒') as any} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-2">
                          {analytics.category_performance.map((cat, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                <span className="font-medium">{cat.category}</span>
                              </div>
                              <div className="flex gap-4 text-gray-500">
                                <span>{cat.total_qty} items</span>
                                <span className="font-medium text-gray-700">
                                  {earningsUnlocked ? mask(cat.total_revenue) : '🔒'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Peak Hours + Day of Week */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Peak Hours */}
                  <div className="card">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-500" /> Peak Hours
                      <span className="text-xs text-gray-400 font-normal ml-1">When to have staff ready</span>
                    </h3>
                    {analytics.peak_hours.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-8">No data yet</p>
                    ) : (
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.peak_hours}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={fmtHour} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip
                              labelFormatter={((v: any) => fmtHour(v)) as any}
                              formatter={((v: any, n: any) => [
                                n === 'order_count' ? `${v} orders` : earningsUnlocked ? fmt(v) : '🔒',
                                n === 'order_count' ? 'Orders' : 'Revenue'
                              ]) as any}
                            />
                            <Bar dataKey="order_count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {analytics.peak_hours.length > 0 && (() => {
                      const peak = analytics.peak_hours.reduce((a, b) => a.order_count > b.order_count ? a : b);
                      return (
                        <p className="text-sm text-center mt-2 text-indigo-600 font-medium">
                          🔥 Busiest hour: {fmtHour(peak.hour)} ({peak.order_count} orders)
                        </p>
                      );
                    })()}
                  </div>

                  {/* Day of Week */}
                  <div className="card">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-purple-500" /> Day of Week
                      <span className="text-xs text-gray-400 font-normal ml-1">Best & worst days</span>
                    </h3>
                    {analytics.day_of_week.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-8">No data yet</p>
                    ) : (
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.day_of_week}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="day_name" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(0, 3)} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip formatter={((v: any, n: any) => [
                              n === 'order_count' ? `${v} orders` : earningsUnlocked ? fmt(v) : '🔒',
                              n === 'order_count' ? 'Orders' : 'Revenue'
                            ]) as any} />
                            <Bar dataKey="order_count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {analytics.day_of_week.length > 0 && (() => {
                      const best = analytics.day_of_week.reduce((a, b) => a.revenue > b.revenue ? a : b);
                      const worst = analytics.day_of_week.reduce((a, b) => a.revenue < b.revenue ? a : b);
                      return (
                        <div className="flex justify-between text-sm mt-2">
                          <span className="text-green-600 font-medium">📈 Best: {best.day_name}</span>
                          <span className="text-red-500 font-medium">📉 Slowest: {worst.day_name}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Order Source + Frequently Bought Together */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Source Breakdown */}
                  <div className="card">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-cyan-500" /> Order Channels
                    </h3>
                    {analytics.source_breakdown.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-8">No data yet</p>
                    ) : (
                      <div className="space-y-3">
                        {analytics.source_breakdown.map((s, i) => {
                          const total = analytics.source_breakdown.reduce((sum, x) => sum + x.order_count, 0);
                          const pct = total > 0 ? ((s.order_count / total) * 100).toFixed(0) : '0';
                          return (
                            <div key={i} className="p-3 bg-gray-50 rounded-xl">
                              <div className="flex justify-between items-center mb-2">
                                <span className="font-medium capitalize flex items-center gap-2">
                                  {s.source === 'online' ? '🌐' : '🏪'} {s.source}
                                </span>
                                <span className="text-sm font-bold">{pct}%</span>
                              </div>
                              <div className="bg-gray-200 rounded-full h-2 mb-1.5">
                                <div
                                  className={`h-2 rounded-full ${s.source === 'online' ? 'bg-cyan-500' : 'bg-amber-500'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-xs text-gray-500">
                                <span>{s.order_count} orders</span>
                                <span>{earningsUnlocked ? mask(s.revenue) : '🔒'}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Frequently Bought Together */}
                  <div className="card">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-yellow-500" /> Frequently Bought Together
                      <span className="text-xs text-gray-400 font-normal ml-1">Combo ideas</span>
                    </h3>
                    {analytics.frequently_bought_together.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-8">Need more orders to detect patterns</p>
                    ) : (
                      <div className="space-y-2">
                        {analytics.frequently_bought_together.map((pair, i) => (
                          <div key={i} className="flex items-center justify-between p-2.5 bg-yellow-50 rounded-lg text-sm">
                            <span>
                              <span className="font-medium">{pair.item1}</span>
                              <span className="mx-2 text-gray-400">+</span>
                              <span className="font-medium">{pair.item2}</span>
                            </span>
                            <span className="bg-yellow-200 text-yellow-800 text-xs font-bold px-2 py-0.5 rounded-full">
                              {pair.pair_count}x
                            </span>
                          </div>
                        ))}
                        <p className="text-xs text-gray-400 mt-2">💡 Consider making these combos at a discounted price!</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Slow Movers + Inventory Health */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Slow Moving Items */}
                  <div className="card">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Snowflake className="w-5 h-5 text-blue-400" /> Slow-Moving Items
                      <span className="text-xs text-gray-400 font-normal ml-1">Consider promotions or removal</span>
                    </h3>
                    {analytics.slow_movers.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-8">No data yet</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="text-left px-3 py-2 font-medium text-gray-600">Item</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-600">Category</th>
                              <th className="text-right px-3 py-2 font-medium text-gray-600">Sold</th>
                              <th className="text-right px-3 py-2 font-medium text-gray-600">Revenue</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analytics.slow_movers.map((item, i) => (
                              <tr key={i} className="border-t border-gray-100">
                                <td className="px-3 py-2 font-medium">{item.name}</td>
                                <td className="px-3 py-2 text-gray-500">{item.category}</td>
                                <td className={`px-3 py-2 text-right font-bold ${item.total_qty === 0 ? 'text-red-500' : 'text-orange-500'}`}>
                                  {item.total_qty === 0 ? '❌ 0' : item.total_qty}
                                </td>
                                <td className="px-3 py-2 text-right text-gray-500">
                                  {earningsUnlocked ? mask(item.total_revenue) : '🔒'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="text-xs text-gray-400 mt-2 px-3">
                          💡 Items with 0 sales in this period should be reconsidered — promote or replace them.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Inventory Health */}
                  <div className="card">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-500" /> Inventory Health
                    </h3>
                    {analytics.inventory_health.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-8">No ingredients added yet</p>
                    ) : (() => {
                      const outOfStock = analytics.inventory_health.filter(i => i.status === 'out_of_stock');
                      const lowStock = analytics.inventory_health.filter(i => i.status === 'low_stock');
                      const healthy = analytics.inventory_health.filter(i => i.status === 'healthy');
                      const totalValue = analytics.inventory_health.reduce((s, i) => s + i.stock_value, 0);
                      return (
                        <>
                          <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="text-center p-3 bg-red-50 rounded-xl">
                              <p className="text-2xl font-bold text-red-600">{outOfStock.length}</p>
                              <p className="text-xs text-red-500">Out of Stock</p>
                            </div>
                            <div className="text-center p-3 bg-yellow-50 rounded-xl">
                              <p className="text-2xl font-bold text-yellow-600">{lowStock.length}</p>
                              <p className="text-xs text-yellow-600">Low Stock</p>
                            </div>
                            <div className="text-center p-3 bg-green-50 rounded-xl">
                              <p className="text-2xl font-bold text-green-600">{healthy.length}</p>
                              <p className="text-xs text-green-600">Healthy</p>
                            </div>
                          </div>
                          <p className="text-sm text-gray-500 mb-3">
                            Total Stock Value: <span className="font-bold text-gray-700">{earningsUnlocked ? mask(totalValue) : '🔒'}</span>
                          </p>
                          {(outOfStock.length > 0 || lowStock.length > 0) && (
                            <div className="space-y-1.5">
                              {[...outOfStock, ...lowStock].map((item, i) => (
                                <div key={i} className={`flex items-center justify-between text-sm px-3 py-1.5 rounded-lg ${
                                  item.status === 'out_of_stock' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
                                }`}>
                                  <span className="font-medium">{item.name}</span>
                                  <span>{item.current_quantity} {item.unit} {item.status === 'out_of_stock' ? '🚨' : '⚠️'}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Business Insights Summary */}
                <div className="card bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500" /> Business Insights
                  </h3>
                  <div className="space-y-2 text-sm text-gray-700">
                    {analytics.kpis.total_orders > 0 && (
                      <>
                        <p>📊 You averaged <strong>{analytics.kpis.orders_per_day.toFixed(1)} orders/day</strong> across {analytics.kpis.active_days} active days.</p>
                        {earningsUnlocked && (
                          <p>💰 Average order value is <strong>{mask(analytics.kpis.avg_order_value)}</strong>. Try upselling combos to increase this.</p>
                        )}
                        {analytics.top_items[0] && (
                          <p>🏆 Your #1 seller is <strong>{analytics.top_items[0].item_name}</strong> ({analytics.top_items[0].total_qty} sold). Make sure you never run out of ingredients for it!</p>
                        )}
                        {analytics.peak_hours.length > 0 && (() => {
                          const peak = analytics.peak_hours.reduce((a, b) => a.order_count > b.order_count ? a : b);
                          return <p>⏰ Peak hour is <strong>{fmtHour(peak.hour)}</strong>. Ensure full staff during this time.</p>;
                        })()}
                        {analytics.slow_movers.filter(s => s.total_qty === 0).length > 0 && (
                          <p>❄️ <strong>{analytics.slow_movers.filter(s => s.total_qty === 0).length} menu items</strong> had zero sales. Consider removing or promoting them.</p>
                        )}
                        {analytics.frequently_bought_together.length > 0 && (
                          <p>🤝 <strong>{analytics.frequently_bought_together[0].item1} + {analytics.frequently_bought_together[0].item2}</strong> are frequently ordered together — create a combo deal!</p>
                        )}
                        {analytics.inventory_health.filter(i => i.status === 'out_of_stock').length > 0 && (
                          <p>🚨 <strong>{analytics.inventory_health.filter(i => i.status === 'out_of_stock').length} ingredients</strong> are out of stock — restock immediately!</p>
                        )}
                      </>
                    )}
                    {analytics.kpis.total_orders === 0 && (
                      <p>No orders yet in this period. Start taking orders to see analytics!</p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}

        {/* ==================== DAILY REPORT TAB ==================== */}
        {tab === 'daily' && (
          <>
            {/* Date Navigation */}
            <div className="card mb-6">
              <div className="flex items-center justify-center gap-4">
                <button onClick={() => navigateDate('prev')} className="p-2 hover:bg-gray-100 rounded-lg">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-500" />
                  <input
                    type="date" value={date}
                    onChange={(e) => setDate(e.target.value)}
                    max={format(new Date(), 'yyyy-MM-dd')}
                    className="input w-auto text-center font-medium"
                  />
                </div>
                <button
                  onClick={() => navigateDate('next')}
                  disabled={date >= format(new Date(), 'yyyy-MM-dd')}
                  className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="card">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-50 p-3 rounded-xl">
                        <IndianRupee className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Revenue</p>
                        {earningsUnlocked ? (
                          <p className="text-xl font-bold text-green-700">{mask(summary?.total_revenue || 0)}</p>
                        ) : (
                          <button onClick={() => setPasswordModal(true)} className="flex items-center gap-1.5 text-gray-400 hover:text-amber-600">
                            <Lock className="w-4 h-4" /><span className="text-sm font-medium">Unlock</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="flex items-center gap-3">
                      <div className="bg-amber-50 p-3 rounded-xl">
                        <ShoppingBag className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Orders</p>
                        <p className="text-xl font-bold text-amber-700">{summary?.total_orders || 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="flex items-center gap-3">
                      <div className="bg-purple-50 p-3 rounded-xl">
                        <Package className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Items Sold</p>
                        <p className="text-xl font-bold text-purple-700">{summary?.items_sold || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Orders Table */}
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Orders ({orders.length})</h2>
                    {earningsUnlocked && (
                      <button onClick={() => setEarningsUnlocked(false)} className="btn-secondary flex items-center gap-2 text-xs">
                        <EyeOff className="w-3 h-3" /> Hide ₹
                      </button>
                    )}
                  </div>
                  {orders.length === 0 ? (
                    <div className="text-center py-8">
                      <Receipt className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                      <p className="text-gray-500">No orders for this date</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Order ID</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Items</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map((order) => (
                            <>
                              <tr
                                key={order.id}
                                className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                                onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                              >
                                <td className="px-4 py-3 font-mono text-xs">{order.order_number}</td>
                                <td className="px-4 py-3">{order.items.map(i => `${i.item_name} x${i.quantity}`).join(', ')}</td>
                                <td className="px-4 py-3 text-right font-medium">
                                  {earningsUnlocked ? mask(order.total_amount) : <span className="text-gray-400">🔒</span>}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-500">
                                  {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                                </td>
                              </tr>
                              {expandedOrder === order.id && (
                                <tr key={`${order.id}-detail`}>
                                  <td colSpan={4} className="px-4 py-3 bg-amber-50">
                                    <div className="text-xs space-y-1">
                                      {order.items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between">
                                          <span>{item.item_name} × {item.quantity}</span>
                                          <span className="font-medium">{earningsUnlocked ? mask(item.subtotal) : '🔒'}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Password Modal */}
      {passwordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPasswordModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-7 h-7 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Unlock Revenue</h3>
              <p className="text-sm text-gray-500 mt-1">Enter settlement password</p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); unlockEarnings(); }}>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Settlement password" className="input mb-4" autoFocus />
              <div className="flex gap-3">
                <button type="button" onClick={() => { setPasswordModal(false); setPassword(''); }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={verifying || !password} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  {verifying ? 'Verifying...' : 'Unlock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== KPI Card Component ====================
function KpiCard({ icon, label, value, color, locked, onUnlock }: {
  icon: React.ReactNode; label: string; value: string | null; color: string;
  locked?: boolean; onUnlock?: () => void;
}) {
  const colors: Record<string, string> = {
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    purple: 'bg-purple-50 text-purple-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    orange: 'bg-orange-50 text-orange-600',
    rose: 'bg-rose-50 text-rose-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
  };
  return (
    <div className="card p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${colors[color] || colors.amber}`}>
        {icon}
      </div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      {locked ? (
        <button onClick={onUnlock} className="flex items-center gap-1 text-gray-400 hover:text-amber-600">
          <Lock className="w-3.5 h-3.5" /><span className="text-sm font-medium">Unlock</span>
        </button>
      ) : (
        <p className="text-lg font-bold text-gray-900">{value}</p>
      )}
    </div>
  );
}
