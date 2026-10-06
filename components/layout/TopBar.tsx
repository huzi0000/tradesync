'use client';

import { FC } from 'react';
import { usePathname } from 'next/navigation';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Menu, Wifi, WifiOff } from 'lucide-react';
import { AuthStatusButton } from '../auth/AuthStatusButton';
import { AlertNotificationBell } from '../alerts/AlertNotificationBell';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/wallet': 'Wallet Intelligence',
  '/tokens': 'Token Explorer',
  '/rooms': 'Alpha Rooms',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
};

interface TopBarProps {
  onMobileMenuToggle: () => void;
  rpcConnected?: boolean;
}

export const TopBar: FC<TopBarProps> = ({ onMobileMenuToggle, rpcConnected = true }) => {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? 'TradeSync';

  return (
    <header className="h-14 bg-white border-b border-[#DEDCD5] flex items-center px-3 sm:px-4 gap-2 sm:gap-3 shrink-0">
      {/* Mobile menu button */}
      <button
        onClick={onMobileMenuToggle}
        className="lg:hidden p-1.5 rounded text-[#7D8A89] hover:bg-[#F3F0E9] hover:text-[#1B2428] transition-colors shrink-0"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-xs sm:text-sm font-semibold text-[#1B2428] truncate">{title}</h1>
      </div>

      {/* Network status */}
      <div className="flex items-center gap-1.5 shrink-0">
        {rpcConnected ? (
          <>
            <Wifi size={13} className="text-[#387B60]" />
            <span className="hidden md:inline text-xs text-[#7D8A89]">Mainnet</span>
          </>
        ) : (
          <>
            <WifiOff size={13} className="text-[#BA6249]" />
            <span className="hidden md:inline text-xs text-[#BA6249]">Disconnected</span>
          </>
        )}
      </div>

      {/* SIWS Wallet Ownership Verification */}
      <div className="shrink-0">
        <AuthStatusButton />
      </div>

      {/* On-Chain Alert Bell with unread badge */}
      <div className="shrink-0">
        <AlertNotificationBell />
      </div>

      {/* Solana Wallet Adapter connect button */}
      <div className="shrink-0 max-w-[130px] sm:max-w-none">
        <WalletMultiButton style={{ height: '32px', fontSize: '11px', padding: '0 8px', borderRadius: '6px' }} />
      </div>
    </header>
  );
};
