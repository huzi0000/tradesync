'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrackedWallet } from '../types';
import { isValidSolanaAddress } from '../lib/utils';

const STORAGE_KEY = 'tradesync:tracked_wallets';

// Default curated public Solana intelligence wallets to demonstrate live tracking out of the box
const DEFAULT_CURATED_WALLETS: TrackedWallet[] = [
  {
    id: 'curated-1',
    address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    label: 'Binance Hot Wallet',
    category: 'Market Maker',
    notes: 'Major institutional liquidity router and exchange settlement wallet.',
    addedAt: Date.now() - 86400000,
    isOwnerVerified: false,
    colorTag: '#3B6CA8',
  },
  {
    id: 'curated-2',
    address: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
    label: 'Jupiter Aggregator v6',
    category: 'Alpha Caller',
    notes: 'Core Jupiter routing contract. High volume swap transactions.',
    addedAt: Date.now() - 43200000,
    isOwnerVerified: false,
    colorTag: '#387B60',
  },
];

export function useTrackedWallets(currentConnectedAddress?: string | null) {
  const [wallets, setWallets] = useState<TrackedWallet[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from persistent storage on mount + server API if authenticated
  useEffect(() => {
    let isMounted = true;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as TrackedWallet[];
        setWallets(parsed);
      } else {
        setWallets(DEFAULT_CURATED_WALLETS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CURATED_WALLETS));
      }
    } catch {
      setWallets(DEFAULT_CURATED_WALLETS);
    }
    setIsLoaded(true);

    // Fetch from server API
    fetch('/api/wallets/tracked')
      .then((res) => res.json())
      .then((data) => {
        if (data.wallets && data.wallets.length > 0 && isMounted) {
          // Merge with curated defaults
          setWallets((prev) => {
            const merged = [...data.wallets];
            for (const p of prev) {
              if (!merged.some((m) => m.address === p.address)) {
                merged.push(p);
              }
            }
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [currentConnectedAddress]);

  const save = useCallback((newWallets: TrackedWallet[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newWallets));
    } catch {
      // Ignore storage errors
    }
    setWallets(newWallets);
  }, []);

  const addWallet = useCallback(async (
    address: string,
    label: string,
    category?: TrackedWallet['category'],
    notes?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const trimmed = address.trim();
    if (!isValidSolanaAddress(trimmed)) {
      return { success: false, error: 'Invalid Solana base58 public address.' };
    }

    if (wallets.some((w) => w.address === trimmed)) {
      return { success: false, error: 'This wallet is already in your tracking watchlist.' };
    }

    const isConnectedUser = currentConnectedAddress === trimmed;

    let newWallet: TrackedWallet = {
      id: `wallet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      address: trimmed,
      label: label.trim() || `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`,
      category: category || 'Other',
      notes: notes?.trim() || '',
      addedAt: Date.now(),
      isOwnerVerified: isConnectedUser,
      colorTag: isConnectedUser ? '#387B60' : '#7D8A89',
    };

    // Try server API first
    try {
      const res = await fetch('/api/wallets/tracked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: trimmed,
          label: newWallet.label,
          category: newWallet.category,
          notes: newWallet.notes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.wallet) {
          newWallet = data.wallet;
        }
      }
    } catch {}

    const next = [newWallet, ...wallets];
    save(next);

    return { success: true };
  }, [wallets, currentConnectedAddress, save]);

  const removeWallet = useCallback(async (id: string) => {
    const next = wallets.filter((w) => w.id !== id);
    save(next);

    try {
      await fetch(`/api/wallets/tracked?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch {}
  }, [wallets, save]);

  const updateWallet = useCallback((
    id: string,
    updates: Partial<Pick<TrackedWallet, 'label' | 'category' | 'notes' | 'colorTag'>>
  ) => {
    const next = wallets.map((w) => (w.id === id ? { ...w, ...updates } : w));
    save(next);
  }, [wallets, save]);

  return {
    wallets,
    isLoaded,
    addWallet,
    removeWallet,
    updateWallet,
  };
}
