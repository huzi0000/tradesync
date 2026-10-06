import {
  Connection,
  PublicKey,
  ParsedTransactionWithMeta,
  LAMPORTS_PER_SOL,
  ParsedAccountData,
} from '@solana/web3.js';
import {
  DEFAULT_RPC_ENDPOINT,
  OFFICIAL_MAINNET_RPC,
  SWAP_PROGRAM_IDS,
  KNOWN_DEX_PROGRAMS,
  CACHE_TTL,
} from '../constants';
import { Transaction, TransactionType, VerificationResult } from '../../types';
import { getCached, setCached } from '../utils';

let _connection: Connection | null = null;
let _activeEndpoint: string | null = null;

export function resolveRpcUrl(rpcUrl?: string): string {
  if (typeof window !== 'undefined') {
    // If a custom external RPC was explicitly provided (e.g. Helius, QuickNode, PublicNode), use it
    if (rpcUrl && rpcUrl.startsWith('http')) {
      // If it points to official mainnet directly from browser, route through proxy to bypass 403 Origin filter
      if (rpcUrl === OFFICIAL_MAINNET_RPC || rpcUrl === 'https://api.mainnet-beta.solana.com/') {
        return `${window.location.origin}${DEFAULT_RPC_ENDPOINT}`;
      }
      return rpcUrl;
    }
    // Default to internal proxy route handler in browser
    return `${window.location.origin}${DEFAULT_RPC_ENDPOINT}`;
  }

  // Server-side
  if (rpcUrl && rpcUrl.startsWith('http')) {
    return rpcUrl;
  }
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    OFFICIAL_MAINNET_RPC
  );
}

export function getConnection(rpcUrl?: string): Connection {
  const url = resolveRpcUrl(rpcUrl);
  if (!_connection || _activeEndpoint !== url) {
    _activeEndpoint = url;
    _connection = new Connection(url, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 25000,
    });
  }
  return _connection;
}

export function resetConnection(): void {
  _connection = null;
  _activeEndpoint = null;
}

export interface ParsedRpcError {
  kind: 'forbidden' | 'rate_limit' | 'timeout' | 'network' | 'unknown';
  message: string;
  statusCode?: number;
}

export function formatRpcErrorMessage(err: unknown): ParsedRpcError {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (raw.includes('403') || lower.includes('access forbidden') || lower.includes('forbidden')) {
    return {
      kind: 'forbidden',
      statusCode: 403,
      message:
        'Solana Mainnet RPC returned HTTP 403 Access Forbidden. The upstream node restricted this request.',
    };
  }

  if (raw.includes('429') || lower.includes('rate limit') || lower.includes('too many requests')) {
    return {
      kind: 'rate_limit',
      statusCode: 429,
      message: 'Solana RPC rate limit reached. Retrying automatically...',
    };
  }

  if (lower.includes('timeout') || lower.includes('aborterror') || lower.includes('timed out')) {
    return {
      kind: 'timeout',
      message: 'Connection to Solana Mainnet timed out after 25 seconds.',
    };
  }

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('enotfound')
  ) {
    return {
      kind: 'network',
      message: 'Network offline or unable to connect to Solana RPC node.',
    };
  }

  return {
    kind: 'unknown',
    message: raw,
  };
}

export async function getSOLBalance(address: string, rpcUrl?: string): Promise<number> {
  const cacheKey = `balance:${address}`;
  const cached = getCached<number>(cacheKey);
  if (cached !== null) return cached;

  const connection = getConnection(rpcUrl);
  const pk = new PublicKey(address);

  try {
    const lamports = await connection.getBalance(pk);
    const sol = lamports / LAMPORTS_PER_SOL;
    setCached(cacheKey, sol, CACHE_TTL.balance);
    return sol;
  } catch (err) {
    const parsed = formatRpcErrorMessage(err);
    throw new Error(parsed.message);
  }
}

export async function getTokenAccounts(address: string, rpcUrl?: string) {
  const cacheKey = `tokens:${address}`;
  const cached = getCached<unknown>(cacheKey);
  if (cached !== null) return cached;

  const connection = getConnection(rpcUrl);
  const pk = new PublicKey(address);

  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pk, {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
    });

    const result = tokenAccounts.value
      .filter(account => {
        const parsed = account.account.data as ParsedAccountData;
        return (parsed.parsed?.info?.tokenAmount?.uiAmount ?? 0) > 0;
      })
      .map(account => {
        const parsed = account.account.data as ParsedAccountData;
        const info = parsed.parsed.info;
        return {
          mint: info.mint as string,
          amount: info.tokenAmount.amount as number,
          decimals: info.tokenAmount.decimals as number,
          uiAmount: info.tokenAmount.uiAmount as number,
        };
      });

    setCached(cacheKey, result, CACHE_TTL.balance);
    return result;
  } catch (err) {
    const parsed = formatRpcErrorMessage(err);
    throw new Error(parsed.message);
  }
}

export async function getTransactionHistory(
  address: string,
  limit = 20,
  before?: string,
  rpcUrl?: string
): Promise<Transaction[]> {
  const connection = getConnection(rpcUrl);
  const pk = new PublicKey(address);

  let signatures;
  try {
    signatures = await connection.getSignaturesForAddress(pk, {
      limit,
      before,
    });
  } catch (err) {
    const parsed = formatRpcErrorMessage(err);
    throw new Error(parsed.message);
  }

  if (!signatures || !signatures.length) return [];

  const txPromises = signatures.map(sig =>
    connection
      .getParsedTransaction(sig.signature, {
        maxSupportedTransactionVersion: 1,
      })
      .catch(() => null)
  );

  const rawTxs = await Promise.all(txPromises);

  return rawTxs
    .map((tx, i) => parseParsedTransaction(tx, signatures[i]!.signature))
    .filter((tx): tx is Transaction => tx !== null);
}

function getAccountKeyString(account: unknown): string {
  if (!account) return '';
  if (typeof account === 'string') return account;
  if (typeof account === 'object' && 'pubkey' in account && account.pubkey) {
    return (account.pubkey as { toString(): string }).toString();
  }
  return String(account);
}

export function classifyTransactionType(
  tx: ParsedTransactionWithMeta
): TransactionType {
  const allAccounts = tx.transaction.message.accountKeys.map(k => getAccountKeyString(k));

  for (const id of allAccounts) {
    if (SWAP_PROGRAM_IDS.has(id)) return 'swap';
  }

  const innerProgramIds =
    tx.meta?.innerInstructions?.flatMap(ii =>
      ii.instructions.map(ix => {
        if ('programId' in ix) return ix.programId.toString();
        return '';
      })
    ) ?? [];

  for (const id of innerProgramIds) {
    if (SWAP_PROGRAM_IDS.has(id)) return 'swap';
  }

  // Check for token transfers via SPL Token program
  const tokenProgram = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  if (allAccounts.includes(tokenProgram)) return 'transfer';

  // Stake programs
  const stakeProgram = 'Stake11111111111111111111111111111111111111112';
  if (allAccounts.includes(stakeProgram)) return 'stake';

  return 'unclassified';
}

function parseParsedTransaction(
  tx: ParsedTransactionWithMeta | null,
  signature: string
): Transaction | null {
  if (!tx) return null;

  const type = classifyTransactionType(tx);

  const accountKeys = tx.transaction.message.accountKeys.map(k => getAccountKeyString(k));

  return {
    signature,
    slot: tx.slot,
    blockTime: tx.blockTime ?? null,
    status: tx.meta?.err ? 'failed' : 'success',
    type,
    fee: (tx.meta?.fee ?? 0) / 1e9,
    accounts: accountKeys,
    programIds: tx.transaction.message.accountKeys
      .filter(k => ('signer' in k ? !k.signer : true))
      .map(k => getAccountKeyString(k)),
    preTokenBalances:
      tx.meta?.preTokenBalances?.map(b => ({
        mint: b.mint,
        owner: b.owner ?? '',
        amount: Number(b.uiTokenAmount.amount),
        decimals: b.uiTokenAmount.decimals,
        uiAmount: b.uiTokenAmount.uiAmount ?? 0,
      })) ?? [],
    postTokenBalances:
      tx.meta?.postTokenBalances?.map(b => ({
        mint: b.mint,
        owner: b.owner ?? '',
        amount: Number(b.uiTokenAmount.amount),
        decimals: b.uiTokenAmount.decimals,
        uiAmount: b.uiTokenAmount.uiAmount ?? 0,
      })) ?? [],
  };
}

export async function verifyTransaction(
  signature: string,
  walletAddress?: string,
  rpcUrl?: string
): Promise<VerificationResult> {
  try {
    const connection = getConnection(rpcUrl);
    const tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 1,
    });

    if (!tx) {
      return {
        valid: false,
        status: 'not_found',
        signature,
        error: 'Transaction signature not found on Solana Mainnet Beta',
      };
    }

    if (tx.meta?.err) {
      return {
        valid: false,
        status: 'failed_tx',
        signature,
        slot: tx.slot,
        blockTime: tx.blockTime,
        fee: (tx.meta?.fee ?? 0) / 1e9,
        error: 'Transaction failed on-chain with program execution error',
      };
    }

    const wallets = tx.transaction.message.accountKeys
      .filter(k => ('signer' in k ? k.signer : false))
      .map(k => getAccountKeyString(k));

    if (walletAddress && !wallets.includes(walletAddress)) {
      return {
        valid: false,
        status: 'unsupported',
        signature,
        slot: tx.slot,
        blockTime: tx.blockTime,
        fee: (tx.meta?.fee ?? 0) / 1e9,
        wallets,
        error: 'Connected wallet address is not a signer of this transaction',
      };
    }

    const allAccountKeys = tx.transaction.message.accountKeys.map(k => getAccountKeyString(k));
    let swapProgram: string | undefined;
    let swapProgramName: string | undefined;

    for (const key of allAccountKeys) {
      if (SWAP_PROGRAM_IDS.has(key)) {
        swapProgram = key;
        swapProgramName = KNOWN_DEX_PROGRAMS[key];
        break;
      }
    }

    if (!swapProgram) {
      const innerProgramIds =
        tx.meta?.innerInstructions?.flatMap(ii =>
          ii.instructions.map(ix =>
            'programId' in ix ? ix.programId.toString() : ''
          )
        ) ?? [];
      for (const id of innerProgramIds) {
        if (SWAP_PROGRAM_IDS.has(id)) {
          swapProgram = id;
          swapProgramName = KNOWN_DEX_PROGRAMS[id];
          break;
        }
      }
    }

    const pre = tx.meta?.preTokenBalances ?? [];
    const post = tx.meta?.postTokenBalances ?? [];

    let inputToken: VerificationResult['inputToken'];
    let outputToken: VerificationResult['outputToken'];

    const changes = new Map<
      string,
      { before: number; after: number; decimals: number }
    >();
    for (const b of pre) {
      changes.set(b.mint, {
        before: b.uiTokenAmount.uiAmount ?? 0,
        after: 0,
        decimals: b.uiTokenAmount.decimals,
      });
    }
    for (const b of post) {
      const existing = changes.get(b.mint);
      if (existing) {
        existing.after = b.uiTokenAmount.uiAmount ?? 0;
      } else {
        changes.set(b.mint, {
          before: 0,
          after: b.uiTokenAmount.uiAmount ?? 0,
          decimals: b.uiTokenAmount.decimals,
        });
      }
    }

    const decreases: Array<{ mint: string; amount: number; decimals: number }> =
      [];
    const increases: Array<{ mint: string; amount: number; decimals: number }> =
      [];

    for (const [mint, { before, after, decimals }] of changes.entries()) {
      const diff = after - before;
      if (diff < -0.000001)
        decreases.push({ mint, amount: Math.abs(diff), decimals });
      if (diff > 0.000001) increases.push({ mint, amount: diff, decimals });
    }

    if (decreases.length > 0) {
      const d = decreases[0]!;
      inputToken = { mint: d.mint, amount: d.amount, decimals: d.decimals };
    }
    if (increases.length > 0) {
      const i = increases[0]!;
      outputToken = { mint: i.mint, amount: i.amount, decimals: i.decimals };
    }

    if (!swapProgram) {
      return {
        valid: false,
        status: 'unsupported',
        signature,
        slot: tx.slot,
        blockTime: tx.blockTime,
        fee: (tx.meta?.fee ?? 0) / 1e9,
        wallets,
        error:
          'No recognized DEX swap program (Jupiter, Raydium, Orca, OpenBook, Phoenix) detected in transaction instructions',
      };
    }

    return {
      valid: true,
      status: 'verified_swap',
      signature,
      slot: tx.slot,
      blockTime: tx.blockTime,
      fee: (tx.meta?.fee ?? 0) / 1e9,
      wallets,
      inputToken,
      outputToken,
      programId: `${swapProgramName ?? swapProgram}`,
    };
  } catch (err) {
    const parsed = formatRpcErrorMessage(err);
    return {
      valid: false,
      status: 'error',
      signature,
      error: parsed.message,
    };
  }
}
