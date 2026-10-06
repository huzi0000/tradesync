'use client';

import { FC } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Wallet,
  Search,
  Users,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
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

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col h-full bg-white border-r border-[#DEDCD5] transition-all duration-200',
        collapsed ? 'w-14' : 'w-56'
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center h-14 border-b border-[#DAD8D1] px-3 shrink-0', collapsed ? 'justify-center' : 'gap-2')}>
        <div className="w-7 h-7 rounded bg-[#1B2428] flex items-center justify-center shrink-0">
          <Zap size={14} className="text-white" />
        </div>
        {!collapsed && (
          <span className="text-sm font-bold text-[#1B2428] tracking-tight">TradeSync</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 flex flex-col gap-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-2 py-2 rounded text-sm transition-colors duration-100',
                active
                  ? 'bg-[#E8E5DE] text-[#1B2428] font-medium'
                  : 'text-[#7D8A89] hover:bg-[#F3F0E9] hover:text-[#1B2428]',
                collapsed && 'justify-center px-1'
              )}
              aria-label={collapsed ? label : undefined}
              title={collapsed ? label : undefined}
            >
              <Icon size={16} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="border-t border-[#DAD8D1] p-2">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center p-2 rounded text-[#7D8A89] hover:bg-[#F3F0E9] hover:text-[#1B2428] transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>
    </aside>
  );
};
