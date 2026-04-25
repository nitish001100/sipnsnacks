'use client';

import { useState, useEffect, useCallback } from 'react';

export function useHideMoney() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('pos-hide-money');
    if (stored === 'true') setHidden(true);
  }, []);

  const toggle = useCallback(() => {
    setHidden((prev) => {
      const next = !prev;
      localStorage.setItem('pos-hide-money', String(next));
      return next;
    });
  }, []);

  const mask = useCallback(
    (amount: number | string) => {
      if (hidden) return '₹•••';
      const num = typeof amount === 'string' ? parseFloat(amount) : amount;
      return `₹${num.toLocaleString('en-IN')}`;
    },
    [hidden]
  );

  return { hidden, toggle, mask };
}
