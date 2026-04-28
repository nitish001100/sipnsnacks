'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Search,
  Loader2,
  UtensilsCrossed,
  ShoppingBag,
  Plus,
  Minus,
  X,
  Trash2,
  Star,
} from 'lucide-react';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  available: boolean;
}

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

const WHATSAPP_NUMBER = '917054005885';

export default function PublicMenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showMobileCart, setShowMobileCart] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/menu');
      const data = await res.json();
      setItems(data.items);
    } catch {
      console.error('Failed to fetch menu');
    } finally {
      setLoading(false);
    }
  };

  const categories = Array.from(new Set(items.map((i) => i.category))).sort();

  const filteredItems = items.filter((item) => {
    const matchSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !filterCategory || item.category === filterCategory;
    return matchSearch && matchCategory;
  });

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.id === id) {
            const newQty = c.quantity + delta;
            return newQty > 0 ? { ...c, quantity: newQty } : null;
          }
          return c;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (id: number) => {
    setCart((prev) => prev.filter((c) => c.id !== id));
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  const buildWhatsAppMessage = () => {
    if (cart.length === 0) return '';
    let msg = '*New Order - Sip n Snacks*\n\n';
    msg += '*Order Details:*\n';
    cart.forEach((item, idx) => {
      msg += `${idx + 1}. ${item.name} x ${item.quantity} = Rs.${(item.price * item.quantity).toLocaleString('en-IN')}\n`;
    });
    msg += `\n*Total: Rs.${cartTotal.toLocaleString('en-IN')}*\n\n`;
    msg += 'Please confirm my order. Thank you!';
    return encodeURIComponent(msg);
  };

  const [ordering, setOrdering] = useState(false);

  const openWhatsApp = async () => {
    // First save order to DB as 'online'
    setOrdering(true);
    try {
      const orderItems = cart.map((c) => ({
        menu_item_id: c.id,
        item_name: c.name,
        quantity: c.quantity,
        price: c.price,
      }));

      await fetch('/api/orders/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: orderItems }),
      });
    } catch {
      // Still open WhatsApp even if DB save fails
    } finally {
      setOrdering(false);
    }

    // Then open WhatsApp
    const message = buildWhatsAppMessage();
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
    window.open(url, '_blank');
    setCart([]);
  };

  const openWhatsAppChat = () => {
    const msg = encodeURIComponent('Hi! I would like to place an order from Sip n Snacks.');
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, '_blank');
  };

  const groupedItems = categories.reduce((acc, cat) => {
    acc[cat] = filteredItems.filter((item) => item.category === cat);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  // Cart component (reused for desktop sidebar and mobile drawer)
  const CartContent = () => (
    <>
      {/* Cart Items */}
      <div className="flex-1 overflow-auto p-4">
        {cart.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="w-12 h-12 mx-auto text-white/15 mb-3" />
            <p className="text-white/40 text-sm">Your cart is empty</p>
            <p className="text-white/20 text-xs mt-1">Click items to add them</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{item.name}</p>
                  <p className="text-xs text-white/40">₹{item.price} each</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateQuantity(item.id, -1)}
                    className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-5 text-center font-bold text-white text-sm">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    className="w-6 h-6 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-white text-sm">₹{(item.price * item.quantity).toLocaleString('en-IN')}</p>
                  <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-300 mt-0.5">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart Footer */}
      {cart.length > 0 && (
        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-white/60 font-medium">Total</span>
            <span className="text-2xl font-bold text-white">₹{cartTotal.toLocaleString('en-IN')}</span>
          </div>
          <button
            onClick={openWhatsApp}
            className="w-full flex items-center justify-center gap-3 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 transition-all"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Order via WhatsApp
          </button>
          <button
            onClick={() => setCart([])}
            className="w-full text-xs text-white/30 hover:text-red-400 flex items-center justify-center gap-1 py-1"
          >
            <X className="w-3 h-3" />
            Clear Cart
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="h-screen flex flex-col bg-[#1B2E3C] relative">
      {/* Background Watermark Logo */}
      <div className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center" aria-hidden="true">
        <img
          src="/logo.png"
          alt=""
          className="w-[50vmin] h-[50vmin] max-w-[400px] max-h-[400px] object-contain opacity-[0.04]"
          style={{ filter: 'blur(2px) grayscale(30%)' }}
        />
      </div>

      {/* Header with centered logo */}
      <header className="shrink-0 bg-[#1B2E3C]/95 backdrop-blur-sm border-b border-white/10 px-4 py-3 relative z-10">
        <div className="flex items-center justify-between">
          {/* Mobile cart button - left placeholder for centering */}
          <div className="w-20 lg:w-0" />

          {/* Centered Logo + Title */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-white shrink-0 border-2 border-amber-400/50 shadow-lg shadow-amber-500/20">
              <Image src="/logo.png" alt="Sip n Snacks" width={56} height={56} className="w-full h-full object-contain" />
            </div>
            <h1 className="text-xl font-bold text-white">Menu</h1>
          </div>

          {/* Mobile cart button */}
          <div className="w-20 flex justify-end lg:hidden">
            <button
              onClick={() => setShowMobileCart(true)}
              className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium text-xs transition-all"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              Cart
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
          <div className="hidden lg:block w-0" />
        </div>
      </header>

      {/* Main Content: Menu Left + Cart Right */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Menu Section */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search & Filter */}
          <div className="shrink-0 p-4 pb-2 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search menu..."
                  className="w-full pl-9 pr-4 py-2 bg-white/10 border border-white/10 rounded-lg text-white placeholder-white/30 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm"
                />
              </div>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setFilterCategory('')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  !filterCategory
                    ? 'bg-amber-500 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/15'
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat === filterCategory ? '' : cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    filterCategory === cat
                      ? 'bg-amber-500 text-white'
                      : 'bg-white/10 text-white/60 hover:bg-white/15'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Items (scrollable) */}
          <div className="flex-1 overflow-auto p-4 pt-2">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-16">
                <UtensilsCrossed className="w-12 h-12 mx-auto text-white/15 mb-3" />
                <p className="text-white/40">No items found</p>
              </div>
            ) : (
              Object.entries(groupedItems).map(([category, categoryItems]) => {
                if (categoryItems.length === 0) return null;
                return (
                  <div key={category} className="mb-5">
                    <div className="flex items-center gap-2 mb-2.5">
                      <h3 className="text-sm font-bold text-amber-400">{category}</h3>
                      <div className="flex-1 h-px bg-amber-400/15" />
                      <span className="text-[10px] text-amber-400/40">{categoryItems.length}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                      {categoryItems.map((item) => {
                        const inCart = cart.find((c) => c.id === item.id);
                        return (
                          <button
                            key={item.id}
                            onClick={() => item.available && addToCart(item)}
                            disabled={!item.available}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              !item.available
                                ? 'opacity-40 bg-white/[0.02] border-white/5 cursor-not-allowed'
                                : inCart
                                  ? 'bg-amber-500/15 border-amber-500/30 hover:bg-amber-500/20'
                                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-1">
                              <p className="font-medium text-white text-sm leading-tight truncate flex-1">{item.name}</p>
                              {inCart && (
                                <span className="ml-1 shrink-0 bg-amber-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                                  {inCart.quantity}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-amber-400 text-sm">₹{item.price}</span>
                              {!item.available && (
                                <span className="text-[10px] text-red-400/70">Unavailable</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}

            {/* Footer */}
            {!loading && filteredItems.length > 0 && (
              <div className="border-t border-white/5 pt-6 pb-4 mt-4 text-center">
                <p className="text-white/25 text-xs">
                  Fresh, tasty, and made with love ❤️
                </p>
                <div className="flex items-center justify-center gap-0.5 mt-2">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
                  ))}
                  <span className="text-white/25 text-[10px] ml-1">Loved by our customers</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Cart Section (desktop) */}
        <div className="hidden lg:flex w-96 flex-col bg-[#162430] border-l border-white/10">
          {/* Cart Header */}
          <div className="shrink-0 p-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
                Your Order
              </h2>
              <span className="text-xs bg-white/10 text-white/60 px-2 py-0.5 rounded-full">{cartCount} items</span>
            </div>
          </div>
          <CartContent />
        </div>
      </div>

      {/* Mobile: Floating Cart Bar */}
      {cartCount > 0 && !showMobileCart && (
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-30">
          <button
            onClick={() => setShowMobileCart(true)}
            className="w-full flex items-center justify-between px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-2xl shadow-green-500/40 transition-all"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              <span className="font-semibold text-sm">{cartCount} item{cartCount > 1 ? 's' : ''}</span>
            </div>
            <span className="font-bold">₹{cartTotal.toLocaleString('en-IN')}</span>
          </button>
        </div>
      )}

      {/* Mobile: Cart Drawer */}
      {showMobileCart && (
        <>
          <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowMobileCart(false)} />
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#162430] rounded-t-3xl max-h-[80vh] flex flex-col animate-slideUp">
            <div className="shrink-0 flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
                Your Order
              </h3>
              <button onClick={() => setShowMobileCart(false)} className="p-1 hover:bg-white/10 rounded-lg">
                <X className="w-5 h-5 text-white/70" />
              </button>
            </div>
            <CartContent />
          </div>
        </>
      )}


      {/* Slide-up animation */}
      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
