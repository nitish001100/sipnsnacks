'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`Welcome back, ${data.user.username}!`);
        router.push('/dashboard');
      } else {
        toast.error(data.error || 'Login failed');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden">
      {/* Blurry Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/logo.png"
          alt="Background"
          fill
          className="object-cover scale-150 blur-3xl opacity-40"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#1B2E3C]/90 via-[#1B2E3C]/80 to-amber-900/60" />
      </div>

      {/* Content */}
      <div className="w-full max-w-md relative z-10">
        {/* Logo Banner */}
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <div className="w-44 h-44 rounded-full border-4 border-amber-400 p-2 bg-white/10 backdrop-blur-sm" style={{ boxShadow: '0 8px 32px rgba(245, 176, 65, 0.35)' }}>
              <div className="w-full h-full rounded-full overflow-hidden relative">
                <Image
                  src="/logo.png"
                  alt="Sip n Snacks"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white">Sip n Snacks</h1>
          <p className="text-amber-200/80 mt-1 text-sm tracking-wider uppercase">
            Cafe · Refreshments · Bites
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
          <h2 className="text-xl font-bold text-[#1B2E3C] mb-1">Welcome Back</h2>
          <p className="text-gray-500 text-sm mb-6">Sign in to manage your cafe</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                placeholder="Enter username"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#F5B041] hover:bg-amber-500 text-[#1B2E3C] font-bold py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
