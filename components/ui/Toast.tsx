'use client';

import { cn } from '../../lib/utils';
import { Notification } from '../../types';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors = {
  success: 'border-[#C5DDD4] bg-white text-[#387B60]',
  error: 'border-[#EDCCC5] bg-white text-[#BA6249]',
  warning: 'border-[#EDE0C0] bg-white text-[#9B7B2B]',
  info: 'border-[#C8D8EE] bg-white text-[#3B6CA8]',
};

interface ToastProps {
  notification: Notification;
  onDismiss: (id: string) => void;
}

export function Toast({ notification, onDismiss }: ToastProps) {
  const Icon = icons[notification.type];
  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 border rounded-lg shadow-sm min-w-[260px] max-w-xs',
        colors[notification.type],
      )}
      role="alert"
    >
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[#1B2428] leading-tight">{notification.title}</p>
        {notification.message && (
          <p className="text-xs text-[#7D8A89] mt-0.5 leading-snug">{notification.message}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(notification.id)}
        className="shrink-0 text-[#7D8A89] hover:text-[#1B2428] transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer({ notifications, onDismiss }: { notifications: Notification[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {notifications.map(n => (
        <div key={n.id} className="pointer-events-auto">
          <Toast notification={n} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
