'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  Flame,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface OrderItem {
  item_name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

interface KitchenOrder {
  id: number;
  order_number: string;
  total_amount: number;
  status: string;
  created_at: string;
  items: OrderItem[];
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [completedToday, setCompletedToday] = useState<KitchenOrder[]>([]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/kitchen');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders);
        setLastRefresh(new Date());
      }
    } catch {
      // silent fail on auto-refresh
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCompletedToday = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/orders?date=${today}&limit=100`);
      if (res.ok) {
        const data = await res.json();
        setCompletedToday(
          data.orders.filter((o: KitchenOrder) => o.status === 'completed')
        );
      }
    } catch {
      // silent
    }
  }, []);

  // Trigger overdue email alert when overdue orders detected
  const triggerAlert = useCallback(async () => {
    try {
      await fetch('/api/kitchen/alert');
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchCompletedToday();
    // Refresh orders every 5s
    const interval = setInterval(() => {
      fetchOrders();
      fetchCompletedToday();
    }, 5000);
    // Check for overdue alerts every 5 minutes
    const alertInterval = setInterval(triggerAlert, 5 * 60 * 1000);
    // Also check on first load after 10s
    const initialAlert = setTimeout(triggerAlert, 10000);
    return () => {
      clearInterval(interval);
      clearInterval(alertInterval);
      clearTimeout(initialAlert);
    };
  }, [fetchOrders, fetchCompletedToday, triggerAlert]);

  const updateStatus = async (orderId: number, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(
          newStatus === 'accepted' ? '🔥 Order accepted!' : '✅ Order completed!'
        );
        fetchOrders();
        fetchCompletedToday();
      } else {
        toast.error('Failed to update');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setUpdatingId(null);
    }
  };

  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const acceptedOrders = orders.filter((o) => o.status === 'accepted');

  const getDailyNum = (orderNumber: string) =>
    orderNumber.split('-').pop()?.replace(/^0+/, '') || '?';

  const getMinutesSince = (createdAt: string) => {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  };

  const getTimeSince = (createdAt: string) => {
    const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h`;
  };

  const isOverdue = (createdAt: string) => getMinutesSince(createdAt) >= 20;

  const overdueCount = orders.filter((o) => o.status === 'pending' && isOverdue(o.created_at)).length;

  return (
    <div className="flex min-h-screen">
      <Navbar />
      <main className="flex-1 md:ml-64 p-6 pt-16 md:pt-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <ChefHat className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Kitchen Display</h1>
              <p className="text-gray-500 text-sm">
                Auto-refreshes every 5s · Last:{' '}
                {lastRefresh.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4 sm:mt-0">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-50 text-yellow-700 font-medium">
                <Clock className="w-4 h-4" />
                {pendingOrders.length} New
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 text-orange-700 font-medium">
                <Flame className="w-4 h-4" />
                {acceptedOrders.length} Cooking
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 text-green-700 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                {completedToday.length} Done
              </span>
            </div>
            <button
              onClick={() => { fetchOrders(); fetchCompletedToday(); }}
              className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Overdue Alert Banner */}
        {overdueCount > 0 && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 border-2 border-red-300 flex items-center gap-3 animate-pulse">
            <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
            <div>
              <p className="text-red-800 font-bold text-sm">
                🚨 {overdueCount} order(s) pending for over 20 minutes!
              </p>
              <p className="text-red-600 text-xs mt-0.5">
                Email alert sent to admin · Please take action immediately
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
          </div>
        ) : orders.length === 0 ? (
          <div className="card text-center py-16">
            <ChefHat className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">No active orders</p>
            <p className="text-gray-400 text-sm mt-1">New orders will appear here automatically</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...pendingOrders, ...acceptedOrders].map((order) => {
              const isPending = order.status === 'pending';
              const overdue = isPending && isOverdue(order.created_at);
              const mins = getMinutesSince(order.created_at);

              return (
                <div
                  key={order.id}
                  className={`rounded-xl border-2 overflow-hidden shadow-sm hover:shadow-md transition-all ${
                    overdue
                      ? 'border-red-500 bg-red-50/50 ring-2 ring-red-300 ring-offset-1'
                      : isPending
                        ? 'border-yellow-400 bg-yellow-50/50'
                        : 'border-orange-400 bg-orange-50/50'
                  }`}
                >
                  {/* Overdue Warning */}
                  {overdue && (
                    <div className="bg-red-600 px-3 py-1.5 flex items-center gap-2 text-white animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold">⏰ OVERDUE — {mins}min waiting!</span>
                    </div>
                  )}

                  {/* Header */}
                  <div
                    className={`px-4 py-3 flex items-center justify-between ${
                      overdue ? 'bg-red-500' : isPending ? 'bg-yellow-400' : 'bg-orange-400'
                    }`}
                  >
                    <span className="text-2xl font-black text-white">
                      #{getDailyNum(order.order_number)}
                    </span>
                    <div className="text-right">
                      <span className="text-white/90 text-xs font-semibold block">
                        {overdue ? '🚨 OVERDUE' : isPending ? '🆕 NEW ORDER' : '🔥 COOKING'}
                      </span>
                      <span className={`text-xs flex items-center gap-1 justify-end ${overdue ? 'text-white font-bold' : 'text-white/80'}`}>
                        <Clock className="w-3 h-3" />
                        {getTimeSince(order.created_at)} ago
                      </span>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="p-4">
                    <div className="space-y-2">
                      {order.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 pb-2 border-b border-gray-200 last:border-0 last:pb-0"
                        >
                          <span
                            className={`text-sm font-bold rounded-lg w-9 h-9 flex items-center justify-center shrink-0 ${
                              isPending
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}
                          >
                            {item.quantity}x
                          </span>
                          <span className="text-gray-900 font-medium text-sm">
                            {item.item_name}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div className="mt-3 pt-2 border-t border-gray-200 flex justify-between items-center">
                      <span className="text-gray-500 text-xs">
                        {order.items.reduce((s, i) => s + i.quantity, 0)} items
                      </span>
                      <span className="text-gray-900 font-bold">
                        ₹{order.total_amount.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* Action Button */}
                    <div className="mt-3">
                      {isPending ? (
                        <button
                          onClick={() => updateStatus(order.id, 'accepted')}
                          disabled={updatingId === order.id}
                          className="w-full py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {updatingId === order.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Flame className="w-4 h-4" />
                          )}
                          ACCEPT & START COOKING
                        </button>
                      ) : (
                        <button
                          onClick={() => updateStatus(order.id, 'completed')}
                          disabled={updatingId === order.id}
                          className="w-full py-3 rounded-lg bg-green-500 hover:bg-green-600 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {updatingId === order.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          MARK COMPLETE ✓
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Completed today section */}
        {completedToday.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Completed Today ({completedToday.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {completedToday.map((order) => (
                <div
                  key={order.id}
                  className="rounded-lg border border-green-200 bg-green-50/50 p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-green-700">
                      #{getDailyNum(order.order_number)}
                    </span>
                    <span className="text-green-500 text-xs font-medium">✓ Done</span>
                  </div>
                  <div className="space-y-1">
                    {order.items.map((item, idx) => (
                      <p key={idx} className="text-gray-500 text-xs">
                        {item.quantity}x {item.item_name}
                      </p>
                    ))}
                  </div>
                  <p className="text-gray-700 text-xs mt-2 font-bold">
                    ₹{order.total_amount}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
