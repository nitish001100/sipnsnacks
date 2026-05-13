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
  Phone,
  User,
} from 'lucide-react';
import BillTemplate from '@/components/BillTemplate';
import toast from 'react-hot-toast';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  available: boolean;
  has_variants: boolean;
  half_price: number | null;
  full_price: number | null;
}

interface CartItem {
  menu_item_id: number;
  item_name: string;
  price: number;
  quantity: number;
  variant?: string; // 'half' | 'full' | undefined
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
    variant?: string;
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
  const [variantPicker, setVariantPicker] = useState<MenuItem | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');
  const billRef = useRef<HTMLDivElement>(null);

  // Extract variant labels from category brackets e.g. "CHINESE (GRAVY/DRY)" → ["Gravy", "Dry"]
  const getVariantLabels = (category: string): [string, string] => {
    const match = category.match(/\(([^)]+)\)/);
    if (match) {
      const parts = match[1].split('/').map((s) => s.trim());
      if (parts.length === 2) {
        return [parts[0], parts[1]];
      }
    }
    return ['Half', 'Full'];
  };

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

  // Generate a unique cart key for variant items
  const getCartKey = (itemId: number, variant?: string) => {
    return variant ? `${itemId}-${variant}` : `${itemId}`;
  };

  const addToCart = (item: MenuItem, variant?: 'half' | 'full') => {
    const price = variant === 'half' ? item.half_price! : variant === 'full' ? item.full_price! : item.price;
    const labels = getVariantLabels(item.category);
    const variantLabel = variant === 'half' ? labels[0] : variant === 'full' ? labels[1] : '';
    const displayName = variant ? `${item.name} (${variantLabel})` : item.name;

    setCart((prev) => {
      const existing = prev.find(
        (c) => c.menu_item_id === item.id && c.variant === variant
      );
      if (existing) {
        return prev.map((c) =>
          c.menu_item_id === item.id && c.variant === variant
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [
        ...prev,
        {
          menu_item_id: item.id,
          item_name: displayName,
          price,
          quantity: 1,
          variant,
        },
      ];
    });
    toast.success(`${displayName} added`, { duration: 1000 });
    setVariantPicker(null);
  };

  const handleItemClick = (item: MenuItem) => {
    const cartInfo = getItemCartInfo(item.id);
    if (cartInfo.totalQty > 0) {
      // Remove all variants of this item from cart
      setCart((prev) => prev.filter((c) => c.menu_item_id !== item.id));
      return;
    }
    if (item.has_variants && item.half_price && item.full_price) {
      setVariantPicker(item);
    } else {
      addToCart(item);
    }
  };

  const updateQuantity = (menuItemId: number, variant: string | undefined, delta: number) => {
    setCart((prev) => {
      return prev
        .map((c) => {
          if (c.menu_item_id === menuItemId && c.variant === variant) {
            const newQty = c.quantity + delta;
            return newQty > 0 ? { ...c, quantity: newQty } : null;
          }
          return c;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (menuItemId: number, variant: string | undefined) => {
    setCart((prev) => prev.filter((c) => !(c.menu_item_id === menuItemId && c.variant === variant)));
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
        body: JSON.stringify({
          items: cart,
          customer_name: customerName.trim() || undefined,
          customer_whatsapp: customerWhatsapp.trim() || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCompletedOrder(data.order);
        setCart([]);
        setCustomerName('');
        setCustomerWhatsapp('');
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

  // Get total quantity of an item in cart (across all variants)
  const getItemCartInfo = (itemId: number) => {
    const entries = cart.filter((c) => c.menu_item_id === itemId);
    return {
      totalQty: entries.reduce((sum, e) => sum + e.quantity, 0),
      entries,
    };
  };

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
                  const cartInfo = getItemCartInfo(item.id);
                  const inCart = cartInfo.totalQty > 0;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item)}
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
                        {item.has_variants && item.half_price && item.full_price ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-gray-900">
                              ₹{item.half_price} / ₹{item.full_price}
                            </span>
                            <span className="text-[10px] text-gray-400">{getVariantLabels(item.category).join(' / ')}</span>
                          </div>
                        ) : (
                          <span className="font-bold text-gray-900">
                            ₹{item.price}
                          </span>
                        )}
                        {inCart && (
                          <span className="bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {cartInfo.totalQty}
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
                      key={getCartKey(item.menu_item_id, item.variant)}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">
                          {item.item_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          ₹{item.price} each
                          {item.variant && (
                            <span className="ml-1 inline-block bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-medium">
                              {item.variant === 'half' ? 'HALF' : 'FULL'}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.menu_item_id, item.variant, -1)}
                          className="w-7 h-7 rounded-full bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-bold text-sm">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.menu_item_id, item.variant, 1)}
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
                          onClick={() => removeFromCart(item.menu_item_id, item.variant)}
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

            {/* Customer Details & Checkout */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                {/* Customer Details */}
                <div className="mb-3 space-y-2">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Customer name (optional)"
                      className="input pl-9 py-2 text-sm w-full"
                    />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                    <input
                      type="tel"
                      value={customerWhatsapp}
                      onChange={(e) => setCustomerWhatsapp(e.target.value)}
                      placeholder="WhatsApp number (optional)"
                      maxLength={15}
                      className="input pl-9 py-2 text-sm w-full"
                    />
                  </div>
                </div>

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

        {/* Variant Picker Modal */}
        {variantPicker && (
          <>
            <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setVariantPicker(null)} />
            <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-gray-900">{variantPicker.name}</h3>
                <button onClick={() => setVariantPicker(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">Choose option:</p>
              {(() => {
                const labels = getVariantLabels(variantPicker.category);
                return (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => addToCart(variantPicker, 'half')}
                      className="p-4 rounded-xl border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-all text-center"
                    >
                      <p className="text-sm font-medium text-gray-700">{labels[0]}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">₹{variantPicker.half_price}</p>
                    </button>
                    <button
                      onClick={() => addToCart(variantPicker, 'full')}
                      className="p-4 rounded-xl border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all text-center"
                    >
                      <p className="text-sm font-medium text-gray-700">{labels[1]}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">₹{variantPicker.full_price}</p>
                    </button>
                  </div>
                );
              })()}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
