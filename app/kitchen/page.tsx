'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { useHideMoney } from '@/hooks/useHideMoney';
import HideMoneyToggle from '@/components/HideMoneyToggle';
import { Bell } from 'lucide-react';
import { requestNotificationPermission, onForegroundMessage } from '@/lib/firebase-client';

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
  const [refreshing, setRefreshing] = useState(false);
  const { hidden, show, hide, mask, isChef } = useHideMoney();
  const [notifEnabled, setNotifEnabled] = useState(false);
  const knownOrderIds = useRef<Set<number>>(new Set());
  const isFirstLoad = useRef(true);

  // Play notification sound using Web Audio API
  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      // Play a pleasant ding-dong tone
      const playTone = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      };
      playTone(880, 0, 0.15);
      playTone(1100, 0.15, 0.15);
      playTone(1320, 0.3, 0.3);
    } catch {
      // Audio not available
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/kitchen', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const newOrders: KitchenOrder[] = data.orders;

        // Detect new orders (not on first load)
        if (!isFirstLoad.current && newOrders.length > 0) {
          const newPending = newOrders.filter(
            (o) => o.status === 'pending' && !knownOrderIds.current.has(o.id)
          );
          if (newPending.length > 0) {
            // Play sound
            playNotificationSound();
            // Vibrate
            if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
            // Show big toast for each new order
            newPending.forEach((order) => {
              const num = order.order_number.split('-').pop()?.replace(/^0+/, '') || '?';
              const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
              const itemList = order.items.map((i) => `${i.quantity}× ${i.item_name}`).join(', ');
              toast(
                (t) => (
                  <div onClick={() => toast.dismiss(t.id)} className="cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">🔔</span>
                      <span className="font-black text-lg text-amber-900">NEW ORDER #{num}</span>
                    </div>
                    <p className="text-sm text-amber-800 font-medium">{itemCount} items: {itemList}</p>
                    <p className="text-xs text-amber-600 mt-1">Tap to dismiss</p>
                  </div>
                ),
                {
                  duration: 8000,
                  style: {
                    background: '#FEF3C7',
                    border: '2px solid #F59E0B',
                    padding: '16px',
                    maxWidth: '400px',
                  },
                }
              );
            });
          }
        }

        // Update known IDs
        knownOrderIds.current = new Set(newOrders.map((o) => o.id));
        isFirstLoad.current = false;

        setOrders(newOrders);
        setLastRefresh(new Date());
      }
    } catch {
      // silent fail on auto-refresh
    } finally {
      setLoading(false);
    }
  }, [playNotificationSound]);

  const fetchCompletedToday = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/orders?date=${today}&limit=100`, { cache: 'no-store' });
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

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchOrders(), fetchCompletedToday()]);
    setRefreshing(false);
    toast.success('🔄 Refreshed!', { duration: 1000 });
  };

  // Trigger overdue email alert when overdue orders detected
  const triggerAlert = useCallback(async () => {
    try {
      await fetch('/api/kitchen/alert');
    } catch {
      // silent
    }
  }, []);

  // Push notification setup
  const enableNotifications = useCallback(async () => {
    try {
      const token = await requestNotificationPermission();
      if (token) {
        // Register token with backend
        await fetch('/api/push/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        setNotifEnabled(true);
        toast.success('🔔 Notifications enabled!');
      }
    } catch {
      toast.error('Failed to enable notifications');
    }
  }, []);

  // Listen for foreground push messages
  useEffect(() => {
    // Check if already granted
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      setNotifEnabled(true);
    }

    // Setup foreground listener
    onForegroundMessage((payload: unknown) => {
      const p = payload as { notification?: { title?: string; body?: string } };
      const title = p.notification?.title || '🔔 New Order!';
      const body = p.notification?.body || 'New order received';
      toast(body, {
        icon: '🔔',
        duration: 6000,
        style: { background: '#FEF3C7', color: '#92400E', fontWeight: 600 },
      });
      // Also vibrate if supported
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      // Refresh orders
      fetchOrders();
      fetchCompletedToday();
    });
  }, [fetchOrders, fetchCompletedToday]);

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
      <main className="flex-1 md:ml-64 p-3 pt-14 md:p-6 md:pt-6">
        {/* Header - mobile compact */}
        <div className="mb-3 md:mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ChefHat className="w-5 h-5 md:w-6 md:h-6 text-amber-600" />
              <h1 className="text-base md:text-xl font-bold text-gray-900">Kitchen</h1>
              <span className="text-[10px] md:text-xs text-gray-400">
                {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <HideMoneyToggle hidden={hidden} show={show} hide={hide} isChef={isChef} />
              {!notifEnabled ? (
                <button onClick={enableNotifications}
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] md:text-xs font-medium bg-amber-100 text-amber-700">
                  <Bell className="w-3 h-3" /> Alerts
                </button>
              ) : (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] md:text-xs font-medium bg-green-100 text-green-700">
                  <Bell className="w-3 h-3" /> On
                </span>
              )}
              <button onClick={handleManualRefresh} disabled={refreshing}
                className="p-1.5 rounded-lg bg-gray-100 text-gray-500 disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          {/* Status badges row */}
          <div className="flex items-center gap-2 text-[11px] md:text-sm">
            <span className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-full bg-yellow-50 text-yellow-700 font-medium">
              <Clock className="w-3 h-3 md:w-4 md:h-4" /> {pendingOrders.length} New
            </span>
            <span className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-full bg-orange-50 text-orange-700 font-medium">
              <Flame className="w-3 h-3 md:w-4 md:h-4" /> {acceptedOrders.length} Cooking
            </span>
            <span className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-full bg-green-50 text-green-700 font-medium">
              <CheckCircle2 className="w-3 h-3 md:w-4 md:h-4" /> {completedToday.length} Done
            </span>
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
                        {overdue ? '🚨 OVERDUE' : isPending ? '⌚ NEW ORDER' : '🔥 COOKING'}
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
                        {mask(order.total_amount)}
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
                    {mask(order.total_amount)}
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
