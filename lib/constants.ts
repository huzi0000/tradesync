export const OFFICIAL_MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
export const DEFAULT_PUBLIC_FALLBACK_RPC = 'https://solana-rpc.publicnode.com';
export const DEFAULT_RPC_ENDPOINT = '/api/rpc';

export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || DEFAULT_RPC_ENDPOINT;

export const DEXSCREENER_API = 'https://api.dexscreener.com/latest';

export const SOLSCAN_BASE = 'https://solscan.io';

export const KNOWN_DEX_PROGRAMS: Record<string, string> = {
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter v6',
  'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB': 'Jupiter v4',
  'JUP3c2Uh3WA4Ng34tw6kPd2G4LFNUtpzd5tera3Hgt': 'Jupiter v3',
  '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP': 'Orca v1',
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': 'Orca Whirlpools',
  'RVKd61ztZW9GUwhRbbLoYVRE5Xf1B2tVscKqwZqXgEr': 'Raydium v2',
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium v4 AMM',
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK': 'Raydium CLMM',
  'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJejB': 'OpenBook',
  'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY': 'Phoenix',
};

export const SWAP_PROGRAM_IDS = new Set(Object.keys(KNOWN_DEX_PROGRAMS));

export const SOL_MINT = 'So11111111111111111111111111111111111111112';

export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

export const DEFAULT_APP_SETTINGS = {
  rpcUrl: SOLANA_RPC_URL,
  autoRefresh: true,
  refreshInterval: 30,
  displayCurrency: 'USD' as const,
  theme: 'system' as const,
};

export const CACHE_TTL = {
  price: 30 * 1000,       // 30 seconds
  balance: 15 * 1000,     // 15 seconds  
  transactions: 60 * 1000, // 1 minute
  tokenInfo: 5 * 60 * 1000, // 5 minutes
};
