'use client';

import { Eye, EyeOff } from 'lucide-react';

interface Props {
  hidden: boolean;
  toggle: () => void;
}

export default function HideMoneyToggle({ hidden, toggle }: Props) {
  return (
    <button
      onClick={toggle}
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
  );
}
