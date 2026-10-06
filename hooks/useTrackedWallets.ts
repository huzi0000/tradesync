'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrackedWallet } from '../types';
import { isValidSolanaAddress } from '../lib/utils';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';

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

  // Load from persistent storage on mount + Supabase if configured
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

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        Promise.resolve(
          supabase
            .from('tracked_wallets')
            .select('*')
            .eq('is_active', true)
        )
          .then(({ data: dbWallets, error }) => {
            if (!error && dbWallets && dbWallets.length > 0 && isMounted) {
              const mapped: TrackedWallet[] = dbWallets.map((w) => ({
                id: w.id,
                address: w.address,
                label: w.label,
                category: w.category as TrackedWallet['category'],
                notes: w.notes || '',
                addedAt: new Date(w.created_at).getTime(),
                isOwnerVerified: w.is_owner_verified,
                colorTag: w.color_tag || '#7D8A89',
              }));
              setWallets(mapped);
            }
          })
          .catch(() => {});
      }
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const save = useCallback((newWallets: TrackedWallet[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newWallets));
    } catch {
      // Ignore storage errors
    }
    setWallets(newWallets);
  }, []);

  const addWallet = useCallback((
    address: string,
    label: string,
    category?: TrackedWallet['category'],
    notes?: string
  ): { success: boolean; error?: string } => {
    const trimmed = address.trim();
    if (!isValidSolanaAddress(trimmed)) {
      return { success: false, error: 'Invalid Solana base58 public address.' };
    }

    if (wallets.some(w => w.address === trimmed)) {
      return { success: false, error: 'This wallet is already in your tracking watchlist.' };
    }

    const isConnectedUser = currentConnectedAddress === trimmed;

    const newWallet: TrackedWallet = {
      id: `wallet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      address: trimmed,
      label: label.trim() || `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`,
      category: category || 'Other',
      notes: notes?.trim() || '',
      addedAt: Date.now(),
      // Strict rule: only marked owner-verified if currently authenticated with signature
      isOwnerVerified: isConnectedUser,
      colorTag: isConnectedUser ? '#387B60' : '#7D8A89',
    };

    const next = [newWallet, ...wallets];
    save(next);

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        Promise.resolve(
          supabase.from('tracked_wallets').insert({
            address: trimmed,
            label: newWallet.label,
            category: newWallet.category,
            notes: newWallet.notes,
            color_tag: newWallet.colorTag,
            is_owner_verified: newWallet.isOwnerVerified,
          })
        ).catch(() => {});
      }
    }

    return { success: true };
  }, [wallets, currentConnectedAddress, save]);

  const removeWallet = useCallback((id: string) => {
    const next = wallets.filter(w => w.id !== id);
    save(next);

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        Promise.resolve(
          supabase.from('tracked_wallets').delete().eq('id', id)
        ).catch(() => {});
      }
    }
  }, [wallets, save]);

  const updateWallet = useCallback((
    id: string,
    updates: Partial<Pick<TrackedWallet, 'label' | 'category' | 'notes' | 'colorTag'>>
  ) => {
    const next = wallets.map(w => (w.id === id ? { ...w, ...updates } : w));
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
