'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Search,
  Loader2,
  UtensilsCrossed,
  ShoppingBag,
  Plus,
  Minus,
  X,
  MessageCircle,
  ArrowLeft,
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
  const [showCart, setShowCart] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchItems();
    // Check if user is admin
    const match = document.cookie.match(/pos-user-role=([^;]+)/);
    if (match && match[1] === 'admin') {
      setIsAdmin(true);
    }
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
    let msg = '🛒 *New Order from Sip n Snacks Website*\n\n';
    msg += '📋 *Order Details:*\n';
    msg += '─────────────────\n';
    cart.forEach((item, idx) => {
      msg += `${idx + 1}. ${item.name} × ${item.quantity} = ₹${(item.price * item.quantity).toLocaleString('en-IN')}\n`;
    });
    msg += '─────────────────\n';
    msg += `💰 *Total: ₹${cartTotal.toLocaleString('en-IN')}*\n\n`;
    msg += '📍 Please confirm my order. Thank you! 🙏';
    return encodeURIComponent(msg);
  };

  const openWhatsApp = () => {
    const message = buildWhatsAppMessage();
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
    window.open(url, '_blank');
  };

  const openWhatsAppChat = () => {
    const msg = encodeURIComponent('Hi! I would like to place an order from Sip n Snacks. 🍽️');
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, '_blank');
  };

  const groupedItems = categories.reduce((acc, cat) => {
    acc[cat] = filteredItems.filter((item) => item.category === cat);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  return (
    <div className="min-h-screen relative">
      {/* Beautiful Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1B2E3C] via-[#1B2E3C]/95 to-amber-900/80" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-[#1B2E3C]/95 backdrop-blur-md border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-white shrink-0">
                  <Image src="/logo.png" alt="Sip n Snacks" width={40} height={40} className="w-full h-full object-contain" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">Sip n Snacks</h1>
                  <p className="text-[10px] text-amber-300/70 tracking-wider uppercase">Cafe · Refreshments · Bites</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Admin
                  </Link>
                )}
                <button
                  onClick={() => setShowCart(true)}
                  className="relative flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white font-medium text-sm transition-all"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span className="hidden sm:inline">Cart</span>
                  {cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                      {cartCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <div className="max-w-7xl mx-auto px-4 pt-8 pb-4">
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <div className="w-24 h-24 rounded-full border-2 border-amber-400/50 p-1 bg-white/5 backdrop-blur-sm mx-auto">
                <div className="w-full h-full rounded-full overflow-hidden relative">
                  <Image src="/logo.png" alt="Sip n Snacks" fill className="object-cover" />
                </div>
              </div>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2">Our Menu</h2>
            <p className="text-amber-200/60 text-sm max-w-md mx-auto">
              Browse our delicious offerings and order directly via WhatsApp. Fresh, tasty, and made with love! ❤️
            </p>
            <div className="flex items-center justify-center gap-1 mt-3">
              {[1,2,3,4,5].map(i => (
                <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
              ))}
              <span className="text-amber-300/60 text-xs ml-1">Loved by our customers</span>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6 max-w-2xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search menu items..."
                className="w-full pl-10 pr-4 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-sm"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setFilterCategory('')}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  !filterCategory
                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat === filterCategory ? '' : cat)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    filterCategory === cat
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="max-w-7xl mx-auto px-4 pb-32">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-16">
              <UtensilsCrossed className="w-16 h-16 mx-auto text-white/20 mb-4" />
              <p className="text-white/50 text-lg">No items found</p>
              <p className="text-white/30 text-sm mt-1">Try a different search term</p>
            </div>
          ) : (
            Object.entries(groupedItems).map(([category, categoryItems]) => {
              if (categoryItems.length === 0) return null;
              return (
                <div key={category} className="mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-lg font-bold text-amber-400">{category}</h3>
                    <div className="flex-1 h-px bg-amber-400/20" />
                    <span className="text-xs text-amber-400/50">{categoryItems.length} items</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {categoryItems.map((item) => {
                      const inCart = cart.find((c) => c.id === item.id);
                      return (
                        <div
                          key={item.id}
                          className={`group relative p-4 rounded-2xl border transition-all duration-300 ${
                            !item.available
                              ? 'opacity-50 bg-white/[0.02] border-white/5'
                              : inCart
                                ? 'bg-amber-500/15 border-amber-500/40 shadow-lg shadow-amber-500/10 hover:scale-[1.02]'
                                : 'bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 hover:border-white/20 hover:scale-[1.02]'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-white text-sm truncate">{item.name}</h4>
                              <p className="text-xs text-white/40 mt-0.5">{item.category}</p>
                            </div>
                            <span className={`shrink-0 ml-2 w-2 h-2 rounded-full mt-1.5 ${item.available ? 'bg-green-400' : 'bg-red-400'}`} />
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <span className="text-lg font-bold text-amber-400">₹{item.price}</span>
                            {!item.available ? (
                              <span className="text-xs text-red-400/70 font-medium">Unavailable</span>
                            ) : inCart ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => updateQuantity(item.id, -1)}
                                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-6 text-center font-bold text-white text-sm">{inCart.quantity}</span>
                                <button
                                  onClick={() => updateQuantity(item.id, 1)}
                                  className="w-7 h-7 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => addToCart(item)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-white text-xs font-medium transition-all"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Add
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Floating WhatsApp Chat Button */}
        <button
          onClick={openWhatsAppChat}
          className="fixed bottom-6 left-6 z-40 w-14 h-14 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-2xl shadow-green-500/40 flex items-center justify-center transition-all hover:scale-110"
          title="Chat with us on WhatsApp"
        >
          <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </button>

        {/* Floating Cart Bar (when items in cart) */}
        {cartCount > 0 && !showCart && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-3rem)] max-w-lg">
            <button
              onClick={() => setShowCart(true)}
              className="w-full flex items-center justify-between px-5 py-3.5 bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-2xl shadow-green-500/40 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <span className="font-semibold">{cartCount} item{cartCount > 1 ? 's' : ''} added</span>
              </div>
              <span className="font-bold text-lg">₹{cartTotal.toLocaleString('en-IN')}</span>
            </button>
          </div>
        )}

        {/* Cart Drawer */}
        {showCart && (
          <>
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowCart(false)} />
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#1B2E3C] rounded-t-3xl max-h-[85vh] flex flex-col animate-slideUp">
              {/* Cart Header */}
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-amber-400" />
                  Your Order
                </h3>
                <button onClick={() => setShowCart(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-white/70" />
                </button>
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-auto p-5 space-y-3">
                {cart.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingBag className="w-12 h-12 mx-auto text-white/20 mb-3" />
                    <p className="text-white/40">Your cart is empty</p>
                    <p className="text-white/20 text-sm mt-1">Add items from the menu</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white text-sm truncate">{item.name}</p>
                        <p className="text-xs text-white/40">₹{item.price} each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-bold text-white text-sm">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-7 h-7 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-right ml-2">
                        <p className="font-bold text-white text-sm">₹{(item.price * item.quantity).toLocaleString('en-IN')}</p>
                        <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-300">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Cart Footer */}
              {cart.length > 0 && (
                <div className="p-5 border-t border-white/10 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white/60 font-medium">Total</span>
                    <span className="text-2xl font-bold text-white">₹{cartTotal.toLocaleString('en-IN')}</span>
                  </div>
                  <button
                    onClick={openWhatsApp}
                    className="w-full flex items-center justify-center gap-3 py-3.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 transition-all text-lg"
                  >
                    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    Order via WhatsApp
                  </button>
                  <button
                    onClick={() => setCart([])}
                    className="w-full text-sm text-white/40 hover:text-red-400 flex items-center justify-center gap-1 py-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    Clear Cart
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

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
