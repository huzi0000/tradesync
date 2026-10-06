'use client';

import { FC } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuth } from '../../hooks/useAuth';
import { ShieldCheck, ShieldAlert, LogOut, Loader2 } from 'lucide-react';

export const AuthStatusButton: FC = () => {
  const { connected } = useWallet();
  const { isAuthenticated, isAuthenticating, signInWithSolana, signOut } = useAuth();

  if (!connected) return null;

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#EBF5F0] border border-[#C5DDD4] text-[#387B60] text-xs font-medium">
        <ShieldCheck size={13} className="shrink-0" />
        <span className="hidden sm:inline">Verified Signer</span>
        <button
          onClick={signOut}
          title="Sign out of verified session"
          className="ml-1 p-0.5 text-[#387B60] hover:text-[#1B2428] transition-colors"
          aria-label="Sign out"
        >
          <LogOut size={12} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signInWithSolana()}
      disabled={isAuthenticating}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white hover:bg-[#F3F0E9] border border-[#BA6249] text-[#BA6249] text-xs font-medium transition-colors"
      title="Cryptographically verify wallet ownership via Sign-In-With-Solana (SIWS)"
    >
      {isAuthenticating ? (
        <>
          <Loader2 size={13} className="animate-spin shrink-0" />
          <span>Verifying...</span>
        </>
      ) : (
        <>
          <ShieldAlert size={13} className="shrink-0" />
          <span>Verify Wallet (SIWS)</span>
        </>
      )}
    </button>
  );
};
