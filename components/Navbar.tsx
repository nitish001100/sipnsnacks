'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingCart,
  BarChart3,
  LogOut,
  Menu,
  X,
  Coffee,
} from 'lucide-react';
import toast from 'react-hot-toast';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/menu', label: 'Menu', icon: UtensilsCrossed },
  { href: '/checkout', label: 'Checkout', icon: ShoppingCart },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.success('Logged out successfully');
      router.push('/login');
    } catch {
      toast.error('Failed to logout');
    }
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-[#1B2E3C] text-white min-h-screen fixed left-0 top-0 z-40">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[#2a4a5c]">
          <div className="w-10 h-10 rounded-full bg-[#F5B041] flex items-center justify-center">
            <Coffee className="w-5 h-5 text-[#1B2E3C]" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Sip n Snacks</h1>
            <p className="text-xs text-amber-300/70">Cafe · Refreshments · Bites</p>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
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

        {/* Logout */}
        <div className="px-4 py-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-300 hover:bg-red-600/20 hover:text-red-400 transition-all duration-200 w-full"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#1B2E3C] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#F5B041] flex items-center justify-center">
            <Coffee className="w-4 h-4 text-[#1B2E3C]" />
          </div>
          <span className="font-bold">Sip n Snacks</span>
        </div>
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
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[#2a4a5c]">
          <div className="w-10 h-10 rounded-full bg-[#F5B041] flex items-center justify-center">
            <Coffee className="w-5 h-5 text-[#1B2E3C]" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Sip n Snacks</h1>
            <p className="text-xs text-amber-300/70">Cafe · Refreshments · Bites</p>
          </div>
        </div>
        <nav className="px-4 py-6 space-y-1">
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
    </>
  );
}
