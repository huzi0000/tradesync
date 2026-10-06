'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { AuthSession, AuthChallenge } from '../types';

export function useAuth() {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const [session, setSession] = useState<AuthSession>({
    authenticated: false,
    walletAddress: null,
    userId: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check existing session on mount
  const checkSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/auth/session');
      if (res.ok) {
        const data = (await res.json()) as AuthSession;
        setSession(data);
      }
    } catch {
      // Ignore network errors on session check
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // If wallet changes or disconnects, re-check session
  useEffect(() => {
    if (!connected) {
      if (session.authenticated) {
        setSession({ authenticated: false, walletAddress: null, userId: null });
      }
    } else if (publicKey && session.walletAddress && publicKey.toString() !== session.walletAddress) {
      // Switched wallet address in extension
      setSession({ authenticated: false, walletAddress: null, userId: null });
    }
  }, [connected, publicKey, session.authenticated, session.walletAddress]);

  const signInWithSolana = useCallback(async () => {
    if (!publicKey || !connected) {
      setError('Please connect your Solana wallet first');
      return false;
    }

    if (!signMessage) {
      setError('Your connected wallet adapter does not support cryptographic message signing');
      return false;
    }

    setIsAuthenticating(true);
    setError(null);

    try {
      const address = publicKey.toString();

      // 1. Request challenge from server
      const challengeRes = await fetch('/api/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });

      if (!challengeRes.ok) {
        const err = await challengeRes.json();
        throw new Error(err.error || 'Failed to obtain challenge');
      }

      const challenge = (await challengeRes.json()) as AuthChallenge;

      // 2. Request user to sign message in wallet extension
      const encodedMessage = new TextEncoder().encode(challenge.message);
      const signatureBytes = await signMessage(encodedMessage);

      // Convert Uint8Array to hex
      const signatureHex = Array.from(signatureBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // 3. Submit signature to server for cryptographic verification
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          message: challenge.message,
          signature: signatureHex,
          nonce: challenge.nonce,
        }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.error || 'Cryptographic verification failed');
      }

      await checkSession();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      // If user cancelled in wallet
      if (msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('cancel')) {
        setError('Signature request was rejected in your wallet');
      } else {
        setError(msg);
      }
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  }, [publicKey, connected, signMessage, checkSession]);

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setSession({ authenticated: false, walletAddress: null, userId: null });
      if (disconnect) {
        await disconnect();
      }
    } catch {
      // Ignore logout errors
    }
  }, [disconnect]);

  return {
    session,
    isAuthenticated: session.authenticated,
    isLoading,
    isAuthenticating,
    error,
    signInWithSolana,
    signOut,
    refreshSession: checkSession,
  };
}
