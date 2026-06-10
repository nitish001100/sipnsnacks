'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingCart,
  ChefHat,
  BarChart3,
  LogOut,
  Menu,
  X,
  Download,
  Mail,
  Trash2,
  Package,
  Globe,
  Warehouse,
  PackagePlus,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const allNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin'], exact: false },
  { href: '/orders', label: 'Orders', icon: Package, roles: ['admin'], exact: false },
  { href: '/menu/manage', label: 'Menu Manage', icon: UtensilsCrossed, roles: ['admin'], exact: false },
  { href: '/checkout', label: 'Checkout', icon: ShoppingCart, roles: ['admin'], exact: false },
  { href: '/kitchen', label: 'Kitchen', icon: ChefHat, roles: ['admin', 'chef'], exact: false },
  { href: '/inventory', label: 'Inventory', icon: Warehouse, roles: ['admin'], exact: true },
  { href: '/inventory/restock', label: 'Stock Add Up', icon: PackagePlus, roles: ['admin'], exact: false },
  { href: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin'], exact: false },
  { href: '/menu', label: 'Public Menu', icon: Globe, roles: ['admin'], exact: true },
];

function getUserRole(): string {
  if (typeof document === 'undefined') return 'admin';
  const match = document.cookie.match(/pos-user-role=([^;]+)/);
  return match ? match[1] : 'admin';
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [role, setRole] = useState('admin');

  // Hide money state
  const [moneyHidden, setMoneyHidden] = useState(true);
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [pwVerifying, setPwVerifying] = useState(false);

  useEffect(() => {
    setRole(getUserRole());
    // Load hide money state from localStorage
    const stored = localStorage.getItem('pos-hide-money');
    setMoneyHidden(stored !== 'false');
  }, []);

  const toggleMoney = () => {
    if (moneyHidden) {
      setShowPwModal(true);
      setPwInput('');
    } else {
      setMoneyHidden(true);
      localStorage.setItem('pos-hide-money', 'true');
      window.dispatchEvent(new Event('storage'));
      toast.success('₹ amounts hidden');
    }
  };

  const handlePwUnlock = async () => {
    if (!pwInput) return;
    setPwVerifying(true);
    // Try API first, fallback to local check
    try {
      const res = await fetch('/api/settings/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwInput }),
      });
      if (res.ok) {
        setMoneyHidden(false);
        localStorage.setItem('pos-hide-money', 'false');
        window.dispatchEvent(new Event('storage'));
        setShowPwModal(false);
        setPwInput('');
        toast.success('₹ amounts visible');
        setPwVerifying(false);
        return;
      }
    } catch { /* fallback below */ }
    // Local fallback for visibility toggle
    if (pwInput === 'settle@123') {
      setMoneyHidden(false);
      localStorage.setItem('pos-hide-money', 'false');
      window.dispatchEvent(new Event('storage'));
      setShowPwModal(false);
      setPwInput('');
      toast.success('₹ amounts visible');
    } else {
      toast.error('Wrong password');
    }
    setPwVerifying(false);
  };

  const navItems = allNavItems.filter((item) => item.roles.includes(role));

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      // Clear role cookie
      document.cookie = 'pos-user-role=; path=/; max-age=0';
      toast.success('Logged out successfully');
      router.push('/login');
    } catch {
      toast.error('Failed to logout');
    }
  };

  const roleLabel = role === 'chef' ? 'Chef' : 'Admin';

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-[#1B2E3C] text-white min-h-screen fixed left-0 top-0 z-40">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-3 px-6 py-5 border-b border-[#2a4a5c] hover:bg-[#2a4a5c] transition-colors">
          <div className="w-11 h-11 shrink-0 rounded-full overflow-hidden bg-white">
            <Image src="/logo.png" alt="Sip n Snacks" width={44} height={44} className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Sip n Snacks</h1>
            <p className="text-xs text-amber-300/70">Cafe · Refreshments · Bites</p>
          </div>
        </Link>

        {/* Role Badge */}
        <div className="px-6 pt-4 pb-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            role === 'chef'
              ? 'bg-orange-500/20 text-orange-300'
              : 'bg-amber-500/20 text-amber-300'
          }`}>
            {role === 'chef' ? <ChefHat className="w-3.5 h-3.5" /> : <LayoutDashboard className="w-3.5 h-3.5" />}
            {roleLabel}
          </span>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-[#F5B041] text-[#1B2E3C] shadow-lg shadow-amber-500/30'
                    : 'text-slate-300 hover:bg-[#2a4a5c] hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Admin Actions */}
        {role === 'admin' && (
          <div className="px-4 py-3 border-t border-[#2a4a5c] space-y-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider px-4 mb-1">Actions</p>
            <button
              onClick={toggleMoney}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all w-full ${
                moneyHidden
                  ? 'text-slate-400 hover:bg-[#2a4a5c] hover:text-white'
                  : 'text-emerald-400 hover:bg-emerald-600/10'
              }`}
            >
              {moneyHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {moneyHidden ? '₹ Show Amounts' : '₹ Hide Amounts'}
            </button>
            <button
              onClick={() => {
                const today = format(new Date(), 'yyyy-MM-dd');
                window.open(`/api/reports/export?date=${today}`, '_blank');
                toast.success('Downloading...');
              }}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-[#2a4a5c] hover:text-white transition-all w-full"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('pos-action', { detail: 'settle' }))}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-[#2a4a5c] hover:text-white transition-all w-full"
            >
              <Mail className="w-4 h-4" />
              Settle Day
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('pos-action', { detail: 'reset' }))}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-red-600/10 hover:text-red-400 transition-all w-full"
            >
              <Trash2 className="w-4 h-4" />
              Reset Data
            </button>
          </div>
        )}

        {/* Logout */}
        <div className="px-4 py-3 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-red-600/20 hover:text-red-400 transition-all duration-200 w-full"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#1B2E3C] text-white px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 shrink-0 rounded-full overflow-hidden bg-white">
            <Image src="/logo.png" alt="SNS" width={32} height={32} className="w-full h-full object-contain" />
          </div>
          <span className="font-bold">Sip n Snacks</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            role === 'chef' ? 'bg-orange-500/30 text-orange-300' : 'bg-amber-500/30 text-amber-300'
          }`}>{roleLabel}</span>
        </Link>
        <button onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Menu */}
      <div
        className={`md:hidden fixed top-0 left-0 bottom-0 z-50 w-64 bg-[#1B2E3C] text-white transform transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-6 py-5 border-b border-[#2a4a5c] hover:bg-[#2a4a5c] transition-colors">
          <div className="w-11 h-11 shrink-0 rounded-full overflow-hidden bg-white">
            <Image src="/logo.png" alt="Sip n Snacks" width={44} height={44} className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Sip n Snacks</h1>
            <p className="text-xs text-amber-300/70">Cafe · Refreshments · Bites</p>
          </div>
        </Link>
        <div className="px-6 pt-4 pb-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            role === 'chef'
              ? 'bg-orange-500/20 text-orange-300'
              : 'bg-amber-500/20 text-amber-300'
          }`}>
            {role === 'chef' ? <ChefHat className="w-3.5 h-3.5" /> : <LayoutDashboard className="w-3.5 h-3.5" />}
            {roleLabel}
          </span>
        </div>
        <nav className="px-4 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#F5B041] text-[#1B2E3C]'
                    : 'text-slate-300 hover:bg-[#2a4a5c]'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-300 hover:bg-red-600/20 hover:text-red-400 w-full"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </div>

      {/* Password Modal for Show Amounts */}
      {showPwModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setShowPwModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-7 h-7 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Show Amounts</h3>
              <p className="text-sm text-gray-500 mt-1">Enter settlement password</p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handlePwUnlock(); }}>
              <input
                type="password"
                value={pwInput}
                onChange={(e) => setPwInput(e.target.value)}
                placeholder="Settlement password"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none mb-4 text-gray-900"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowPwModal(false); setPwInput(''); }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwVerifying || !pwInput}
                  className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {pwVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  {pwVerifying ? 'Checking...' : 'Show ₹'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
