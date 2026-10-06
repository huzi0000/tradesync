'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppSettings } from '../types';
import { DEFAULT_APP_SETTINGS } from '../lib/constants';

const STORAGE_KEY = 'tradesync:settings';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AppSettings>;
        setSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch {
      // Ignore parse errors
    }
    setIsLoaded(true);
  }, []);

  const update = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setSettings(DEFAULT_APP_SETTINGS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  return { settings, update, reset, isLoaded };
}
