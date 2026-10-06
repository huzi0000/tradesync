'use client';

import { useWallet as useSolanaWallet, useConnection } from '@solana/wallet-adapter-react';
import { useCallback, useEffect, useState, useRef } from 'react';
import {
  getTokenAccounts,
  formatRpcErrorMessage,
} from '../lib/solana/connection';
import { TokenBalance } from '../types';
import { clearCache } from '../lib/utils';

export function useWalletData() {
  const { publicKey, connected, connecting, disconnecting, wallet } =
    useSolanaWallet();
  const { connection } = useConnection();
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [tokensError, setTokensError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<
    'forbidden' | 'rate_limit' | 'timeout' | 'network' | 'unknown' | null
  >(null);
  const [tokensLoaded, setTokensLoaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(
    async (forceFresh = false) => {
      if (!publicKey || !connected) {
        setSolBalance(null);
        setTokens([]);
        setBalanceError(null);
        setTokensError(null);
        setErrorType(null);
        setTokensLoaded(false);
        return;
      }

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const address = publicKey.toString();
      if (forceFresh) {
        clearCache(`balance:${address}`);
        clearCache(`tokens:${address}`);
      }

      setBalanceError(null);
      setTokensError(null);
      setErrorType(null);

      // 1. Fetch SOL balance
      try {
        setIsLoadingBalance(true);
        const bal = await connection.getBalance(publicKey);
        setSolBalance(bal / 1e9);
      } catch (err) {
        const parsed = formatRpcErrorMessage(err);
        setBalanceError(parsed.message);
        setErrorType(parsed.kind);
        // Do NOT set solBalance to 0 on failure! Leave as null or previous confirmed balance
      } finally {
        setIsLoadingBalance(false);
      }

      // 2. Fetch SPL Token accounts
      try {
        setIsLoadingTokens(true);
        const tokenAccs = await getTokenAccounts(address);
        const tokenList = tokenAccs as Array<{
          mint: string;
          amount: number;
          decimals: number;
          uiAmount: number;
        }>;
        setTokens(
          tokenList.map(t => ({
            mint: t.mint,
            amount: t.amount,
            decimals: t.decimals,
            uiAmount: t.uiAmount,
          }))
        );
        setTokensLoaded(true);
      } catch (err) {
        const parsed = formatRpcErrorMessage(err);
        setTokensError(parsed.message);
        if (!errorType) {
          setErrorType(parsed.kind);
        }
        setTokensLoaded(false);
        // Do NOT wipe tokens to empty list without letting caller know it failed!
      } finally {
        setIsLoadingTokens(false);
      }
    },
    [publicKey, connected, connection, errorType]
  );

  useEffect(() => {
    fetchData();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchData]);

  const combinedError = balanceError || tokensError;

  return {
    publicKey,
    address: publicKey?.toString() ?? null,
    connected,
    connecting,
    disconnecting,
    walletName: wallet?.adapter.name ?? null,
    solBalance,
    tokens,
    isLoadingBalance,
    isLoadingTokens,
    balanceError,
    tokensError,
    error: combinedError,
    errorType,
    tokensLoaded,
    refresh: () => fetchData(true),
  };
}

export function useRefreshInterval(
  callback: () => void,
  intervalMs: number,
  enabled: boolean
) {
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(callback, intervalMs);
    return () => clearInterval(id);
  }, [callback, intervalMs, enabled]);
}
