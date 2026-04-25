'use client';

import { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import {
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Receipt,
  Loader2,
  Search,
  X,
  Printer,
} from 'lucide-react';
import BillTemplate from '@/components/BillTemplate';
import toast from 'react-hot-toast';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  available: boolean;
}

interface CartItem {
  menu_item_id: number;
  item_name: string;
  price: number;
  quantity: number;
}

interface OrderResult {
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

export default function CheckoutPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [completedOrder, setCompletedOrder] = useState<OrderResult | null>(null);
  const billRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      const res = await fetch('/api/menu');
      const data = await res.json();
      setMenuItems(data.items.filter((i: MenuItem) => i.available));
    } catch {
      toast.error('Failed to fetch menu');
    } finally {
      setLoading(false);
    }
  };

  const categories = Array.from(new Set(menuItems.map((i) => i.category))).sort();

  const filteredMenu = menuItems.filter((item) => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !filterCategory || item.category === filterCategory;
    return matchSearch && matchCategory;
  });

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menu_item_id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menu_item_id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        { menu_item_id: item.id, item_name: item.name, price: item.price, quantity: 1 },
      ];
    });
    toast.success(`${item.name} added`, { duration: 1000 });
  };

  const updateQuantity = (menuItemId: number, delta: number) => {
    setCart((prev) => {
      return prev
        .map((c) => {
          if (c.menu_item_id === menuItemId) {
            const newQty = c.quantity + delta;
            return newQty > 0 ? { ...c, quantity: newQty } : null;
          }
          return c;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (menuItemId: number) => {
    setCart((prev) => prev.filter((c) => c.menu_item_id !== menuItemId));
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  const placeOrder = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty!');
      return;
    }

    setPlacing(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart }),
      });

      if (res.ok) {
        const data = await res.json();
        setCompletedOrder(data.order);
        setCart([]);
        toast.success('Order placed successfully!');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to place order');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setPlacing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Bill View
  if (completedOrder) {
    return (
      <div className="flex min-h-screen">
        <Navbar />
        <main className="flex-1 md:ml-64 p-6 pt-16 md:pt-6">
          <div className="max-w-lg mx-auto">
            {/* Professional Bill Template */}
            <BillTemplate order={completedOrder} />

            {/* Actions */}
            <div className="flex gap-3 mt-4 no-print" style={{ maxWidth: 360, margin: '16px auto 0' }}>
              <button
                onClick={handlePrint}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print Bill
              </button>
              <button
                onClick={() => setCompletedOrder(null)}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                New Order
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Navbar />
      <main className="flex-1 md:ml-64 pt-16 md:pt-0">
        <div className="flex flex-col lg:flex-row h-screen md:h-auto">
          {/* Menu Section */}
          <div className="flex-1 p-6 overflow-auto" style={{ maxHeight: 'calc(100vh - 64px)' }}>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Checkout</h1>
            <p className="text-gray-500 mb-4">Select items to add to order</p>

            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search menu..."
                  className="input pl-9 py-2 text-sm"
                />
              </div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="input w-full sm:w-40 py-2 text-sm"
              >
                <option value="">All</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Menu Grid */}
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredMenu.map((item) => {
                  const inCart = cart.find((c) => c.menu_item_id === item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className={`p-3 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                        inCart
                          ? 'border-amber-400 bg-amber-50'
                          : 'border-gray-100 bg-white hover:border-amber-200'
                      }`}
                    >
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.category}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-bold text-gray-900">
                          ₹{item.price}
                        </span>
                        {inCart && (
                          <span className="bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {inCart.quantity}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart Section */}
          <div className="w-full lg:w-96 bg-white border-l border-gray-200 flex flex-col" style={{ maxHeight: 'calc(100vh - 64px)' }}>
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Cart
                </h2>
                <span className="badge-blue">{cartCount} items</span>
              </div>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-auto p-4">
              {cart.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-400 text-sm">Cart is empty</p>
                  <p className="text-gray-400 text-xs">Click items to add them</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.menu_item_id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">
                          {item.item_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          ₹{item.price} each
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.menu_item_id, -1)}
                          className="w-7 h-7 rounded-full bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-bold text-sm">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.menu_item_id, 1)}
                          className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">
                          ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                        </p>
                        <button
                          onClick={() => removeFromCart(item.menu_item_id)}
                          className="text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart Total & Checkout */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-gray-600 font-medium">Subtotal</span>
                  <span className="text-xl font-bold">
                    ₹{cartTotal.toLocaleString('en-IN')}
                  </span>
                </div>
                <button
                  onClick={placeOrder}
                  disabled={placing}
                  className="btn-success w-full flex items-center justify-center gap-2 py-3 text-lg"
                >
                  {placing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Placing Order...
                    </>
                  ) : (
                    <>
                      <Receipt className="w-5 h-5" />
                      Place Order - ₹{cartTotal.toLocaleString('en-IN')}
                    </>
                  )}
                </button>
                <button
                  onClick={() => setCart([])}
                  className="w-full mt-2 text-sm text-gray-500 hover:text-red-500 flex items-center justify-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Clear Cart
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
