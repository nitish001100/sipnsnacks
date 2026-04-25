'use client';

import { useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  hidden: boolean;
  show: () => void;
  hide: () => void;
  isChef: boolean;
}

export default function HideMoneyToggle({ hidden, show, hide, isChef }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Chef users cannot see this toggle at all
  if (isChef) return null;

  const handleToggle = () => {
    if (hidden) {
      // Need password to show money
      setModalOpen(true);
      setPassword('');
    } else {
      // Can hide without password
      hide();
      toast.success('₹ amounts hidden');
    }
  };

  const handleUnlock = async () => {
    if (!password) return;
    setVerifying(true);
    try {
      const res = await fetch('/api/settings/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        show();
        setModalOpen(false);
        setPassword('');
        toast.success('₹ amounts visible');
      } else {
        toast.error('Wrong password');
      }
    } catch {
      toast.error('Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <>
      <button
        onClick={handleToggle}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
          hidden
            ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
        }`}
        title={hidden ? 'Show amounts' : 'Hide amounts'}
      >
        {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        {hidden ? '₹ Hidden' : '₹ Visible'}
      </button>

      {/* Password Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-7 h-7 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Show Amounts</h3>
              <p className="text-sm text-gray-500 mt-1">Enter settlement password</p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleUnlock(); }}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Settlement password"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none mb-4"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setModalOpen(false); setPassword(''); }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifying || !password}
                  className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  {verifying ? 'Checking...' : 'Show ₹'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
