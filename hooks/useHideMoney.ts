'use client';

import { useState, useEffect, useCallback } from 'react';

function getUserRole(): string {
  if (typeof document === 'undefined') return 'admin';
  const match = document.cookie.match(/pos-user-role=([^;]+)/);
  return match ? match[1] : 'admin';
}

export function useHideMoney() {
  // Default: hidden (amounts masked until unlocked)
  const [hidden, setHidden] = useState(true);
  const [role, setRole] = useState('admin');

  useEffect(() => {
    setRole(getUserRole());
    // Chef always hidden, no localStorage check
    if (getUserRole() === 'chef') {
      setHidden(true);
      return;
    }
    const stored = localStorage.getItem('pos-hide-money');
    // Default to HIDDEN unless explicitly unlocked (set to 'false')
    setHidden(stored !== 'false');
  }, []);

  const show = useCallback(() => {
    if (getUserRole() === 'chef') return; // chef can never show
    setHidden(false);
    localStorage.setItem('pos-hide-money', 'false');
  }, []);

  const hide = useCallback(() => {
    setHidden(true);
    localStorage.setItem('pos-hide-money', 'true');
  }, []);

  const mask = useCallback(
    (amount: number | string) => {
      if (hidden) return '₹•••';
      const num = typeof amount === 'string' ? parseFloat(amount) : amount;
      return `₹${num.toLocaleString('en-IN')}`;
    },
    [hidden]
  );

  const isChef = role === 'chef';

  return { hidden, show, hide, mask, isChef };
}
