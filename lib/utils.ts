import { SOLANA_RPC_URL } from './constants';

export function formatAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatNumber(value: number | null | undefined, options?: Intl.NumberFormatOptions): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', options).format(value);
}

export function formatUSD(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (value < 0.01) return `$${value.toExponential(2)}`;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 6 : 2,
  }).format(value);
}

export function formatSOL(lamports: number | null | undefined): string {
  if (lamports === null || lamports === undefined) return '—';
  const sol = lamports / 1e9;
  return `${sol.toFixed(4)} SOL`;
}

export function formatLamportsToSOL(lamports: number): number {
  return lamports / 1e9;
}

export function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
}

export function formatCompactNumber(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
}

export function formatTimestamp(timestamp: number | null | undefined): string {
  if (!timestamp) return '—';
  return new Date(timestamp * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTimeAgo(timestamp: number | null | undefined): string {
  if (!timestamp) return '—';
  const now = Date.now() / 1000;
  const diff = now - timestamp;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

export function isValidTransactionSignature(sig: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(sig);
}

export function getSolscanTxUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}

export function getSolscanWalletUrl(address: string): string {
  return `https://solscan.io/account/${address}`;
}

export function getSolscanTokenUrl(mint: string): string {
  return `https://solscan.io/token/${mint}`;
}

export function getRpcUrl(): string {
  return SOLANA_RPC_URL;
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

const cache = new Map<string, { data: unknown; expires: number }>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCached<T>(key: string, data: T, ttl: number): void {
  cache.set(key, { data, expires: Date.now() + ttl });
}

export function clearCache(prefix?: string): void {
  if (prefix) {
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) cache.delete(key);
    }
  } else {
    cache.clear();
  }
}
