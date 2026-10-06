'use client';

import { FC, ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNav } from './MobileNav';
import { ToastContainer } from '../ui/Toast';
import { useNotifications } from '../../hooks/useNotifications';

interface AppShellProps {
  children: ReactNode;
}

export const AppShell: FC<AppShellProps> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { notifications, dismiss } = useNotifications();

  return (
    <div className="flex h-full min-h-screen bg-[#F3F0E9]">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(prev => !prev)}
      />
      <MobileNav
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          onMobileMenuToggle={() => setMobileNavOpen(true)}
          rpcConnected
        />
        <main className="flex-1 overflow-y-auto p-3 sm:p-5">
          {children}
        </main>
      </div>
      <ToastContainer notifications={notifications} onDismiss={dismiss} />
    </div>
  );
};
