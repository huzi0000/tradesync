'use client';

import { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { resolveRpcUrl } from '../../lib/solana/connection';

import '@solana/wallet-adapter-react-ui/styles.css';

interface Props {
  children: ReactNode;
}

export const SolanaWalletProvider: FC<Props> = ({ children }) => {
  // Wallets that support the Wallet Standard (Phantom, Solflare, Backpack, etc.)
  // are detected automatically by @solana/wallet-adapter-react.
  const wallets = useMemo(() => [], []);
  const endpoint = useMemo(() => resolveRpcUrl(), []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
