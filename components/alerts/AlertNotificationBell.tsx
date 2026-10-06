'use client';

import { FC, useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, RefreshCw, AlertTriangle, Info, X } from 'lucide-react';
import { useAlerts } from '../../hooks/useAlerts';
import { formatTimeAgo } from '../../lib/utils';

export const AlertNotificationBell: FC = () => {
  const { history, unreadCount, markAllAsRead, clearHistory, runManualCheck, isEvaluating } = useAlerts();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 rounded text-[#7D8A89] hover:bg-[#F3F0E9] hover:text-[#1B2428] transition-colors"
        aria-label="Alert notifications"
        title="On-Chain Alert Notifications"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-[#BA6249] text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#DEDCD5] rounded-lg shadow-lg z-50 overflow-hidden text-[#1B2428]">
          <div className="flex items-center justify-between p-3 border-b border-[#DAD8D1] bg-[#F8F7F4]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#1B2428]">
                On-Chain Alerts
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-[#BA6249] text-white">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => runManualCheck()}
                disabled={isEvaluating}
                className="p-1 rounded text-[#7D8A89] hover:text-[#1B2428] hover:bg-[#E8E5DE] transition-colors"
                title="Run manual alert check"
              >
                <RefreshCw size={13} className={isEvaluating ? 'animate-spin' : ''} />
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="p-1 rounded text-[#7D8A89] hover:text-[#1B2428] hover:bg-[#E8E5DE] transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck size={13} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded text-[#7D8A89] hover:text-[#1B2428] hover:bg-[#E8E5DE] transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-[#DAD8D1]">
            {history.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <Info size={20} className="mx-auto text-[#7D8A89] mb-2" />
                <p className="text-xs font-medium text-[#1B2428]">No alerts triggered yet</p>
                <p className="text-[11px] text-[#7D8A89] mt-1">
                  Active rules are periodically evaluating tracked wallets and token thresholds.
                </p>
              </div>
            ) : (
              history.slice(0, 15).map(alert => (
                <div
                  key={alert.id}
                  className={`p-3 transition-colors ${alert.isRead ? 'bg-white' : 'bg-[#FAF8F5]'}`}
                >
                  <div className="flex items-start gap-2">
                    {alert.severity === 'warning' || alert.severity === 'critical' ? (
                      <AlertTriangle size={14} className="text-[#BA6249] shrink-0 mt-0.5" />
                    ) : (
                      <Info size={14} className="text-[#387B60] shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-semibold text-[#1B2428] truncate">{alert.title}</p>
                        <span className="text-[10px] text-[#7D8A89] shrink-0">
                          {formatTimeAgo(alert.triggeredAt / 1000)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#7D8A89] mt-0.5 leading-relaxed">{alert.message}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {history.length > 0 && (
            <div className="p-2 border-t border-[#DAD8D1] bg-[#F8F7F4] flex justify-between items-center text-[11px]">
              <span className="text-[#7D8A89]">Auto-polled every 60s</span>
              <button
                onClick={clearHistory}
                className="text-[#BA6249] hover:underline font-medium"
              >
                Clear History
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
