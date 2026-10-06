'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTransactions } from '../../hooks/useTransactions';
import { useWalletData } from '../../hooks/useWallet';
import { useTrackedWallets } from '../../hooks/useTrackedWallets';
import { Card, CardHeader, CardTitle, CardMeta } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { AddressDisplay } from '../../components/ui/AddressDisplay';
import { TrackedWalletsManager } from '../../components/wallet/TrackedWalletsManager';
import { RiskIntelligenceCard } from '../../components/risk/RiskIntelligenceCard';
import { evaluateRiskProfile } from '../../lib/risk/engine';
import { verifyTransaction } from '../../lib/solana/connection';
import { Transaction, VerificationResult } from '../../types';
import {
  formatTimeAgo,
  getSolscanTxUrl,
  isValidSolanaAddress,
  isValidTransactionSignature,
} from '../../lib/utils';
import {
  Search,
  Wallet,
  RefreshCw,
  ChevronDown,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertCircle,
  ShieldCheck,
  Filter,
} from 'lucide-react';
import { KNOWN_DEX_PROGRAMS } from '../../lib/constants';

const TX_TYPE_BADGE: Record<
  string,
  { label: string; variant: 'success' | 'error' | 'neutral' | 'info' | 'warning' | 'default' }
> = {
  swap: { label: 'Swap', variant: 'success' },
  transfer: { label: 'Transfer', variant: 'info' },
  stake: { label: 'Stake', variant: 'warning' },
  unstake: { label: 'Unstake', variant: 'warning' },
  mint: { label: 'Mint', variant: 'info' },
  burn: { label: 'Burn', variant: 'error' },
  create_account: { label: 'Create Account', variant: 'neutral' },
  close_account: { label: 'Close Account', variant: 'neutral' },
  unclassified: { label: 'Unclassified', variant: 'neutral' },
};

function TransactionRow({ tx }: { tx: Transaction }) {
  const type = TX_TYPE_BADGE[tx.type] ?? { label: tx.type, variant: 'neutral' as const };
  const dexName =
    tx.type === 'swap'
      ? tx.accounts.map(a => KNOWN_DEX_PROGRAMS[a]).find(Boolean)
      : undefined;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3 hover:bg-[#F3F0E9] transition-colors border-b border-[#DAD8D1] last:border-0">
      <div className="flex items-start gap-3 min-w-0">
        <div className="shrink-0 mt-0.5">
          {tx.status === 'success' ? (
            <CheckCircle size={15} className="text-[#387B60]" />
          ) : (
            <XCircle size={15} className="text-[#BA6249]" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={type.variant}>{type.label}</Badge>
            {dexName && (
              <span className="text-xs font-semibold text-[#1B2428]">{dexName}</span>
            )}
            <span className="text-xs text-[#7D8A89] font-mono">
              Slot: #{tx.slot.toLocaleString()}
            </span>
          </div>

          <p className="text-xs font-mono text-[#7D8A89] mt-0.5 truncate max-w-sm sm:max-w-md">
            {tx.signature}
          </p>

          {/* Token balance changes if present */}
          {tx.postTokenBalances && tx.postTokenBalances.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-[#1B2428]">
              {tx.postTokenBalances.slice(0, 3).map((b, i) => (
                <span
                  key={i}
                  className="font-mono px-1.5 py-0.5 bg-[#F3F0E9] border border-[#DEDCD5] rounded text-[11px]"
                >
                  {b.mint.slice(0, 4)}...{b.mint.slice(-4)}:{' '}
                  {b.uiAmount.toFixed(Math.min(b.decimals, 4))}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0 text-xs">
        <span className="text-[#7D8A89]">
          {tx.blockTime ? formatTimeAgo(tx.blockTime) : '—'}
        </span>
        <span className="font-mono text-[#7D8A89] text-[11px]">
          Fee: {tx.fee > 0 ? `${tx.fee.toFixed(6)} SOL` : '0 SOL'}
        </span>
        <a
          href={getSolscanTxUrl(tx.signature)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[#BA6249] hover:underline text-[11px] font-medium"
        >
          Solscan <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
}

function VerificationPanel({
  walletAddress,
  initialSignature,
}: {
  walletAddress?: string;
  initialSignature?: string;
}) {
  const [sig, setSig] = useState(initialSignature ?? '');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(async (sigToVerify?: string) => {
    const targetSig = (sigToVerify ?? sig).trim();
    if (!targetSig) return;

    if (!isValidTransactionSignature(targetSig)) {
      setError('Invalid signature format. Must be a base-58 encoded transaction signature (87-88 chars).');
      setResult(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await verifyTransaction(targetSig, walletAddress);
      setResult(res);
      if (!res.valid && res.error) {
        setError(res.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  }, [sig, walletAddress]);

  useEffect(() => {
    if (initialSignature && isValidTransactionSignature(initialSignature.trim())) {
      setSig(initialSignature.trim());
      verify(initialSignature.trim());
    }
  }, [initialSignature, verify]);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Solana Mainnet Swap Verifier</CardTitle>
          <CardMeta>
            Confirm token input/output amounts, DEX program routing, and signer authorization
          </CardMeta>
        </div>
        <ShieldCheck size={18} className="text-[#387B60]" />
      </CardHeader>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <Input
              placeholder="Paste Solana transaction signature..."
              value={sig}
              onChange={e => {
                setSig(e.target.value);
                setError(null);
              }}
              error={error ?? undefined}
              onKeyDown={e => {
                if (e.key === 'Enter') verify();
              }}
            />
          </div>
          <Button onClick={() => verify()} loading={isLoading} disabled={!sig.trim()}>
            <ShieldCheck size={14} />
            Verify On-Chain
          </Button>
        </div>

        {result && (
          <div
            className={`p-4 rounded border text-xs ${
              result.valid ? 'border-[#C5DDD4] bg-[#EBF5F0]' : 'border-[#EDCCC5] bg-[#FBF0ED]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                {result.valid ? (
                  <CheckCircle size={16} className="text-[#387B60]" />
                ) : (
                  <XCircle size={16} className="text-[#BA6249]" />
                )}
                <span
                  className={`text-sm font-semibold ${
                    result.valid ? 'text-[#387B60]' : 'text-[#BA6249]'
                  }`}
                >
                  {result.valid
                    ? 'Verified Swap'
                    : result.status
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, c => c.toUpperCase())}
                </span>
              </div>
              {result.programId && (
                <Badge variant="neutral">{result.programId}</Badge>
              )}
            </div>

            {result.error && <p className="text-xs text-[#BA6249] mb-3 leading-relaxed">{result.error}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#1B2428]">
              {result.programId && (
                <div className="flex gap-2">
                  <span className="text-[#7D8A89] w-20 shrink-0">DEX Program:</span>
                  <span className="font-semibold">{result.programId}</span>
                </div>
              )}
              {result.wallets && result.wallets[0] && (
                <div className="flex gap-2 items-center">
                  <span className="text-[#7D8A89] w-20 shrink-0">Signer:</span>
                  <AddressDisplay address={result.wallets[0]} chars={6} />
                </div>
              )}
              {result.inputToken && (
                <div className="flex gap-2">
                  <span className="text-[#7D8A89] w-20 shrink-0">Sold:</span>
                  <span className="font-mono">
                    {result.inputToken.amount.toFixed(
                      Math.min(result.inputToken.decimals, 6)
                    )}{' '}
                    ({result.inputToken.mint.slice(0, 8)}...)
                  </span>
                </div>
              )}
              {result.outputToken && (
                <div className="flex gap-2">
                  <span className="text-[#7D8A89] w-20 shrink-0">Received:</span>
                  <span className="font-mono">
                    {result.outputToken.amount.toFixed(
                      Math.min(result.outputToken.decimals, 6)
                    )}{' '}
                    ({result.outputToken.mint.slice(0, 8)}...)
                  </span>
                </div>
              )}
              {result.slot && (
                <div className="flex gap-2">
                  <span className="text-[#7D8A89] w-20 shrink-0">Block Slot:</span>
                  <span className="font-mono">#{result.slot.toLocaleString()}</span>
                </div>
              )}
              {result.blockTime && (
                <div className="flex gap-2">
                  <span className="text-[#7D8A89] w-20 shrink-0">Executed:</span>
                  <span>{formatTimeAgo(result.blockTime)}</span>
                </div>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-current/10 flex justify-between items-center text-[11px]">
              <span className="text-[#7D8A89]">
                {result.valid
                  ? 'Mainnet on-chain execution confirmed'
                  : 'Transaction execution could not be verified'}
              </span>
              <a
                href={getSolscanTxUrl(result.signature)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#BA6249] hover:underline flex items-center gap-1 font-medium"
              >
                Inspect on Solscan <ExternalLink size={11} />
              </a>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function WalletIntelligenceContent() {
  const searchParams = useSearchParams();
  const paramAddress = searchParams.get('address');
  const paramSig = searchParams.get('sig');

  const { address: connectedAddress, solBalance, tokens } = useWalletData();
  const {
    wallets: trackedWallets,
    addWallet: addTrackedWallet,
    removeWallet: removeTrackedWallet,
  } = useTrackedWallets(connectedAddress);

  const [inputAddress, setInputAddress] = useState(paramAddress || connectedAddress || '');
  const [filterType, setFilterType] = useState<'all' | 'swap' | 'transfer' | 'stake' | 'other'>('all');
  const didInitialLoad = useRef(false);

  const {
    transactions,
    isLoading,
    error,
    errorType,
    hasMore,
    search,
    loadMore,
    refresh,
  } = useTransactions(paramAddress || connectedAddress || undefined);

  const handleSearch = useCallback(() => {
    const trimmed = inputAddress.trim();
    if (trimmed && isValidSolanaAddress(trimmed)) {
      search(trimmed);
    }
  }, [inputAddress, search]);

  useEffect(() => {
    if (!didInitialLoad.current) {
      const initial = paramAddress || connectedAddress;
      if (initial && isValidSolanaAddress(initial)) {
        setInputAddress(initial);
        search(initial);
      }
      didInitialLoad.current = true;
    }
  }, [paramAddress, connectedAddress, search]);

  const addressError =
    inputAddress && !isValidSolanaAddress(inputAddress)
      ? 'Please enter a valid 32-44 character base58 Solana address'
      : undefined;

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    if (filterType === 'all') return transactions;
    if (filterType === 'swap') return transactions.filter(t => t.type === 'swap');
    if (filterType === 'transfer') return transactions.filter(t => t.type === 'transfer');
    if (filterType === 'stake') return transactions.filter(t => t.type === 'stake' || t.type === 'unstake');
    return transactions.filter(t => t.type !== 'swap' && t.type !== 'transfer' && t.type !== 'stake' && t.type !== 'unstake');
  }, [transactions, filterType]);

  const swapCount = useMemo(() => transactions.filter(t => t.type === 'swap').length, [transactions]);
  const transferCount = useMemo(() => transactions.filter(t => t.type === 'transfer').length, [transactions]);

  // Compute risk profile for currently active address
  const activeAddress = inputAddress || connectedAddress || '';
  const isOwner = connectedAddress && activeAddress === connectedAddress;
  const riskReport = useMemo(() => {
    if (!activeAddress) return null;
    return evaluateRiskProfile(activeAddress, isOwner ? solBalance : 0, isOwner ? tokens : []);
  }, [activeAddress, isOwner, solBalance, tokens]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Tracked Public Wallets Desk */}
      <TrackedWalletsManager
        wallets={trackedWallets}
        onAddWallet={addTrackedWallet}
        onRemoveWallet={removeTrackedWallet}
        onSelectWallet={addr => {
          setInputAddress(addr);
          search(addr);
        }}
      />

      {/* Wallet Lookup Search Bar */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Solana Wallet Address Lookup</CardTitle>
            <CardMeta>Query confirmed transaction history and parse DEX activity</CardMeta>
          </div>
          <Badge variant="neutral">Mainnet Beta</Badge>
        </CardHeader>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <Input
              placeholder="Enter Solana wallet address (e.g. 9WzDXw...)"
              value={inputAddress}
              onChange={e => setInputAddress(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSearch();
              }}
              error={addressError}
            />
          </div>
          <Button onClick={handleSearch} loading={isLoading} disabled={!inputAddress.trim() || !!addressError}>
            <Search size={15} />
            <span className="hidden sm:inline">Inspect Wallet</span>
          </Button>
        </div>
      </Card>

      {/* Risk Intelligence Report if address selected */}
      {riskReport && (
        <RiskIntelligenceCard report={riskReport} />
      )}

      {/* Verification Panel */}
      <VerificationPanel
        walletAddress={connectedAddress ?? undefined}
        initialSignature={paramSig || undefined}
      />

      {/* Transaction History & Filter Table */}
      <Card padding={false}>
        <div className="p-4 sm:p-5 border-b border-[#DAD8D1] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[#1B2428]">
              Confirmed Transaction History
            </h3>
            <p className="text-xs text-[#7D8A89] mt-0.5">
              Parsed from on-chain signatures and program instructions
            </p>
          </div>

          <div className="flex items-center gap-2">
            {transactions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={isLoading}
                title="Refresh history from Mainnet"
              >
                <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                Refresh
              </Button>
            )}
          </div>
        </div>

        {/* Filter Navigation Tabs */}
        {transactions.length > 0 && (
          <div className="px-4 py-2 border-b border-[#DAD8D1] bg-[#F3F0E9]/50 flex items-center gap-1.5 overflow-x-auto text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-[#1B2428] text-white'
                  : 'text-[#7D8A89] hover:bg-[#E8E5DE] hover:text-[#1B2428]'
              }`}
            >
              All ({transactions.length})
            </button>
            <button
              onClick={() => setFilterType('swap')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                filterType === 'swap'
                  ? 'bg-[#387B60] text-white'
                  : 'text-[#7D8A89] hover:bg-[#E8E5DE] hover:text-[#1B2428]'
              }`}
            >
              Swaps ({swapCount})
            </button>
            <button
              onClick={() => setFilterType('transfer')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                filterType === 'transfer'
                  ? 'bg-[#1B2428] text-white'
                  : 'text-[#7D8A89] hover:bg-[#E8E5DE] hover:text-[#1B2428]'
              }`}
            >
              Transfers ({transferCount})
            </button>
          </div>
        )}

        {isLoading && transactions.length === 0 ? (
          <div className="divide-y divide-[#DAD8D1] p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="py-2 space-y-2">
                <Skeleton height="1.25rem" className="w-24" />
                <Skeleton height="1rem" className="w-72 max-w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-6 text-center text-xs">
            <AlertCircle size={20} className="text-[#BA6249] mx-auto mb-2" />
            <p className="font-semibold text-[#BA6249]">
              {errorType === 'forbidden'
                ? 'Mainnet Access Restricted (HTTP 403)'
                : errorType === 'rate_limit'
                ? 'Rate Limit Hit (HTTP 429)'
                : 'Failed to Retrieve Transactions'}
            </p>
            <p className="text-[#7D8A89] mt-1 max-w-sm mx-auto">{error}</p>
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={refresh}>
                Retry Mainnet Query
              </Button>
            </div>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={transactions.length > 0 ? 'No matching transactions' : 'No Transactions Found'}
            description={
              transactions.length > 0
                ? `No transactions found matching category "${filterType}".`
                : 'Enter a valid Solana address or connect a wallet to view real Mainnet activity.'
            }
          />
        ) : (
          <div>
            {filteredTransactions.map(tx => (
              <TransactionRow key={tx.signature} tx={tx} />
            ))}

            {hasMore && (
              <div className="p-3 border-t border-[#DAD8D1] text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadMore}
                  loading={isLoading}
                >
                  <ChevronDown size={14} />
                  Load Earlier Transactions
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function WalletIntelligencePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto space-y-4 p-4">
          <Skeleton height="8rem" className="w-full" />
          <Skeleton height="16rem" className="w-full" />
        </div>
      }
    >
      <WalletIntelligenceContent />
    </Suspense>
  );
}
