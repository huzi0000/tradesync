import { NextRequest, NextResponse } from 'next/server';

// Server-side Solana RPC URL (keeps private API keys safe and avoids browser Origin 403 blocks)
const PRIMARY_UPSTREAM_RPC =
  process.env.SOLANA_RPC_URL ||
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  'https://api.mainnet-beta.solana.com';

const FALLBACK_UPSTREAM_RPC =
  process.env.SOLANA_FALLBACK_RPC || 'https://solana-rpc.publicnode.com';

// Security Allowlist: Only read-only intelligence methods permitted in Phase 1 & 2
const ALLOWED_RPC_METHODS = new Set([
  'getBalance',
  'getAccountInfo',
  'getMultipleAccounts',
  'getTokenAccountsByOwner',
  'getParsedTokenAccountsByOwner',
  'getSignaturesForAddress',
  'getTransaction',
  'getParsedTransaction',
  'getSlot',
  'getLatestBlockhash',
  'getHealth',
  'getBlockTime',
  'getEpochInfo',
  'getVersion',
  'getInflationRate',
  'getSupply',
]);

// Maximum payload size (64 KB)
const MAX_PAYLOAD_SIZE = 64 * 1024;

// Simple in-memory sliding window rate limiter (120 req / minute per IP)
const ipRequestHistory = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 120;

  const timestamps = (ipRequestHistory.get(ip) ?? []).filter(t => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    return true;
  }
  timestamps.push(now);
  ipRequestHistory.set(ip, timestamps);
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';

    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          error: { code: 429, message: 'Too many RPC requests. Rate limit is 120/min per IP.' },
          id: null,
        },
        { status: 429 }
      );
    }

    const rawBody = await request.text();
    if (rawBody.length > MAX_PAYLOAD_SIZE) {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Request payload exceeds 64KB size limit.' },
          id: null,
        },
        { status: 413 }
      );
    }

    // Validate JSON-RPC structure and method allowlist
    let parsed: { method?: string; id?: unknown; jsonrpc?: string };
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error: invalid JSON' }, id: null },
        { status: 400 }
      );
    }

    if (!parsed.method || !ALLOWED_RPC_METHODS.has(parsed.method)) {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: `Method '${parsed.method}' is not permitted by TradeSync security policy. Only verified read-only queries are allowed.`,
          },
          id: parsed.id ?? null,
        },
        { status: 403 }
      );
    }

    const upstreamHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (process.env.SOLANA_RPC_API_KEY) {
      upstreamHeaders['Authorization'] = `Bearer ${process.env.SOLANA_RPC_API_KEY}`;
    }

    // Attempt primary upstream with 15s timeout
    const fetchUpstream = async (url: string) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        return await fetch(url, {
          method: 'POST',
          headers: upstreamHeaders,
          body: rawBody,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
    };

    let upstreamResponse = await fetchUpstream(PRIMARY_UPSTREAM_RPC).catch(() => null);

    // If primary returned 5xx or failed to connect, try fallback
    if (!upstreamResponse || upstreamResponse.status >= 500) {
      upstreamResponse = await fetchUpstream(FALLBACK_UPSTREAM_RPC).catch(() => null);
    }

    if (!upstreamResponse) {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          error: { code: -32000, message: 'All configured Solana RPC upstream nodes are currently unreachable.' },
          id: parsed.id ?? null,
        },
        { status: 504 }
      );
    }

    const responseText = await upstreamResponse.text();

    if (!upstreamResponse.ok) {
      if (upstreamResponse.status === 403) {
        return NextResponse.json(
          {
            jsonrpc: '2.0',
            error: {
              code: 403,
              message: 'Upstream Solana RPC returned 403 Forbidden. Upstream requires authorization or origin restriction.',
            },
            id: parsed.id ?? null,
          },
          { status: 403 }
        );
      }
      if (upstreamResponse.status === 429) {
        return NextResponse.json(
          {
            jsonrpc: '2.0',
            error: {
              code: 429,
              message: 'Solana RPC rate limit reached. Please retry in a few seconds.',
            },
            id: parsed.id ?? null,
          },
          { status: 429 }
        );
      }
    }

    return new NextResponse(responseText, {
      status: upstreamResponse.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === 'AbortError' || error.message.includes('timeout'));

    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: {
          code: isTimeout ? -32000 : -32603,
          message: isTimeout
            ? 'RPC request timed out after 15 seconds'
            : error instanceof Error
              ? error.message
              : 'Internal RPC proxy failure',
        },
        id: null,
      },
      { status: isTimeout ? 504 : 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    network: 'mainnet-beta',
    service: 'TradeSync Mainnet RPC Proxy (Hardened)',
    allowedMethods: Array.from(ALLOWED_RPC_METHODS),
  });
}
