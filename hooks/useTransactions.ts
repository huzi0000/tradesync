'use client';

import { useState, useCallback, useRef } from 'react';
import { getTransactionHistory, formatRpcErrorMessage } from '../lib/solana/connection';
import { Transaction } from '../types';
import { isValidSolanaAddress } from '../lib/utils';

const PAGE_SIZE = 20;

export function useTransactions(initialAddress?: string) {
  const [address, setAddress] = useState(initialAddress ?? '');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'forbidden' | 'rate_limit' | 'timeout' | 'network' | 'unknown' | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const lastSignatureRef = useRef<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  const fetch = useCallback(async (addr: string, reset = true) => {
    if (!addr || !isValidSolanaAddress(addr)) {
      setError('Invalid Solana address');
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    if (reset) {
      setTransactions([]);
      lastSignatureRef.current = undefined;
    }

    try {
      const txs = await getTransactionHistory(
        addr,
        PAGE_SIZE,
        reset ? undefined : lastSignatureRef.current,
      );

      if (reset) {
        setTransactions(txs);
      } else {
        setTransactions(prev => [...prev, ...txs]);
      }

      setHasMore(txs.length === PAGE_SIZE);
      if (txs.length > 0) {
        lastSignatureRef.current = txs[txs.length - 1]!.signature;
      }
    } catch (err) {
      const parsed = formatRpcErrorMessage(err);
      setError(parsed.message);
      setErrorType(parsed.kind);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(() => {
    if (address && !isLoading) fetch(address, false);
  }, [address, isLoading, fetch]);

  const search = useCallback((addr: string) => {
    setAddress(addr);
    fetch(addr, true);
  }, [fetch]);

  return {
    address,
    transactions,
    isLoading,
    error,
    errorType,
    hasMore,
    search,
    loadMore,
    refresh: () => fetch(address, true),
  };
}
