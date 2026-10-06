'use client';

import { FC, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Wallet, Search, Users, BarChart2, Settings, X, Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/wallet', label: 'Wallet Intelligence', icon: Wallet },
  { href: '/tokens', label: 'Token Explorer', icon: Search },
  { href: '/rooms', label: 'Alpha Rooms', icon: Users },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

export const MobileNav: FC<MobileNavProps> = ({ open, onClose }) => {
  const pathname = usePathname();

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  useEffect(() => {
    onClose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <nav className="fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-[#DEDCD5] flex flex-col">
        <div className="flex items-center justify-between h-14 px-4 border-b border-[#DAD8D1] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-[#1B2428] flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="text-sm font-bold text-[#1B2428]">TradeSync</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-[#7D8A89] hover:bg-[#F3F0E9] transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded text-sm mb-0.5 transition-colors',
                  active
                    ? 'bg-[#E8E5DE] text-[#1B2428] font-medium'
                    : 'text-[#7D8A89] hover:bg-[#F3F0E9] hover:text-[#1B2428]'
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};
