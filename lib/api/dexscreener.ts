import { DexScreenerResponse, DexPair } from '../../types';
import { DEXSCREENER_API } from '../constants';
import { getCached, setCached } from '../utils';
import { CACHE_TTL } from '../constants';

export async function searchTokenByMint(mintAddress: string): Promise<DexPair[] | null> {
  const cacheKey = `dex:${mintAddress}`;
  const cached = getCached<DexPair[]>(cacheKey);
  if (cached !== null) return cached;

  try {
    const res = await fetch(`${DEXSCREENER_API}/dex/tokens/${mintAddress}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error('DexScreener rate limit reached. Please retry in a few moments.');
      throw new Error(`Market data unavailable (HTTP ${res.status})`);
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new Error('Market data feed temporarily unavailable');
    }

    const data = (await res.json()) as DexScreenerResponse;
    const pairs = data.pairs ?? [];
    // Filter to Solana pairs only
    const solanaPairs = pairs.filter(p => p.chainId === 'solana');

    setCached(cacheKey, solanaPairs, CACHE_TTL.price);
    return solanaPairs;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw err;
  }
}

export async function searchTokenByQuery(query: string): Promise<DexPair[] | null> {
  const cacheKey = `dex:search:${query}`;
  const cached = getCached<DexPair[]>(cacheKey);
  if (cached !== null) return cached;

  try {
    const res = await fetch(
      `${DEXSCREENER_API}/dex/search?q=${encodeURIComponent(query)}`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) {
      if (res.status === 429) throw new Error('DexScreener rate limit reached. Please retry in a few moments.');
      throw new Error(`Market data unavailable (HTTP ${res.status})`);
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new Error('Market data feed temporarily unavailable');
    }

    const data = (await res.json()) as DexScreenerResponse;
    const pairs = data.pairs ?? [];
    const solanaPairs = pairs.filter(p => p.chainId === 'solana');

    setCached(cacheKey, solanaPairs, 15 * 1000);
    return solanaPairs;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw err;
  }
}

export async function getTokenPrices(mintAddresses: string[]): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();

  const chunks: string[][] = [];
  for (let i = 0; i < mintAddresses.length; i += 30) {
    chunks.push(mintAddresses.slice(i, i + 30));
  }

  await Promise.allSettled(
    chunks.map(async (chunk) => {
      const addresses = chunk.join(',');
      const cacheKey = `prices:${addresses}`;
      const cached = getCached<Map<string, number>>(cacheKey);
      if (cached !== null) {
        for (const [k, v] of cached.entries()) priceMap.set(k, v);
        return;
      }

      try {
        const res = await fetch(`${DEXSCREENER_API}/dex/tokens/${addresses}`, {
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return;
        const data = (await res.json()) as DexScreenerResponse;
        const pairs = data.pairs ?? [];

        const chunkMap = new Map<string, number>();
        for (const pair of pairs) {
          if (pair.chainId !== 'solana') continue;
          if (pair.priceUsd && !chunkMap.has(pair.baseToken.address)) {
            const price = parseFloat(pair.priceUsd);
            if (!isNaN(price)) {
              chunkMap.set(pair.baseToken.address, price);
              priceMap.set(pair.baseToken.address, price);
            }
          }
        }
        setCached(cacheKey, chunkMap, CACHE_TTL.price);
      } catch {
        // Silently fail for individual chunks
      }
    })
  );

  return priceMap;
}

export function getDexScreenerPairUrl(pairAddress: string): string {
  return `https://dexscreener.com/solana/${pairAddress}`;
}
