'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { BarChart2, Wallet, ShieldCheck, ArrowRight, Info, PieChart, Activity, Eye } from 'lucide-react';

import { useWalletData } from '../../hooks/useWallet';
import { useWatchlist } from '../../hooks/useWatchlist';
import { useTrackedWallets } from '../../hooks/useTrackedWallets';
import { useAlphaRooms } from '../../hooks/useAlphaRooms';
import { Card, CardHeader, CardTitle, CardMeta } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { getTransactionHistory } from '../../lib/solana/connection';
import { Transaction } from '../../types';

export default function AnalyticsPage() {
  const { connected, tokens, solBalance, address: connectedAddress, isLoadingBalance, isLoadingTokens } =
    useWalletData();
  const { tokens: watchlist } = useWatchlist();
  const { wallets: trackedWallets } = useTrackedWallets(connectedAddress);
  const { rooms, posts } = useAlphaRooms(connectedAddress);
  const { setVisible } = useWalletModal();

  // Selected address for analytics: either connected wallet or a tracked wallet
  const [selectedAddress, setSelectedAddress] = useState<string>(
    connectedAddress || (trackedWallets[0]?.address ?? '')
  );

  const [history, setHistory] = useState<Transaction[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (connectedAddress && !selectedAddress) {
      setSelectedAddress(connectedAddress);
    }
  }, [connectedAddress, selectedAddress]);

  useEffect(() => {
    const target = selectedAddress || connectedAddress;
    if (target) {
      setIsLoadingHistory(true);
      getTransactionHistory(target, 25)
        .then(txs => setHistory(txs))
        .catch(() => setHistory([]))
        .finally(() => setIsLoadingHistory(false));
    } else {
      setHistory([]);
    }
  }, [selectedAddress, connectedAddress]);

  const swapCount = history.filter(t => t.type === 'swap').length;
  const transferCount = history.filter(t => t.type === 'transfer').length;
  const stakeCount = history.filter(t => t.type === 'stake' || t.type === 'unstake').length;
  const otherCount = history.length - (swapCount + transferCount + stakeCount);

  // Total room posts and shared trades
  const totalRoomPosts = Object.values(posts).flat().length;
  const totalVerifiedTrades = Object.values(posts).flat().filter(p => p.tradeData).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header & Target Selector */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>On-Chain Analytics & Desk Telemetry</CardTitle>
            <CardMeta>Derived from real Mainnet transactions, token accounts, and verified room trades</CardMeta>
          </div>
          <Badge variant="neutral">Solana Mainnet</Badge>
        </CardHeader>

        {/* Address Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 overflow-x-auto text-xs">
            <span className="font-semibold text-[#1B2428] shrink-0">Analysis Target:</span>
            {connected && connectedAddress && (
              <button
                onClick={() => setSelectedAddress(connectedAddress)}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  selectedAddress === connectedAddress
                    ? 'bg-[#1B2428] text-white'
                    : 'bg-[#F8F7F4] text-[#7D8A89] hover:text-[#1B2428]'
                }`}
              >
                Connected Wallet
              </button>
            )}
            {trackedWallets.map(w => (
              <button
                key={w.id}
                onClick={() => setSelectedAddress(w.address)}
                className={`px-2.5 py-1 rounded font-medium transition-colors shrink-0 ${
                  selectedAddress === w.address
                    ? 'bg-[#1B2428] text-white'
                    : 'bg-[#F8F7F4] text-[#7D8A89] hover:text-[#1B2428]'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>

          {!connected && (
            <Button size="sm" variant="outline" onClick={() => setVisible(true)}>
              <Wallet size={13} />
              <span>Connect Wallet</span>
            </Button>
          )}
        </div>
      </Card>

      {/* Overview Metric Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Sampled Txs</CardTitle>
            <Activity size={14} className="text-[#7D8A89]" />
          </CardHeader>
          <p className="text-2xl font-mono font-bold text-[#1B2428]">{history.length}</p>
          <CardMeta className="mt-1">Recent block slots</CardMeta>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>DEX Swaps</CardTitle>
            <Activity size={14} className="text-[#387B60]" />
          </CardHeader>
          <p className="text-2xl font-mono font-bold text-[#387B60]">{swapCount}</p>
          <CardMeta className="mt-1">
            {history.length > 0 ? `${Math.round((swapCount / history.length) * 100)}% of sampled` : '0%'}
          </CardMeta>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Room Desks</CardTitle>
            <Activity size={14} className="text-[#3B6CA8]" />
          </CardHeader>
          <p className="text-2xl font-mono font-bold text-[#1B2428]">{rooms.length}</p>
          <CardMeta className="mt-1">{totalRoomPosts} collaborative notes</CardMeta>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verified Trades</CardTitle>
            <ShieldCheck size={14} className="text-[#387B60]" />
          </CardHeader>
          <p className="text-2xl font-mono font-bold text-[#387B60]">{totalVerifiedTrades}</p>
          <CardMeta className="mt-1">Verified on-chain</CardMeta>
        </Card>
      </div>

      {/* Transaction Classification Proportional Stack */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Transaction Type Distribution</CardTitle>
            <CardMeta>Classification of confirmed on-chain activity</CardMeta>
          </div>
        </CardHeader>

        {isLoadingHistory ? (
          <Skeleton height="2rem" className="w-full my-2" />
        ) : history.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#7D8A89]">
            No recent transaction history found for selected address.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Visual stacked bar */}
            <div className="h-6 w-full flex rounded overflow-hidden border border-[#DEDCD5]">
              {swapCount > 0 && (
                <div
                  style={{ width: `${(swapCount / history.length) * 100}%` }}
                  className="bg-[#387B60] h-full"
                  title={`Swaps: ${swapCount}`}
                />
              )}
              {transferCount > 0 && (
                <div
                  style={{ width: `${(transferCount / history.length) * 100}%` }}
                  className="bg-[#1B2428] h-full"
                  title={`Transfers: ${transferCount}`}
                />
              )}
              {stakeCount > 0 && (
                <div
                  style={{ width: `${(stakeCount / history.length) * 100}%` }}
                  className="bg-[#9B7B2B] h-full"
                  title={`Staking: ${stakeCount}`}
                />
              )}
              {otherCount > 0 && (
                <div
                  style={{ width: `${(otherCount / history.length) * 100}%` }}
                  className="bg-[#DEDCD5] h-full"
                  title={`Unclassified: ${otherCount}`}
                />
              )}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#387B60]" />
                <span className="text-[#1B2428] font-medium">Swaps: {swapCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1B2428]" />
                <span className="text-[#1B2428] font-medium">Transfers: {transferCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#9B7B2B]" />
                <span className="text-[#1B2428] font-medium">Staking: {stakeCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#DEDCD5]" />
                <span className="text-[#7D8A89]">Other: {otherCount}</span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Institutional Data Integrity Disclaimer */}
      <div className="p-4 bg-white border border-[#DEDCD5] rounded-lg text-xs text-[#7D8A89] leading-relaxed">
        <p className="font-semibold text-[#1B2428] mb-1">Institutional Financial Data Policy:</p>
        TradeSync only renders mathematically verifiable on-chain events. Historical cost basis, realized PnL, and simulated ROI metrics are strictly withheld because determining historical fiat entry pricing without comprehensive archive indexer coverage creates misleading figures.
      </div>
    </div>
  );
}
