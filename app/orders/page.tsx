'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import {
  Loader2,
  Package,
  Clock,
  ChefHat,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  RefreshCw,
  Calendar,
  Filter,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useHideMoney } from '@/hooks/useHideMoney';
import HideMoneyToggle from '@/components/HideMoneyToggle';

interface OrderItem {
  item_name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

interface Order {
  id: number;
  order_number: string;
  total_amount: number;
  status: string;
  created_at: string;
  items: OrderItem[];
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType; bg: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-700', icon: Clock, bg: 'bg-yellow-100' },
  preparing: { label: 'Preparing', color: 'text-blue-700', icon: ChefHat, bg: 'bg-blue-100' },
  ready: { label: 'Ready', color: 'text-green-700', icon: CheckCircle2, bg: 'bg-green-100' },
  completed: { label: 'Completed', color: 'text-gray-700', icon: CheckCircle2, bg: 'bg-gray-100' },
  cancelled: { label: 'Cancelled', color: 'text-red-700', icon: XCircle, bg: 'bg-red-100' },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const limit = 20;
  const { mask } = useHideMoney();

  useEffect(() => {
    fetchOrders();
  }, [page, filterDate]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let url = `/api/orders?page=${page}&limit=${limit}`;
      if (filterDate) url += `&date=${filterDate}`;
      const res = await fetch(url);
      const data = await res.json();
      setOrders(data.orders || []);
      setTotal(data.total || 0);
    } catch {
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = filterStatus
    ? orders.filter((o) => o.status === filterStatus)
    : orders;

  const totalPages = Math.ceil(total / limit);

  const updateOrderStatus = async (orderId: number, status: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success(`Order ${status}`);
        fetchOrders();
        if (selectedOrder?.id === orderId) {
          setSelectedOrder({ ...selectedOrder, status });
        }
      } else {
        toast.error('Failed to update order');
      }
    } catch {
      toast.error('Network error');
    }
  };

  return (
    <div className="flex min-h-screen">
      <Navbar />
      <main className="flex-1 md:ml-64 p-6 pt-16 md:pt-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-7 h-7 text-amber-600" />
              Orders
            </h1>
            <p className="text-gray-500 mt-1">{total} total orders</p>
          </div>
          <button
            onClick={() => fetchOrders()}
            className="btn-secondary flex items-center gap-2 text-sm mt-4 sm:mt-0"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => { setFilterDate(e.target.value); setPage(1); }}
              className="input pl-9 py-2 text-sm w-full sm:w-48"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input pl-9 py-2 text-sm w-full sm:w-44"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          {filterDate && (
            <button
              onClick={() => { setFilterDate(''); setPage(1); }}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Clear filters
            </button>
          )}
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="card text-center py-12">
            <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No orders found</p>
            <p className="text-gray-400 text-sm mt-1">Orders placed will appear here</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const config = statusConfig[order.status] || statusConfig.pending;
                const StatusIcon = config.icon;
                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center`}>
                          <StatusIcon className={`w-5 h-5 ${config.color}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900">#{order.order_number}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                              {config.label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {format(new Date(order.created_at), 'dd MMM yyyy, hh:mm a')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 text-lg">{mask(order.total_amount)}</p>
                        <p className="text-xs text-gray-400">{order.items?.length || 0} items</p>
                      </div>
                    </div>
                    {/* Quick item preview */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(order.items || []).slice(0, 4).map((item, idx) => (
                        <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                          {item.item_name} ×{item.quantity}
                        </span>
                      ))}
                      {(order.items || []).length > 4 && (
                        <span className="text-xs bg-gray-100 text-gray-400 px-2 py-1 rounded-md">
                          +{order.items.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* Order Detail Modal */}
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setSelectedOrder(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white rounded-t-2xl p-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Order #{selectedOrder.order_number}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {format(new Date(selectedOrder.created_at), 'dd MMM yyyy, hh:mm a')}
                  </p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5">
                {/* Status */}
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-2 font-medium">Status</p>
                  <div className="flex gap-2 flex-wrap">
                    {['pending', 'preparing', 'ready', 'completed', 'cancelled'].map((s) => {
                      const cfg = statusConfig[s];
                      const isActive = selectedOrder.status === s;
                      return (
                        <button
                          key={s}
                          onClick={() => updateOrderStatus(selectedOrder.id, s)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            isActive
                              ? `${cfg.bg} ${cfg.color} border-current`
                              : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Items */}
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-2 font-medium">Items</p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2 text-gray-600 font-medium">Item</th>
                          <th className="text-center px-3 py-2 text-gray-600 font-medium">Qty</th>
                          <th className="text-right px-3 py-2 text-gray-600 font-medium">Price</th>
                          <th className="text-right px-3 py-2 text-gray-600 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedOrder.items || []).map((item, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-2 font-medium text-gray-900">{item.item_name}</td>
                            <td className="px-3 py-2 text-center text-gray-600">{item.quantity}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{mask(item.price)}</td>
                            <td className="px-3 py-2 text-right font-medium text-gray-900">{mask(item.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Total */}
                <div className="flex justify-between items-center p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="font-medium text-amber-800">Total Amount</span>
                  <span className="text-2xl font-bold text-amber-900">{mask(selectedOrder.total_amount)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
