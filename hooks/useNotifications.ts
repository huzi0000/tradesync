'use client';

import { useState, useCallback } from 'react';
import { Notification } from '../types';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const add = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    const n: Notification = { ...notification, id, duration: notification.duration ?? 5000 };
    setNotifications(prev => [...prev, n]);

    if (n.duration && n.duration > 0) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(x => x.id !== id));
      }, n.duration);
    }

    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const success = useCallback((title: string, message?: string) =>
    add({ type: 'success', title, message }), [add]);

  const error = useCallback((title: string, message?: string) =>
    add({ type: 'error', title, message, duration: 8000 }), [add]);

  const info = useCallback((title: string, message?: string) =>
    add({ type: 'info', title, message }), [add]);

  const warning = useCallback((title: string, message?: string) =>
    add({ type: 'warning', title, message }), [add]);

  return { notifications, add, dismiss, success, error, info, warning };
}
