'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import {
  IndianRupee,
  ShoppingBag,
  Package,
  TrendingUp,
  Lock,
  Loader2,
  Download,
  Mail,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface DailySummary {
  date: string;
  total_orders: number;
  total_revenue: number;
  items_sold: number;
}

interface AllTime {
  total_revenue: number;
  total_orders: number;
  total_items: number;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [allTime, setAllTime] = useState<AllTime | null>(null);
  const [loading, setLoading] = useState(true);
  const [earningsUnlocked, setEarningsUnlocked] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [settlementModal, setSettlementModal] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settlePassword, setSettlePassword] = useState('');
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    fetchBasicSummary();
  }, []);

  const fetchBasicSummary = async () => {
    try {
      const res = await fetch(`/api/reports/daily?date=${today}`);
      const data = await res.json();
      // Only store order count, not revenue (that's hidden)
      setSummary(data.summary);
    } catch {
      toast.error('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const unlockEarnings = async () => {
    if (!password) return;
    setVerifying(true);
    try {
      const res = await fetch('/api/settings/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) {
        setEarningsUnlocked(true);
        setSummary(data.today);
        setAllTime(data.allTime);
        setPasswordModal(false);
        setPassword('');
        toast.success('Earnings unlocked!');
      } else {
        toast.error(data.error || 'Invalid password');
      }
    } catch {
      toast.error('Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleSettlement = async () => {
    if (!settlePassword) return;
    setSettling(true);
    try {
      const res = await fetch('/api/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: settlePassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Settlement email sent!');
        setSettlementModal(false);
        setSettlePassword('');
      } else {
        toast.error(data.error || 'Settlement failed');
      }
    } catch {
      toast.error('Failed to send settlement');
    } finally {
      setSettling(false);
    }
  };

  const handleExport = () => {
    window.open(`/api/reports/export?date=${today}`, '_blank');
    toast.success('Downloading Excel report...');
  };

  return (
    <div className="flex min-h-screen">
      <Navbar />
      <main className="flex-1 md:ml-64 p-6 pt-16 md:pt-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">☕ Sip n Snacks</h1>
            <p className="text-gray-500 mt-1">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <div className="flex gap-3 mt-4 sm:mt-0">
            <button
              onClick={handleExport}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={() => setSettlementModal(true)}
              className="bg-[#1B2E3C] hover:bg-[#2a4a5c] text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2 text-sm"
            >
              <Mail className="w-4 h-4" />
              Settle Day
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : (
          <>
            {/* Today's Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Revenue - Hidden */}
              <div className="card hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Today&apos;s Revenue</p>
                    {earningsUnlocked ? (
                      <p className="text-2xl font-bold mt-1 text-green-700">
                        ₹{summary?.total_revenue.toLocaleString('en-IN')}
                      </p>
                    ) : (
                      <button
                        onClick={() => setPasswordModal(true)}
                        className="flex items-center gap-1.5 mt-1 text-gray-400 hover:text-amber-600 transition-colors"
                      >
                        <Lock className="w-4 h-4" />
                        <span className="text-sm font-medium">Tap to unlock</span>
                      </button>
                    )}
                  </div>
                  <div className="bg-green-50 p-3 rounded-xl">
                    <IndianRupee className="w-6 h-6 text-green-700" />
                  </div>
                </div>
              </div>

              {/* Orders - Visible */}
              <div className="card hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Today&apos;s Orders</p>
                    <p className="text-2xl font-bold mt-1 text-amber-700">
                      {summary?.total_orders ?? '...'}
                    </p>
                  </div>
                  <div className="bg-amber-50 p-3 rounded-xl">
                    <ShoppingBag className="w-6 h-6 text-amber-700" />
                  </div>
                </div>
              </div>

              {/* Items Sold - Visible */}
              <div className="card hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Items Sold</p>
                    <p className="text-2xl font-bold mt-1 text-purple-700">
                      {summary?.items_sold ?? '...'}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-xl">
                    <Package className="w-6 h-6 text-purple-700" />
                  </div>
                </div>
              </div>

              {/* All-Time Revenue - Hidden */}
              <div className="card hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">All-Time Revenue</p>
                    {earningsUnlocked && allTime ? (
                      <p className="text-2xl font-bold mt-1 text-orange-700">
                        ₹{allTime.total_revenue.toLocaleString('en-IN')}
                      </p>
                    ) : (
                      <button
                        onClick={() => setPasswordModal(true)}
                        className="flex items-center gap-1.5 mt-1 text-gray-400 hover:text-amber-600 transition-colors"
                      >
                        <Lock className="w-4 h-4" />
                        <span className="text-sm font-medium">Tap to unlock</span>
                      </button>
                    )}
                  </div>
                  <div className="bg-orange-50 p-3 rounded-xl">
                    <TrendingUp className="w-6 h-6 text-orange-700" />
                  </div>
                </div>
              </div>
            </div>

            {/* Lock/Unlock Toggle */}
            {earningsUnlocked && (
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => { setEarningsUnlocked(false); setAllTime(null); }}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-500 transition-colors"
                >
                  <EyeOff className="w-4 h-4" />
                  Hide earnings
                </button>
              </div>
            )}

            {/* Quick Actions */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <a
                  href="/checkout"
                  className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-all"
                >
                  <ShoppingBag className="w-8 h-8 text-amber-500" />
                  <div>
                    <p className="font-semibold text-gray-800">New Order</p>
                    <p className="text-sm text-gray-500">Start a new checkout</p>
                  </div>
                </a>
                <a
                  href="/menu"
                  className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all"
                >
                  <Package className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="font-semibold text-gray-800">Manage Menu</p>
                    <p className="text-sm text-gray-500">Add or edit items</p>
                  </div>
                </a>
                <a
                  href="/reports"
                  className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition-all"
                >
                  <TrendingUp className="w-8 h-8 text-purple-500" />
                  <div>
                    <p className="font-semibold text-gray-800">View Reports</p>
                    <p className="text-sm text-gray-500">Sales & analytics</p>
                  </div>
                </a>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Password Modal - Unlock Earnings */}
      {passwordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPasswordModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-7 h-7 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Unlock Earnings</h3>
              <p className="text-sm text-gray-500 mt-1">Enter settlement password to view</p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); unlockEarnings(); }}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Settlement password"
                className="input mb-4"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setPasswordModal(false); setPassword(''); }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifying || !password}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  {verifying ? 'Verifying...' : 'Unlock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settlement Modal */}
      {settlementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSettlementModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-full bg-[#1B2E3C] flex items-center justify-center mx-auto mb-3">
                <Mail className="w-7 h-7 text-[#F5B041]" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Day Settlement</h3>
              <p className="text-sm text-gray-500 mt-1">Send today&apos;s report via email</p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSettlement(); }}>
              <input
                type="password"
                value={settlePassword}
                onChange={(e) => setSettlePassword(e.target.value)}
                placeholder="Settlement password"
                className="input mb-4"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setSettlementModal(false); setSettlePassword(''); }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settling || !settlePassword}
                  className="bg-[#1B2E3C] hover:bg-[#2a4a5c] text-white font-medium py-2 px-4 rounded-lg transition-colors flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {settling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  {settling ? 'Sending...' : 'Send & Settle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
