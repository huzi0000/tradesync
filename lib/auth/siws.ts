import crypto from 'crypto';
import { PublicKey } from '@solana/web3.js';
import type { AuthChallenge, AuthSession } from '@/types';
import { getSupabaseServerClient } from '@/lib/supabase/server';

// In-memory nonce store for quick local lookups
interface NonceEntry {
  nonce: string;
  address: string;
  issuedAt: number;
  expiresAt: number;
  consumed: boolean;
}

const nonceStore = new Map<string, NonceEntry>();
const consumedNonces = new Set<string>();

// Secret key for signing session cookies and challenge tokens
const SESSION_SECRET =
  process.env.AUTH_SECRET ||
  process.env.SESSION_SECRET ||
  process.env.SUPABASE_JWT_SECRET ||
  'tradesync_secure_session_secret_2026_mainnet_porcelain';

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Housekeeping: clean expired nonces every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [nonce, entry] of nonceStore.entries()) {
    if (now > entry.expiresAt || entry.consumed) {
      nonceStore.delete(nonce);
    }
  }
  if (consumedNonces.size > 10000) {
    consumedNonces.clear();
  }
}, 2 * 60 * 1000).unref?.();

/**
 * Creates an HMAC-signed stateless challenge token for cross-instance serverless verification
 */
export function createChallengeToken(nonce: string, address: string, expiresAt: number): string {
  const data = `${nonce}:${address}:${expiresAt}`;
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('hex');
  return `${data}:${sig}`;
}

/**
 * Verifies an HMAC-signed challenge token
 */
export function verifyChallengeToken(token: string, nonce: string, address: string): boolean {
  try {
    const parts = token.split(':');
    if (parts.length !== 4) return false;
    const [tNonce, tAddress, tExpiresAt, tSig] = parts;
    if (tNonce !== nonce || tAddress !== address) return false;

    const expiresAt = parseInt(tExpiresAt, 10);
    if (isNaN(expiresAt) || Date.now() > expiresAt) return false;

    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(`${tNonce}:${tAddress}:${tExpiresAt}`)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(tSig), Buffer.from(expectedSig));
  } catch {
    return false;
  }
}

/**
 * Creates an SIWS challenge for a Solana wallet address
 */
export function createAuthChallenge(
  address: string,
  domain: string
): AuthChallenge & { challengeToken: string } {
  if (!PublicKey.isOnCurve(address)) {
    throw new Error('Invalid Solana public key');
  }

  const nonce = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  const expiresAt = now + NONCE_TTL_MS;

  const challenge: AuthChallenge = {
    nonce,
    domain,
    address,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    message: [
      `${domain} wants you to sign in with your Solana account:`,
      `${address}`,
      '',
      'Sign this message to authenticate your wallet session with TradeSync.',
      '',
      `URI: https://${domain}`,
      `Version: 1`,
      `Nonce: ${nonce}`,
      `Issued At: ${new Date(now).toISOString()}`,
      `Expiration Time: ${new Date(expiresAt).toISOString()}`,
    ].join('\n'),
  };

  nonceStore.set(nonce, {
    nonce,
    address,
    issuedAt: now,
    expiresAt,
    consumed: false,
  });

  const challengeToken = createChallengeToken(nonce, address, expiresAt);

  return {
    ...challenge,
    challengeToken,
  };
}

/**
 * Validates the ed25519 signature of the message against the wallet address
 */
export function verifyWalletSignature(
  address: string,
  message: string,
  signatureHex: string,
  nonce: string,
  challengeToken?: string
): boolean {
  // Check replay protection first
  if (consumedNonces.has(nonce)) {
    throw new Error('Replay detected: this challenge nonce was already consumed.');
  }

  // 1. Check in-memory store
  const entry = nonceStore.get(nonce);
  let isValidChallenge = false;

  if (entry) {
    if (entry.consumed) {
      throw new Error('Replay detected: this challenge nonce was already consumed.');
    }
    if (Date.now() > entry.expiresAt) {
      nonceStore.delete(nonce);
      throw new Error('Challenge expired. Please request a new challenge.');
    }
    if (entry.address !== address) {
      throw new Error('Wallet address does not match the challenge address.');
    }
    entry.consumed = true;
    nonceStore.delete(nonce);
    isValidChallenge = true;
  } else if (challengeToken) {
    // 2. Fall back to stateless HMAC challenge token for multi-instance serverless
    if (verifyChallengeToken(challengeToken, nonce, address)) {
      isValidChallenge = true;
    } else {
      throw new Error('Challenge token is invalid or has expired.');
    }
  }

  if (!isValidChallenge) {
    throw new Error('Challenge nonce not found or has expired. Please request a new challenge.');
  }

  // Mark nonce consumed
  consumedNonces.add(nonce);

  // 2. Cryptographic ed25519 signature verification using Node.js crypto
  try {
    const pubKey = new PublicKey(address);
    const pubkeyBytes = pubKey.toBytes();

    // DER SPKI prefix for Ed25519: 302a300506032b6570032100 (42 bytes total with 32-byte key)
    const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
    const spkiDer = Buffer.concat([spkiPrefix, Buffer.from(pubkeyBytes)]);
    const cryptoPublicKey = crypto.createPublicKey({
      key: spkiDer,
      format: 'der',
      type: 'spki',
    });

    const messageBuffer = Buffer.from(message, 'utf8');
    const signatureBuffer = Buffer.from(signatureHex, 'hex');

    const verified = crypto.verify(null, messageBuffer, cryptoPublicKey, signatureBuffer);

    // If Supabase is connected, record identity verification asynchronously
    if (verified) {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        Promise.resolve(
          supabase
            .from('user_profiles')
            .upsert(
              { wallet_address: address, updated_at: new Date().toISOString() },
              { onConflict: 'wallet_address' }
            )
        ).catch((err: unknown) => console.error('Supabase profile sync error:', err));
      }
    }

    return verified;
  } catch (err) {
    console.error('Cryptographic signature verification failed:', err);
    return false;
  }
}

/**
 * Creates a signed session token
 */
export function createSessionToken(walletAddress: string): string {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + SESSION_DURATION_MS;

  const payload: AuthSession = {
    authenticated: true,
    walletAddress,
    userId: crypto.createHash('sha256').update(walletAddress).digest('hex').slice(0, 32),
    displayName: `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`,
    issuedAt,
    expiresAt,
  };

  const payloadJson = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadJson)
    .digest('base64url');

  return `${payloadJson}.${signature}`;
}

/**
 * Verifies and decodes a signed session token
 */
export function verifySessionToken(token: string): AuthSession | null {
  try {
    const [payloadJson, signature] = token.split('.');
    if (!payloadJson || !signature) return null;

    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(payloadJson)
      .digest('base64url');

    if (signature !== expectedSig) return null;

    const decoded = JSON.parse(Buffer.from(payloadJson, 'base64url').toString('utf8')) as AuthSession;
    if (!decoded.expiresAt || Date.now() > decoded.expiresAt) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}
