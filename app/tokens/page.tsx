'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import { searchTokenByMint } from '../../lib/api/dexscreener';
import { useWatchlist } from '../../hooks/useWatchlist';
import { DexPair } from '../../types';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { AddressDisplay } from '../../components/ui/AddressDisplay';
import {
  Search,
  Star,
  StarOff,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from 'lucide-react';
import {
  formatUSD,
  formatCompactNumber,
  formatPercentage,
  isValidSolanaAddress,
  getSolscanTokenUrl,
} from '../../lib/utils';
import { getDexScreenerPairUrl } from '../../lib/api/dexscreener';

function PriceChange({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span
      className={`flex items-center gap-0.5 text-xs font-mono ${positive ? 'text-[#387B60]' : 'text-[#BA6249]'}`}
    >
      {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {formatPercentage(value)}
    </span>
  );
}

function PairCard({ pair }: { pair: DexPair }) {
  const priceUsd = pair.priceUsd ? parseFloat(pair.priceUsd) : null;
  return (
    <div className="p-4 border-b border-[#DAD8D1] last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[#1B2428]">
              {pair.baseToken.symbol}/{pair.quoteToken.symbol}
            </span>
            <Badge variant="neutral">{pair.dexId}</Badge>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xl font-mono font-semibold text-[#1B2428]">
              {priceUsd !== null
                ? formatUSD(priceUsd)
                : `${pair.priceNative} ${pair.quoteToken.symbol}`}
            </span>
            {pair.priceChange?.h24 !== undefined && (
              <PriceChange value={pair.priceChange.h24} />
            )}
          </div>
        </div>
        <a
          href={getDexScreenerPairUrl(pair.pairAddress)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 p-1.5 rounded text-[#7D8A89] hover:text-[#1B2428] hover:bg-[#F3F0E9] transition-colors"
          aria-label="View on DexScreener"
        >
          <ExternalLink size={14} />
        </a>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {pair.volume?.h24 !== undefined && (
          <div>
            <p className="text-xs text-[#7D8A89]">24h Volume</p>
            <p className="text-sm font-mono text-[#1B2428] mt-0.5">
              ${formatCompactNumber(pair.volume.h24)}
            </p>
          </div>
        )}
        {pair.liquidity?.usd !== undefined && (
          <div>
            <p className="text-xs text-[#7D8A89]">Liquidity</p>
            <p className="text-sm font-mono text-[#1B2428] mt-0.5">
              ${formatCompactNumber(pair.liquidity.usd)}
            </p>
          </div>
        )}
        {pair.fdv !== undefined && (
          <div>
            <p className="text-xs text-[#7D8A89]">FDV</p>
            <p className="text-sm font-mono text-[#1B2428] mt-0.5">
              ${formatCompactNumber(pair.fdv)}
            </p>
          </div>
        )}
        {pair.marketCap !== undefined && (
          <div>
            <p className="text-xs text-[#7D8A89]">Mkt Cap</p>
            <p className="text-sm font-mono text-[#1B2428] mt-0.5">
              ${formatCompactNumber(pair.marketCap)}
            </p>
          </div>
        )}
      </div>

      {/* Price changes */}
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        {(
          [
            { label: '5m', val: pair.priceChange?.m5 },
            { label: '1h', val: pair.priceChange?.h1 },
            { label: '6h', val: pair.priceChange?.h6 },
            { label: '24h', val: pair.priceChange?.h24 },
          ] as const
        )
          .filter(({ val }) => val !== undefined)
          .map(({ label, val }) => (
            <div key={label} className="flex items-center gap-1">
              <span className="text-xs text-[#7D8A89]">{label}</span>
              <PriceChange value={val!} />
            </div>
          ))}
      </div>
    </div>
  );
}

function TokenExplorerContent() {
  const searchParams = useSearchParams();
  const paramMint = searchParams.get('mint') ?? '';
  const [mint, setMint] = useState(paramMint);
  const [pairs, setPairs] = useState<DexPair[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { add, remove, has } = useWatchlist();

  const doSearch = async (address: string) => {
    const trimmed = address.trim();
    if (!isValidSolanaAddress(trimmed)) {
      setError('Please enter a valid Solana mint address');
      return;
    }
    setIsLoading(true);
    setError(null);
    setPairs(null);
    try {
      const result = await searchTokenByMint(trimmed);
      if (!result || result.length === 0) {
        setError(
          'No trading pairs found. The token may not be listed on a DexScreener-supported DEX.',
        );
      } else {
        setPairs(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch token data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (paramMint && isValidSolanaAddress(paramMint)) {
      doSearch(paramMint);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramMint]);

  const topPair = pairs?.[0];
  const inWatchlist = topPair ? has(topPair.baseToken.address) : false;

  const toggleWatchlist = () => {
    if (!topPair) return;
    if (inWatchlist) {
      remove(topPair.baseToken.address);
    } else {
      add({
        mint: topPair.baseToken.address,
        symbol: topPair.baseToken.symbol,
        name: topPair.baseToken.name,
      });
    }
  };

  const mintError =
    mint && !isValidSolanaAddress(mint) ? 'Invalid Solana mint address' : undefined;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Token Explorer</CardTitle>
        </CardHeader>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <Input
              placeholder="Enter token mint address (e.g. EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)"
              value={mint}
              onChange={e => {
                setMint(e.target.value);
                setError(null);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') doSearch(mint);
              }}
              error={mintError}
            />
          </div>
          <Button onClick={() => doSearch(mint)} loading={isLoading} disabled={!mint.trim() || !!mintError}>
            <Search size={15} />
            <span className="hidden sm:inline">Search</span>
          </Button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap mt-3 text-xs">
          <span className="text-[#7D8A89]">Presets:</span>
          {[
            { label: 'SOL', mint: 'So11111111111111111111111111111111111111112' },
            { label: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
            { label: 'USDT', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' },
            { label: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
            { label: 'RAY', mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' },
          ].map(p => (
            <button
              key={p.label}
              onClick={() => {
                setMint(p.mint);
                doSearch(p.mint);
              }}
              className="px-2 py-0.5 rounded border border-[#DEDCD5] bg-[#F3F0E9] hover:bg-[#E8E5DE] text-[#1B2428] font-mono transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-[#7D8A89] mt-2">
          Public DexScreener API quotes for Solana trading pairs. Real-time liquidity, volume, and spread.
        </p>
      </Card>

      {/* Token header */}
      {topPair && (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-[#1B2428]">{topPair.baseToken.name}</h2>
                <Badge variant="neutral">{topPair.baseToken.symbol}</Badge>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <AddressDisplay
                  address={topPair.baseToken.address}
                  chars={6}
                  explorerUrl={getSolscanTokenUrl(topPair.baseToken.address)}
                />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={toggleWatchlist}>
              {inWatchlist ? <StarOff size={14} /> : <Star size={14} />}
              <span className="hidden sm:inline">{inWatchlist ? 'Unwatch' : 'Watch'}</span>
            </Button>
          </div>
        </Card>
      )}

      {isLoading && (
        <Card padding={false}>
          <div className="divide-y divide-[#DAD8D1]">
            {[1, 2].map(i => (
              <div key={i} className="p-4 space-y-3">
                <Skeleton height="1.25rem" className="w-32" />
                <Skeleton height="2rem" className="w-48 max-w-full" />
                <div className="grid grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map(j => (
                    <Skeleton key={j} height="1rem" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {error && !isLoading && (
        <Card>
          <div className="flex items-start gap-2 text-xs text-[#BA6249]">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        </Card>
      )}

      {pairs && pairs.length > 0 && !isLoading && (
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-[#DAD8D1]">
            <h3 className="text-sm font-semibold text-[#1B2428]">
              Trading Pairs ({pairs.length})
            </h3>
          </div>
          <div>
            {pairs.slice(0, 10).map(pair => (
              <PairCard key={pair.pairAddress} pair={pair} />
            ))}
          </div>
        </Card>
      )}

      {!pairs && !isLoading && !error && (
        <EmptyState
          icon={Search}
          title="Search for a token"
          description="Enter a Solana mint address to explore real-time trading data from DexScreener."
        />
      )}
    </div>
  );
}

export default function TokensPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <Skeleton height="4rem" />
        </Card>
      }
    >
      <TokenExplorerContent />
    </Suspense>
  );
}
