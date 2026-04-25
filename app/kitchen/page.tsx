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

  useEffect(() => {
    fetchOrders();
    fetchCompletedToday();
    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      fetchOrders();
      fetchCompletedToday();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchOrders, fetchCompletedToday]);

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

  const getTimeSince = (createdAt: string) => {
    const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h`;
  };

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Navbar />
      <main className="flex-1 md:ml-64 p-4 pt-16 md:pt-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <ChefHat className="w-8 h-8 text-amber-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Kitchen Display</h1>
              <p className="text-gray-500 text-xs">
                Auto-refreshes every 5s · Last:{' '}
                {lastRefresh.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-yellow-400">
                <Clock className="w-4 h-4" />
                {pendingOrders.length} New
              </span>
              <span className="flex items-center gap-1 text-orange-400">
                <Flame className="w-4 h-4" />
                {acceptedOrders.length} Cooking
              </span>
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                {completedToday.length} Done
              </span>
            </div>
            <button
              onClick={() => { fetchOrders(); fetchCompletedToday(); }}
              className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <ChefHat className="w-16 h-16 text-gray-700 mb-4" />
            <p className="text-gray-500 text-lg">No active orders</p>
            <p className="text-gray-600 text-sm">New orders will appear here automatically</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Pending orders first (yellow), then accepted (orange) */}
            {[...pendingOrders, ...acceptedOrders].map((order) => {
              const isPending = order.status === 'pending';
              const borderColor = isPending ? 'border-yellow-500' : 'border-orange-500';
              const headerBg = isPending ? 'bg-yellow-500' : 'bg-orange-500';
              const pulseClass = isPending ? 'animate-pulse' : '';

              return (
                <div
                  key={order.id}
                  className={`rounded-xl border-2 ${borderColor} bg-gray-900 overflow-hidden shadow-lg ${pulseClass}`}
                >
                  {/* Header */}
                  <div className={`${headerBg} px-4 py-3 flex items-center justify-between`}>
                    <div>
                      <span className="text-2xl font-black text-white">
                        #{getDailyNum(order.order_number)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-white/80 text-xs font-medium block">
                        {isPending ? '🆕 NEW' : '🔥 COOKING'}
                      </span>
                      <span className="text-white text-xs flex items-center gap-1 justify-end">
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
                          className="flex items-center justify-between border-b border-gray-800 pb-2 last:border-0"
                        >
                          <div className="flex items-center gap-2">
                            <span className="bg-gray-800 text-white text-sm font-bold rounded-md w-8 h-8 flex items-center justify-center">
                              {item.quantity}x
                            </span>
                            <span className="text-white font-medium text-sm">
                              {item.item_name}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div className="mt-3 pt-2 border-t border-gray-700 flex justify-between items-center">
                      <span className="text-gray-400 text-xs">
                        {order.items.reduce((s, i) => s + i.quantity, 0)} items
                      </span>
                      <span className="text-white font-bold">
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
            <h2 className="text-lg font-bold text-gray-400 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Completed Today ({completedToday.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {completedToday.map((order) => (
                <div
                  key={order.id}
                  className="rounded-lg border border-green-900 bg-gray-900/50 p-3 opacity-60"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-green-400">
                      #{getDailyNum(order.order_number)}
                    </span>
                    <span className="text-green-500 text-xs">✓ Done</span>
                  </div>
                  <div className="space-y-1">
                    {order.items.map((item, idx) => (
                      <p key={idx} className="text-gray-500 text-xs">
                        {item.quantity}x {item.item_name}
                      </p>
                    ))}
                  </div>
                  <p className="text-gray-500 text-xs mt-2 font-bold">
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
