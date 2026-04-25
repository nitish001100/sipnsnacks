'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import {
  IndianRupee,
  ShoppingBag,
  Package,
  TrendingUp,
  Lock,
  Loader2,
  Download,
  Mail,
  Eye,
  EyeOff,
  KeyRound,
  Clock,
  Flame,
  CheckCircle2,
  ChefHat,
  ArrowRight,
  Trophy,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useHideMoney } from '@/hooks/useHideMoney';
import HideMoneyToggle from '@/components/HideMoneyToggle';

interface DailySummary {
  date: string;
  total_orders: number;
  total_revenue: number;
  items_sold: number;
}

interface AllTime {
  total_revenue: number;
  total_orders: number;
  total_items: number;
}

interface RecentOrder {
  id: number;
  order_number: string;
  total_amount: number;
  status: string;
  created_at: string;
  item_count: number;
}

interface TopItem {
  item_name: string;
  total_qty: number;
  total_revenue: number;
}

interface DashboardStats {
  statusCounts: { pending: number; accepted: number; completed: number };
  recentOrders: RecentOrder[];
  topItems: TopItem[];
  hourlySales: { hour: number; count: number; revenue: number }[];
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [allTime, setAllTime] = useState<AllTime | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [earningsUnlocked, setEarningsUnlocked] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [settlementModal, setSettlementModal] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settlePassword, setSettlePassword] = useState('');
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [resetModal, setResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');
  const today = format(new Date(), 'yyyy-MM-dd');
  const { hidden: moneyHidden, toggle: moneyToggle, mask } = useHideMoney();

  const fetchDashboard = useCallback(async () => {
    try {
      const [summaryRes, statsRes] = await Promise.all([
        fetch(`/api/reports/daily?date=${today}`),
        fetch('/api/dashboard'),
      ]);
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data.summary);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch {
      toast.error('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    fetchDashboard();
    // Auto-refresh every 15 seconds
    const interval = setInterval(fetchDashboard, 15000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

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
        setSummary(data.today);
        setAllTime(data.allTime);
        setPasswordModal(false);
        setPassword('');
        toast.success('Earnings unlocked!');
      } else {
        toast.error(data.error || 'Invalid password');
      }
    } catch {
      toast.error('Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleSettlement = async () => {
    if (!settlePassword) return;
    setSettling(true);
    try {
      const res = await fetch('/api/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: settlePassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Settlement email sent!');
        setSettlementModal(false);
        setSettlePassword('');
      } else {
        toast.error(data.error || 'Settlement failed');
      }
    } catch {
      toast.error('Failed to send settlement');
    } finally {
      setSettling(false);
    }
  };

  const handleExport = () => {
    window.open(`/api/reports/export?date=${today}`, '_blank');
    toast.success('Downloading Excel report...');
  };

  const handleReset = async () => {
    if (!resetPassword) return;
    if (resetConfirm !== 'RESET') {
      toast.error('Type RESET to confirm');
      return;
    }
    setResetting(true);
    try {
      const res = await fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'All data reset!');
        setResetModal(false);
        setResetPassword('');
        setResetConfirm('');
        setEarningsUnlocked(false);
        setAllTime(null);
        fetchDashboard();
      } else {
        toast.error(data.error || 'Reset failed');
      }
    } catch {
      toast.error('Reset failed');
    } finally {
      setResetting(false);
    }
  };

  const getDailyNum = (orderNumber: string) =>
    orderNumber.split('-').pop()?.replace(/^0+/, '') || '?';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            <Flame className="w-3 h-3" /> Cooking
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle2 className="w-3 h-3" /> Done
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            {status}
          </span>
        );
    }
  };

  const totalOrders = stats
    ? stats.statusCounts.pending + stats.statusCounts.accepted + stats.statusCounts.completed
    : 0;

  return (
    <div className="flex min-h-screen">
      <Navbar />
      <main className="flex-1 md:ml-64 p-6 pt-16 md:pt-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sip n Snacks</h1>
            <p className="text-gray-500 mt-1">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <div className="flex gap-2 mt-4 sm:mt-0 flex-wrap items-center">
            <HideMoneyToggle hidden={moneyHidden} toggle={moneyToggle} />
            <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" /> Export
            </button>
            <button
              onClick={() => setSettlementModal(true)}
              className="bg-[#1B2E3C] hover:bg-[#2a4a5c] text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2 text-sm"
            >
              <Mail className="w-4 h-4" /> Settle Day
            </button>
            <button
              onClick={() => { setResetPassword(''); setResetConfirm(''); setResetModal(true); }}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2 text-sm"
            >
              <Trash2 className="w-4 h-4" /> Reset Data
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="card hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Today&apos;s Revenue</p>
                    {earningsUnlocked ? (
                      <p className="text-2xl font-bold mt-1 text-green-700">
                        {mask(summary?.total_revenue ?? 0)}
                      </p>
                    ) : (
                      <button onClick={() => setPasswordModal(true)} className="flex items-center gap-1.5 mt-1 text-gray-400 hover:text-amber-600 transition-colors">
                        <Lock className="w-4 h-4" /><span className="text-sm font-medium">Tap to unlock</span>
                      </button>
                    )}
                  </div>
                  <div className="bg-green-50 p-3 rounded-xl"><IndianRupee className="w-6 h-6 text-green-700" /></div>
                </div>
              </div>
              <div className="card hover:shadow-md transition-shadow cursor-pointer" onClick={() => setShowOrdersModal(true)}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Today&apos;s Orders</p>
                    <p className="text-2xl font-bold mt-1 text-amber-700 underline decoration-amber-300 underline-offset-2 hover:decoration-amber-500">
                      {summary?.total_orders ?? 0}
                    </p>
                    <p className="text-[10px] text-amber-500 mt-0.5">Click to view details →</p>
                  </div>
                  <div className="bg-amber-50 p-3 rounded-xl"><ShoppingBag className="w-6 h-6 text-amber-700" /></div>
                </div>
              </div>
              <div className="card hover:shadow-md transition-shadow cursor-pointer" onClick={() => setShowItemsModal(true)}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Items Sold</p>
                    <p className="text-2xl font-bold mt-1 text-purple-700 underline decoration-purple-300 underline-offset-2 hover:decoration-purple-500">
                      {summary?.items_sold ?? 0}
                    </p>
                    <p className="text-[10px] text-purple-500 mt-0.5">Click to view details →</p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-xl"><Package className="w-6 h-6 text-purple-700" /></div>
                </div>
              </div>
              <div className="card hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">All-Time Revenue</p>
                    {earningsUnlocked && allTime ? (
                      <p className="text-2xl font-bold mt-1 text-orange-700">{mask(allTime.total_revenue)}</p>
                    ) : (
                      <button onClick={() => setPasswordModal(true)} className="flex items-center gap-1.5 mt-1 text-gray-400 hover:text-amber-600 transition-colors">
                        <Lock className="w-4 h-4" /><span className="text-sm font-medium">Tap to unlock</span>
                      </button>
                    )}
                  </div>
                  <div className="bg-orange-50 p-3 rounded-xl"><TrendingUp className="w-6 h-6 text-orange-700" /></div>
                </div>
              </div>
            </div>

            {earningsUnlocked && (
              <div className="flex justify-end mb-4">
                <button onClick={() => { setEarningsUnlocked(false); setAllTime(null); }}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-500 transition-colors">
                  <EyeOff className="w-4 h-4" /> Hide earnings
                </button>
              </div>
            )}

            {/* ===== LIVE ORDER STATUS SECTION ===== */}
            {stats && (
              <div className="card mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <ChefHat className="w-5 h-5 text-amber-600" />
                    Live Order Status
                  </h2>
                  <a href="/kitchen" className="text-sm text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1">
                    Open Kitchen <ArrowRight className="w-4 h-4" />
                  </a>
                </div>

                {/* Status Pipeline */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="rounded-xl bg-yellow-50 border-2 border-yellow-200 p-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-yellow-400 text-white flex items-center justify-center mx-auto mb-2">
                      <Clock className="w-5 h-5" />
                    </div>
                    <p className="text-3xl font-black text-yellow-700">{stats.statusCounts.pending}</p>
                    <p className="text-xs font-medium text-yellow-600 mt-1">🆕 Pending</p>
                    <p className="text-[10px] text-yellow-500">Waiting for kitchen</p>
                  </div>
                  <div className="rounded-xl bg-orange-50 border-2 border-orange-200 p-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-orange-400 text-white flex items-center justify-center mx-auto mb-2">
                      <Flame className="w-5 h-5" />
                    </div>
                    <p className="text-3xl font-black text-orange-700">{stats.statusCounts.accepted}</p>
                    <p className="text-xs font-medium text-orange-600 mt-1">🔥 Cooking</p>
                    <p className="text-[10px] text-orange-500">Being prepared</p>
                  </div>
                  <div className="rounded-xl bg-green-50 border-2 border-green-200 p-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center mx-auto mb-2">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <p className="text-3xl font-black text-green-700">{stats.statusCounts.completed}</p>
                    <p className="text-xs font-medium text-green-600 mt-1">✅ Completed</p>
                    <p className="text-[10px] text-green-500">Served to customer</p>
                  </div>
                </div>

                {/* Progress Bar */}
                {totalOrders > 0 && (
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Order fulfillment progress</span>
                      <span>{Math.round((stats.statusCounts.completed / totalOrders) * 100)}% completed</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                      {stats.statusCounts.completed > 0 && (
                        <div
                          className="bg-green-500 transition-all duration-500"
                          style={{ width: `${(stats.statusCounts.completed / totalOrders) * 100}%` }}
                        />
                      )}
                      {stats.statusCounts.accepted > 0 && (
                        <div
                          className="bg-orange-400 transition-all duration-500"
                          style={{ width: `${(stats.statusCounts.accepted / totalOrders) * 100}%` }}
                        />
                      )}
                      {stats.statusCounts.pending > 0 && (
                        <div
                          className="bg-yellow-400 transition-all duration-500"
                          style={{ width: `${(stats.statusCounts.pending / totalOrders) * 100}%` }}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div className="card mb-6">
              <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <a href="/checkout" className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-all">
                  <ShoppingBag className="w-8 h-8 text-amber-500" />
                  <div>
                    <p className="font-semibold text-gray-800">New Order</p>
                    <p className="text-sm text-gray-500">Start checkout</p>
                  </div>
                </a>
                <a href="/kitchen" className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-orange-400 hover:bg-orange-50 transition-all">
                  <ChefHat className="w-8 h-8 text-orange-500" />
                  <div>
                    <p className="font-semibold text-gray-800">Kitchen</p>
                    <p className="text-sm text-gray-500">View orders</p>
                  </div>
                </a>
                <a href="/menu" className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all">
                  <Package className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="font-semibold text-gray-800">Menu</p>
                    <p className="text-sm text-gray-500">Manage items</p>
                  </div>
                </a>
                <a href="/reports" className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition-all">
                  <TrendingUp className="w-8 h-8 text-purple-500" />
                  <div>
                    <p className="font-semibold text-gray-800">Reports</p>
                    <p className="text-sm text-gray-500">Sales analytics</p>
                  </div>
                </a>
              </div>
            </div>

            {/* Two Column: Recent Orders + Top Items */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Orders */}
              {stats && (
                <div className="card">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-amber-600" />
                    Recent Orders
                  </h2>
                  {stats.recentOrders.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-8">No orders yet today</p>
                  ) : (
                    <div className="space-y-2">
                      {stats.recentOrders.map((order) => (
                        <div key={order.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-gray-800">#{getDailyNum(order.order_number)}</span>
                            <div>
                              {getStatusBadge(order.status)}
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} · {order.item_count} items
                              </p>
                            </div>
                          </div>
                          <span className="font-bold text-gray-800 text-sm">{mask(order.total_amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Top Selling Items */}
              {stats && (
                <div className="card">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-600" />
                    Top Selling Items Today
                  </h2>
                  {stats.topItems.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-8">No sales yet today</p>
                  ) : (
                    <div className="space-y-3">
                      {stats.topItems.map((item, idx) => {
                        const maxQty = stats.topItems[0].total_qty;
                        const barWidth = (item.total_qty / maxQty) * 100;
                        return (
                          <div key={item.item_name} className="flex items-center gap-3">
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-gray-300 text-white' : idx === 2 ? 'bg-orange-300 text-white' : 'bg-gray-100 text-gray-500'
                            }`}>{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between mb-1">
                                <span className="text-sm font-medium text-gray-800 truncate">{item.item_name}</span>
                                <span className="text-xs text-gray-500 shrink-0 ml-2">{item.total_qty} sold</span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${barWidth}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
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
              <h3 className="text-lg font-bold text-gray-900">Unlock Earnings</h3>
              <p className="text-sm text-gray-500 mt-1">Enter settlement password to view</p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); unlockEarnings(); }}>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Settlement password" className="input mb-4" autoFocus />
              <div className="flex gap-3">
                <button type="button" onClick={() => { setPasswordModal(false); setPassword(''); }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={verifying || !password}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  {verifying ? 'Verifying...' : 'Unlock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Today's Orders Modal */}
      {showOrdersModal && stats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowOrdersModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-600" />
                Today&apos;s Orders ({stats.recentOrders.length})
              </h3>
              <button onClick={() => setShowOrdersModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            {stats.recentOrders.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No orders today</p>
            ) : (
              <div className="space-y-3">
                {stats.recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-black text-gray-800">#{getDailyNum(order.order_number)}</span>
                      <div>
                        {getStatusBadge(order.status)}
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} · {order.item_count} items
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-gray-800">{mask(order.total_amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Items Sold Modal */}
      {showItemsModal && stats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowItemsModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-600" />
                Items Sold Today ({summary?.items_sold ?? 0})
              </h3>
              <button onClick={() => setShowItemsModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            {stats.topItems.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No items sold today</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 pb-2 border-b">
                  <span className="col-span-1">#</span>
                  <span className="col-span-6">Item Name</span>
                  <span className="col-span-2 text-right">Qty</span>
                  <span className="col-span-3 text-right">Revenue</span>
                </div>
                {stats.topItems.map((item, idx) => (
                  <div key={item.item_name} className="grid grid-cols-12 gap-2 items-center py-2 px-1 rounded hover:bg-gray-50">
                    <span className="col-span-1 text-sm text-gray-400 font-medium">{idx + 1}</span>
                    <span className="col-span-6 text-sm font-medium text-gray-800">{item.item_name}</span>
                    <span className="col-span-2 text-sm text-right font-bold text-purple-700">{item.total_qty}</span>
                    <span className="col-span-3 text-sm text-right text-gray-600">{mask(item.total_revenue)}</span>
                  </div>
                ))}
                <div className="grid grid-cols-12 gap-2 pt-2 border-t mt-2 font-bold text-sm">
                  <span className="col-span-7 text-gray-700">Total</span>
                  <span className="col-span-2 text-right text-purple-700">{stats.topItems.reduce((s, i) => s + i.total_qty, 0)}</span>
                  <span className="col-span-3 text-right text-gray-800">{mask(stats.topItems.reduce((s, i) => s + i.total_revenue, 0))}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Data Reset Modal */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !resetting && setResetModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-7 h-7 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">⚠️ Reset All Data</h3>
              <p className="text-sm text-gray-500 mt-1">This will permanently delete ALL orders & sales data</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-xs text-red-700">
              <p className="font-semibold mb-1">This action will:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Delete all orders</li>
                <li>Delete all order items</li>
                <li>Reset all sales & revenue to 0</li>
                <li>This cannot be undone!</li>
              </ul>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleReset(); }}>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Settlement Password</label>
                  <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Enter password" className="input" autoFocus />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Type <code className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-mono font-bold">RESET</code> to confirm
                  </label>
                  <input type="text" value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)}
                    placeholder="Type RESET" className="input" />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setResetModal(false); setResetPassword(''); setResetConfirm(''); }}
                  className="btn-secondary flex-1" disabled={resetting}>Cancel</button>
                <button type="submit" disabled={resetting || !resetPassword || resetConfirm !== 'RESET'}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                  {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {resetting ? 'Resetting...' : 'Reset All Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settlement Modal */}
      {settlementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSettlementModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-full bg-[#1B2E3C] flex items-center justify-center mx-auto mb-3">
                <Mail className="w-7 h-7 text-[#F5B041]" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Day Settlement</h3>
              <p className="text-sm text-gray-500 mt-1">Send today&apos;s report via email</p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSettlement(); }}>
              <input type="password" value={settlePassword} onChange={(e) => setSettlePassword(e.target.value)}
                placeholder="Settlement password" className="input mb-4" autoFocus />
              <div className="flex gap-3">
                <button type="button" onClick={() => { setSettlementModal(false); setSettlePassword(''); }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={settling || !settlePassword}
                  className="bg-[#1B2E3C] hover:bg-[#2a4a5c] text-white font-medium py-2 px-4 rounded-lg transition-colors flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                  {settling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  {settling ? 'Sending...' : 'Send & Settle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
