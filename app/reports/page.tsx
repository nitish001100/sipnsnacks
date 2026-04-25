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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, subDays, addDays } from 'date-fns';

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
  items: Array<{
    item_name: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
}

export default function ReportsPage() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [earningsUnlocked, setEarningsUnlocked] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    fetchData();
  }, [date]);

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

  const handleExport = () => {
    window.open(`/api/reports/export?date=${date}`, '_blank');
    toast.success('Downloading Excel report...');
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const current = new Date(date);
    const newDate = direction === 'prev' ? subDays(current, 1) : addDays(current, 1);
    if (newDate <= new Date()) {
      setDate(format(newDate, 'yyyy-MM-dd'));
    }
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

  return (
    <div className="flex min-h-screen">
      <Navbar />
      <main className="flex-1 md:ml-64 p-6 pt-16 md:pt-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sales Reports</h1>
            <p className="text-gray-500 mt-1">View daily sales and transactions</p>
          </div>
          <div className="flex gap-3 mt-4 sm:mt-0">
            {earningsUnlocked && (
              <button
                onClick={() => setEarningsUnlocked(false)}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <EyeOff className="w-4 h-4" />
                Hide ₹
              </button>
            )}
            <button
              onClick={handleExport}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </button>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="card mb-6">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => navigateDate('prev')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-500" />
              <input
                type="date"
                value={date}
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
                      <p className="text-xl font-bold text-green-700">
                        ₹{(summary?.total_revenue || 0).toLocaleString('en-IN')}
                      </p>
                    ) : (
                      <button
                        onClick={() => setPasswordModal(true)}
                        className="flex items-center gap-1.5 text-gray-400 hover:text-amber-600 transition-colors"
                      >
                        <Lock className="w-4 h-4" />
                        <span className="text-sm font-medium">Unlock</span>
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
                    <p className="text-xl font-bold text-amber-700">
                      {summary?.total_orders || 0}
                    </p>
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
                    <p className="text-xl font-bold text-purple-700">
                      {summary?.items_sold || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Orders Table */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">
                Orders ({orders.length})
              </h2>

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
                        <th className="text-left px-4 py-3 font-medium text-gray-600">
                          Order ID
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">
                          Items
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">
                          Amount
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">
                          Time
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <>
                          <tr
                            key={order.id}
                            className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                            onClick={() =>
                              setExpandedOrder(
                                expandedOrder === order.id ? null : order.id
                              )
                            }
                          >
                            <td className="px-4 py-3 font-mono text-xs">
                              {order.order_number}
                            </td>
                            <td className="px-4 py-3">
                              {order.items
                                .map((i) => `${i.item_name} x${i.quantity}`)
                                .join(', ')}
                            </td>
                            <td className="px-4 py-3 text-right font-medium">
                              {earningsUnlocked ? (
                                `₹${order.total_amount.toLocaleString('en-IN')}`
                              ) : (
                                <span className="text-gray-400">🔒</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-500">
                              {new Date(order.created_at).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZone: 'Asia/Kolkata',
                              })}
                            </td>
                          </tr>
                          {expandedOrder === order.id && (
                            <tr key={`${order.id}-detail`}>
                              <td colSpan={4} className="px-4 py-3 bg-amber-50">
                                <div className="text-xs space-y-1">
                                  {order.items.map((item, idx) => (
                                    <div
                                      key={idx}
                                      className="flex justify-between"
                                    >
                                      <span>
                                        {item.item_name} × {item.quantity}
                                      </span>
                                      <span className="font-medium">
                                        {earningsUnlocked ? `₹${item.subtotal}` : '🔒'}
                                      </span>
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
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Settlement password"
                className="input mb-4"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setPasswordModal(false); setPassword(''); }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifying || !password}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
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
