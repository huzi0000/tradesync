export interface WalletState {
  connected: boolean;
  publicKey: string | null;
  balance: number | null;
  isLoading: boolean;
  error: string | null;
}

export interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  uiAmount: number;
  symbol?: string;
  name?: string;
  logoURI?: string;
  price?: number;
  priceChange24h?: number;
  value?: number;
}

export interface Transaction {
  signature: string;
  slot: number;
  blockTime: number | null;
  status: 'success' | 'failed' | 'unknown';
  type: TransactionType;
  fee: number;
  accounts: string[];
  programIds: string[];
  preTokenBalances?: TokenBalanceChange[];
  postTokenBalances?: TokenBalanceChange[];
  memo?: string;
}

export type TransactionType = 
  | 'swap'
  | 'transfer'
  | 'stake'
  | 'unstake'
  | 'mint'
  | 'burn'
  | 'create_account'
  | 'close_account'
  | 'unclassified';

export interface TokenBalanceChange {
  mint: string;
  owner: string;
  amount: number;
  decimals: number;
  uiAmount: number;
}

export interface VerificationResult {
  valid: boolean;
  status: 'verified_swap' | 'failed_tx' | 'not_found' | 'unsupported' | 'error';
  signature: string;
  slot?: number;
  blockTime?: number | null;
  fee?: number;
  wallets?: string[];
  inputToken?: {
    mint: string;
    symbol?: string;
    amount: number;
    decimals: number;
  };
  outputToken?: {
    mint: string;
    symbol?: string;
    amount: number;
    decimals: number;
  };
  programId?: string;
  isOwnerVerified?: boolean;
  signerWallet?: string;
  error?: string;
}

export interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd?: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity?: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv?: number;
  marketCap?: number;
  info?: {
    imageUrl?: string;
    websites?: { url: string }[];
    socials?: { type: string; url: string }[];
  };
}

export interface DexScreenerResponse {
  schemaVersion: string;
  pairs: DexPair[] | null;
}

export interface WatchlistToken {
  mint: string;
  symbol: string;
  name: string;
  addedAt: number;
  notes?: string;
  targetPrice?: number;
}

export interface AppSettings {
  rpcUrl: string;
  autoRefresh: boolean;
  refreshInterval: number;
  displayCurrency: 'USD' | 'SOL';
  theme: 'light' | 'dark' | 'system';
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

// ==========================================
// PHASE 2 ADDITIONS: MULTIPLAYER & INTELLIGENCE
// ==========================================

export interface TrackedWallet {
  id: string;
  address: string;
  label: string;
  category?: 'Whale' | 'Market Maker' | 'Alpha Caller' | 'Deployer' | 'Personal' | 'Other';
  notes?: string;
  addedAt: number;
  isOwnerVerified?: boolean;
  colorTag?: string;
  lastActiveSlot?: number;
}

export interface AuthSession {
  authenticated: boolean;
  walletAddress: string | null;
  userId: string | null;
  displayName?: string;
  issuedAt?: number;
  expiresAt?: number;
}

export interface AuthChallenge {
  nonce: string;
  message: string;
  domain: string;
  address: string;
  issuedAt: string;
  expiresAt: string;
}

export interface AlphaRoom {
  id: string;
  name: string;
  slug: string;
  description: string;
  memberCount: number;
  isPrivate: boolean;
  inviteCode: string;
  createdBy: string;
  createdAt: number;
  tags: string[];
  currentUserRole?: 'admin' | 'member';
}

export interface RoomMember {
  userId: string;
  walletAddress: string;
  displayName: string;
  role: 'admin' | 'member';
  joinedAt: number;
}

export interface RoomPost {
  id: string;
  roomId: string;
  authorId: string;
  authorAddress: string;
  authorName: string;
  content: string;
  postType: 'note' | 'trade' | 'research' | 'alert';
  tradeData?: VerifiedTradeRecord;
  createdAt: number;
}

export interface VerifiedTradeRecord {
  id: string;
  roomId?: string;
  signature: string;
  slot: number;
  blockTime: number | null;
  dexName: string;
  inputToken: {
    mint: string;
    symbol: string;
    amount: number;
    decimals: number;
  };
  outputToken: {
    mint: string;
    symbol: string;
    amount: number;
    decimals: number;
  };
  signerWallet: string;
  isOwnerVerified: boolean;
  submittedByAddress: string;
  submittedAt: number;
}

export interface SharedWatchlistToken {
  id: string;
  roomId: string;
  mint: string;
  symbol: string;
  name: string;
  notes?: string;
  addedByAddress: string;
  targetPrice?: number;
  alertThreshold?: number;
  addedAt: number;
}

export type AlertRuleType = 
  | 'wallet_swap'
  | 'token_movement'
  | 'price_threshold'
  | 'concentration_risk';

export interface AlertRule {
  id: string;
  name: string;
  ruleType: AlertRuleType;
  targetAddress: string;
  parameters: {
    thresholdUSD?: number;
    tokenMint?: string;
    direction?: 'above' | 'below';
    minSwapSOL?: number;
    maxConcentrationPct?: number;
  };
  isEnabled: boolean;
  createdAt: number;
  lastTriggeredAt?: number;
}

export interface AlertHistoryItem {
  id: string;
  ruleId: string;
  ruleName: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  isRead: boolean;
  triggeredAt: number;
  metadata?: Record<string, unknown>;
}

export interface RiskIntelligenceReport {
  walletAddress: string;
  concentrationScore: number; // 0-100 (100 = high risk)
  dominantTokenSymbol?: string;
  dominantTokenPercentage: number;
  lowLiquidityTokens: string[];
  largeExposureCount: number;
  activityVelocityScore: 'Low' | 'Moderate' | 'High';
  findings: Array<{
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    evidence: string;
  }>;
  evaluatedAt: number;
}
