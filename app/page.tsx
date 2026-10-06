'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import {
  Wallet,
  CheckCircle,
  XCircle,
  ExternalLink,
  RefreshCw,
  Search,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Coins,
  Cpu,
  Layers,
  Activity,
  AlertTriangle,
  Users,
  Bell,
  Eye,
  Plus,
  ShieldAlert,
} from 'lucide-react';

import { useWalletData } from '../hooks/useWallet';
import { useWatchlist } from '../hooks/useWatchlist';
import { useTrackedWallets } from '../hooks/useTrackedWallets';
import { useAlphaRooms } from '../hooks/useAlphaRooms';
import { useAlerts } from '../hooks/useAlerts';
import { useAuth } from '../hooks/useAuth';
import { Card, CardHeader, CardTitle, CardMeta } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { AddressDisplay } from '../components/ui/AddressDisplay';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { RiskIntelligenceCard } from '../components/risk/RiskIntelligenceCard';
import { evaluateRiskProfile } from '../lib/risk/engine';
import {
  formatTimeAgo,
  getSolscanTxUrl,
  isValidSolanaAddress,
  isValidTransactionSignature,
} from '../lib/utils';
import {
  KNOWN_DEX_PROGRAMS,
  SWAP_PROGRAM_IDS,
} from '../lib/constants';
import {
  getTransactionHistory,
  verifyTransaction,
} from '../lib/solana/connection';
import { Transaction, VerificationResult } from '../types';

export default function DashboardPage() {
  const {
    connected,
    address,
    walletName,
    solBalance,
    tokens,
    isLoadingBalance,
    isLoadingTokens,
    balanceError,
    tokensError,
    errorType,
    tokensLoaded,
    refresh: refreshWallet,
  } = useWalletData();

  const { tokens: watchlist } = useWatchlist();
  const { setVisible } = useWalletModal();
  const { wallets: trackedWallets } = useTrackedWallets(address);
  const { rooms } = useAlphaRooms(address);
  const { history: alertHistory, unreadCount } = useAlerts(trackedWallets);
  const { isAuthenticated, signInWithSolana, isAuthenticating } = useAuth();

  // Dashboard quick lookup input
  const [quickInput, setQuickInput] = useState('');
  const [quickError, setQuickError] = useState<string | null>(null);

  // Recent transactions on dashboard for connected wallet
  const [recentTxs, setRecentTxs] = useState<Transaction[]>([]);
  const [isLoadingTxs, setIsLoadingTxs] = useState(false);
  const [txsError, setTxsError] = useState<string | null>(null);

  // Quick verify widget on dashboard
  const [verifySig, setVerifySig] = useState('');
  const [verifyResult, setVerifyResult] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Load recent transactions when connected
  const loadRecentTxs = useCallback(async (addr: string) => {
    setIsLoadingTxs(true);
    setTxsError(null);
    try {
      const history = await getTransactionHistory(addr, 5);
      setRecentTxs(history);
    } catch (err) {
      setTxsError(err instanceof Error ? err.message : 'Unable to load recent activity');
    } finally {
      setIsLoadingTxs(false);
    }
  }, []);

  useEffect(() => {
    if (connected && address) {
      loadRecentTxs(address);
    } else {
      setRecentTxs([]);
      setTxsError(null);
    }
  }, [connected, address, loadRecentTxs]);

  // Handle dashboard quick search
  const handleQuickLookup = () => {
    const trimmed = quickInput.trim();
    if (!trimmed) return;

    if (isValidTransactionSignature(trimmed)) {
      window.location.href = `/wallet?sig=${encodeURIComponent(trimmed)}#verify`;
      return;
    }

    if (isValidSolanaAddress(trimmed)) {
      window.location.href = `/wallet?address=${encodeURIComponent(trimmed)}`;
      return;
    }

    setQuickError('Enter a valid 32-44 char Solana address or 87-88 char signature');
  };

  // Handle inline quick verify
  const handleInlineVerify = async () => {
    const trimmed = verifySig.trim();
    if (!isValidTransactionSignature(trimmed)) {
      setVerifyError('Invalid base58 transaction signature (must be 87-88 characters)');
      return;
    }
    setIsVerifying(true);
    setVerifyError(null);
    setVerifyResult(null);
    try {
      const result = await verifyTransaction(trimmed, address ?? undefined);
      setVerifyResult(result);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  // Compute Risk Profile for connected wallet
  const riskReport = useMemo(() => {
    if (!connected || !address) return null;
    return evaluateRiskProfile(address, solBalance, tokens);
  }, [connected, address, solBalance, tokens]);

  // =========================================================================
  // DISCONNECTED STATE — Institutional Terminal Overview
  // =========================================================================
  if (!connected) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Top Institutional Header Banner */}
        <div className="bg-white border border-[#DEDCD5] rounded-lg p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="neutral">Solana Mainnet-Beta</Badge>
                <span className="inline-flex items-center gap-1.5 text-xs text-[#387B60] font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#387B60] animate-pulse" />
                  Terminal Online
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-[#1B2428] tracking-tight">
                Collaborative Solana Trading Intelligence
              </h1>
              <p className="text-sm text-[#7D8A89] mt-2 leading-relaxed">
                Track public whale wallets, verify on-chain DEX swaps, collaborate inside private Alpha Rooms,
                and receive real-time on-chain alerts.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <Button onClick={() => setVisible(true)} size="lg" className="px-6 font-medium">
                <Wallet size={16} />
                Connect Wallet
              </Button>
              <Link href="/rooms">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  <Users size={16} />
                  Alpha Rooms
                </Button>
              </Link>
            </div>
          </div>

          {/* Quick On-Chain Explorer Bar */}
          <div className="mt-8 pt-6 border-t border-[#DAD8D1]">
            <p className="text-xs font-medium text-[#1B2428] uppercase tracking-wider mb-2">
              Instant On-Chain Lookup (No Wallet Required)
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Paste any Solana wallet address or transaction signature to inspect..."
                  value={quickInput}
                  onChange={e => {
                    setQuickInput(e.target.value);
                    setQuickError(null);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleQuickLookup();
                  }}
                  error={quickError ?? undefined}
                />
              </div>
              <Button onClick={handleQuickLookup} disabled={!quickInput.trim()}>
                <Search size={14} />
                <span>Inspect On-Chain</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Phase 2 Intelligence Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tracked Public Wallets */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Tracked Public Wallets</CardTitle>
                <CardMeta>Monitor institutional liquidity & whales</CardMeta>
              </div>
              <Eye size={16} className="text-[#3B6CA8]" />
            </CardHeader>
            <div className="space-y-2.5">
              {trackedWallets.map(w => (
                <div key={w.id} className="p-2.5 bg-[#F8F7F4] border border-[#DEDCD5] rounded flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-[#1B2428]">{w.label}</p>
                    <p className="font-mono text-[11px] text-[#7D8A89]">{w.address.slice(0, 6)}...{w.address.slice(-4)}</p>
                  </div>
                  <Link href={`/wallet?address=${w.address}`}>
                    <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]">
                      Inspect
                    </Button>
                  </Link>
                </div>
              ))}
              <Link href="/wallet" className="block text-center pt-1 text-xs text-[#BA6249] hover:underline font-medium">
                Manage Tracked Wallets ({trackedWallets.length}) →
              </Link>
            </div>
          </Card>

          {/* Active Alpha Desks */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Alpha Rooms</CardTitle>
                <CardMeta>Collaborative research desks</CardMeta>
              </div>
              <Users size={16} className="text-[#387B60]" />
            </CardHeader>
            <div className="space-y-2.5">
              {rooms.map(r => (
                <div key={r.id} className="p-2.5 bg-[#F8F7F4] border border-[#DEDCD5] rounded text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-[#1B2428] truncate">{r.name}</p>
                    <span className="text-[10px] text-[#7D8A89] shrink-0">{r.memberCount} members</span>
                  </div>
                  <p className="text-[11px] text-[#7D8A89] truncate">{r.description}</p>
                </div>
              ))}
              <Link href="/rooms" className="block text-center pt-1 text-xs text-[#BA6249] hover:underline font-medium">
                Enter Alpha Rooms →
              </Link>
            </div>
          </Card>

          {/* On-Chain Alerts */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Alert Engine</CardTitle>
                <CardMeta>Rules-based trigger history</CardMeta>
              </div>
              <Bell size={16} className="text-[#BA6249]" />
            </CardHeader>
            <div className="space-y-2.5">
              {alertHistory.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#7D8A89]">
                  No alerts triggered. Monitoring active.
                </div>
              ) : (
                alertHistory.slice(0, 2).map(a => (
                  <div key={a.id} className="p-2 bg-[#F8F7F4] border border-[#DEDCD5] rounded text-xs space-y-0.5">
                    <p className="font-semibold text-[#1B2428] truncate">{a.title}</p>
                    <p className="text-[11px] text-[#7D8A89] line-clamp-2">{a.message}</p>
                  </div>
                ))
              )}
              <Link href="/settings" className="block text-center pt-1 text-xs text-[#BA6249] hover:underline font-medium">
                Configure Alert Rules →
              </Link>
            </div>
          </Card>
        </div>

        {/* Supported DEX Program Coverage */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Supported Solana DEX Verifier Matrix</CardTitle>
              <CardMeta>Automatic on-chain instruction identification & swap classification</CardMeta>
            </div>
            <Layers size={16} className="text-[#7D8A89]" />
          </CardHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { name: 'Jupiter v6', id: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', desc: 'Metarouting' },
              { name: 'Raydium v4 AMM', id: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', desc: 'CPMM Pools' },
              { name: 'Raydium CLMM', id: 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK', desc: 'Concentrated' },
              { name: 'Orca Whirlpools', id: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', desc: 'CLMM Pools' },
              { name: 'Phoenix', id: 'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY', desc: 'Orderbook' },
            ].map(dex => (
              <div key={dex.id} className="p-3 bg-[#F8F7F4] border border-[#DEDCD5] rounded space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#1B2428]">{dex.name}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#387B60]" />
                </div>
                <p className="text-[11px] text-[#7D8A89]">{dex.desc}</p>
                <p className="text-[10px] font-mono text-[#7D8A89] truncate">{dex.id.slice(0, 8)}...</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  // =========================================================================
  // CONNECTED STATE — Full Operational Financial Terminal
  // =========================================================================
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Connected Wallet Identity Strip */}
      <div className="bg-white border border-[#DEDCD5] rounded-lg p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1B2428] flex items-center justify-center shrink-0">
              <Wallet size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#1B2428]">{walletName ?? 'Solana Wallet'}</span>
                <Badge variant={isAuthenticated ? 'success' : 'neutral'}>
                  {isAuthenticated ? 'SIWS Verified Signer' : 'Connected'}
                </Badge>
              </div>
              <div className="mt-0.5">
                <AddressDisplay address={address ?? ''} chars={6} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isAuthenticated && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => signInWithSolana()}
                disabled={isAuthenticating}
              >
                <ShieldAlert size={13} className="text-[#BA6249]" />
                <span>Verify Ownership (SIWS)</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshWallet()}
              disabled={isLoadingBalance || isLoadingTokens}
              title="Refresh balances"
            >
              <RefreshCw size={13} className={isLoadingBalance || isLoadingTokens ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* RPC Error banner if queries fail */}
        {(balanceError || tokensError) && (
          <div className="mt-4 p-3 bg-[#FBF0ED] border border-[#EDCCC5] rounded flex items-center justify-between text-xs text-[#BA6249]">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} />
              <span>{balanceError || tokensError}</span>
            </div>
            <Button size="sm" variant="secondary" onClick={() => refreshWallet()}>
              Retry
            </Button>
          </div>
        )}
      </div>

      {/* Financial Overview Metrics (4-Column Compact Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Native SOL Balance</CardTitle>
            <Badge variant="neutral">SOL</Badge>
          </CardHeader>
          {isLoadingBalance && solBalance === null ? (
            <Skeleton height="2rem" className="w-32 my-1" />
          ) : balanceError && solBalance === null ? (
            <div className="text-xs text-[#BA6249] font-medium py-1">Read Failed</div>
          ) : (
            <div>
              <p className="text-2xl font-mono font-semibold text-[#1B2428]">
                {solBalance !== null ? `${solBalance.toFixed(4)}` : '—'}
                <span className="text-sm font-normal text-[#7D8A89] ml-1.5">SOL</span>
              </p>
              <CardMeta className="mt-1 font-mono">
                {solBalance !== null ? `${(solBalance * 1e9).toLocaleString()} lamports` : '—'}
              </CardMeta>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Funded Token Accounts</CardTitle>
            <Coins size={14} className="text-[#7D8A89]" />
          </CardHeader>
          {isLoadingTokens && !tokensLoaded ? (
            <Skeleton height="2rem" className="w-24 my-1" />
          ) : tokensError && !tokensLoaded ? (
            <div className="text-xs text-[#BA6249] font-medium py-1">Read Failed</div>
          ) : (
            <div>
              <p className="text-2xl font-mono font-semibold text-[#1B2428]">{tokens.length}</p>
              <CardMeta className="mt-1">
                {tokens.length > 0 ? 'Active SPL token accounts' : 'No tokens found'}
              </CardMeta>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alpha Rooms</CardTitle>
            <Users size={14} className="text-[#387B60]" />
          </CardHeader>
          <p className="text-2xl font-mono font-semibold text-[#1B2428]">{rooms.length}</p>
          <CardMeta className="mt-1">Active research desks</CardMeta>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tracked Public Wallets</CardTitle>
            <Eye size={14} className="text-[#3B6CA8]" />
          </CardHeader>
          <p className="text-2xl font-mono font-semibold text-[#1B2428]">{trackedWallets.length}</p>
          <CardMeta className="mt-1">Monitored addresses</CardMeta>
        </Card>
      </div>

      {/* Rules-Based Risk Intelligence for Connected Wallet */}
      {riskReport && (
        <RiskIntelligenceCard report={riskReport} />
      )}

      {/* Inline Swap Verification Widget */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Quick On-Chain Trade Verifier</CardTitle>
            <CardMeta>Verify signature execution, DEX program classification, and token amounts</CardMeta>
          </div>
          <ShieldCheck size={16} className="text-[#387B60]" />
        </CardHeader>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Paste 88-char Solana transaction signature..."
              value={verifySig}
              onChange={e => {
                setVerifySig(e.target.value);
                setVerifyError(null);
              }}
              className="flex-1 font-mono text-xs"
              error={verifyError ?? undefined}
            />
            <Button onClick={handleInlineVerify} loading={isVerifying} disabled={!verifySig.trim()}>
              <ShieldCheck size={14} />
              Verify Swap
            </Button>
          </div>

          {verifyResult && (
            <div className={`p-3 rounded border text-xs ${verifyResult.valid ? 'border-[#C5DDD4] bg-[#EBF5F0]' : 'border-[#EDCCC5] bg-[#FBF0ED]'}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#1B2428]">
                  {verifyResult.valid ? `Verified Swap via ${verifyResult.programId}` : 'Verification Failed'}
                </span>
                <a
                  href={getSolscanTxUrl(verifyResult.signature)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#BA6249] hover:underline"
                >
                  View on Solscan ↗
                </a>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Holdings & Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Token Accounts Table */}
        <Card padding={false} className="flex flex-col">
          <div className="px-5 py-4 border-b border-[#DAD8D1] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#1B2428]">SPL Token Holdings</h3>
              <p className="text-xs text-[#7D8A89] mt-0.5">On-chain token balances</p>
            </div>
            <Link href="/tokens">
              <span className="text-xs text-[#BA6249] hover:underline font-medium">Explore Market →</span>
            </Link>
          </div>

          <div className="flex-1 overflow-x-auto">
            {isLoadingTokens && !tokensLoaded ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} height="2.5rem" className="w-full" />
                ))}
              </div>
            ) : tokens.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#7D8A89]">
                No funded SPL token accounts detected for this wallet.
              </div>
            ) : (
              <div className="divide-y divide-[#DAD8D1]">
                {tokens.slice(0, 8).map(token => (
                  <div key={token.mint} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-[#F3F0E9] transition-colors">
                    <div>
                      <Link href={`/tokens?mint=${token.mint}`} className="font-mono text-xs font-semibold text-[#1B2428] hover:text-[#BA6249]">
                        {token.mint.slice(0, 6)}...{token.mint.slice(-4)}
                      </Link>
                      <p className="text-[11px] text-[#7D8A89]">Decimals: {token.decimals}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono font-bold text-[#1B2428]">
                        {token.uiAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Recent Transactions Table */}
        <Card padding={false} className="flex flex-col">
          <div className="px-5 py-4 border-b border-[#DAD8D1] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#1B2428]">Recent Activity</h3>
              <p className="text-xs text-[#7D8A89] mt-0.5">Latest confirmed transactions on Mainnet</p>
            </div>
            <Link href={`/wallet?address=${address ?? ''}`}>
              <span className="text-xs text-[#BA6249] hover:underline font-medium">Full History →</span>
            </Link>
          </div>

          <div className="flex-1 overflow-x-auto">
            {isLoadingTxs ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} height="2.5rem" className="w-full" />
                ))}
              </div>
            ) : recentTxs.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#7D8A89]">
                No recent transactions found on Mainnet for this wallet.
              </div>
            ) : (
              <div className="divide-y divide-[#DAD8D1]">
                {recentTxs.map(tx => (
                  <div key={tx.signature} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-[#F3F0E9] transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={tx.type === 'swap' ? 'success' : 'neutral'}>{tx.type}</Badge>
                        <a
                          href={getSolscanTxUrl(tx.signature)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-[#7D8A89] hover:text-[#1B2428] truncate max-w-[140px] sm:max-w-[200px]"
                        >
                          {tx.signature}
                        </a>
                      </div>
                      <p className="text-[11px] text-[#7D8A89] mt-0.5">
                        {tx.blockTime ? formatTimeAgo(tx.blockTime) : 'Confirmed'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-mono text-[#1B2428]">{tx.fee.toFixed(5)} SOL</p>
                      <span className="text-[10px] text-[#7D8A89]">Fee</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
