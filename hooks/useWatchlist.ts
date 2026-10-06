'use client';

import { useState, useEffect, useCallback } from 'react';
import { WatchlistToken } from '../types';

const STORAGE_KEY = 'tradesync:watchlist';

export function useWatchlist() {
  const [tokens, setTokens] = useState<WatchlistToken[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setTokens(JSON.parse(stored) as WatchlistToken[]);
      }
    } catch {
      // Ignore parse errors
    }
    setIsLoaded(true);
  }, []);

  const save = useCallback((newTokens: WatchlistToken[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newTokens));
    } catch {
      // Ignore storage errors
    }
    setTokens(newTokens);
  }, []);

  const add = useCallback((token: Omit<WatchlistToken, 'addedAt'>) => {
    setTokens(prev => {
      if (prev.some(t => t.mint === token.mint)) return prev;
      const next = [...prev, { ...token, addedAt: Date.now() }];
      save(next);
      return next;
    });
  }, [save]);

  const remove = useCallback((mint: string) => {
    setTokens(prev => {
      const next = prev.filter(t => t.mint !== mint);
      save(next);
      return next;
    });
  }, [save]);

  const has = useCallback((mint: string) => tokens.some(t => t.mint === mint), [tokens]);

  return { tokens, add, remove, has, isLoaded };
}
