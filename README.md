# TradeSync — Collaborative Solana Trading Intelligence Platform

TradeSync is a collaborative, Mainnet-first Solana trading intelligence platform built for traders, on-chain analysts, and private alpha desks.

Designed as an editorial, minimal institutional fintech terminal under the strict **Porcelain & Ink** design system.

- **GitHub Repository**: [https://github.com/huzi0000/tradesync](https://github.com/huzi0000/tradesync)
- **Deployment Target**: Vercel (Hobby Free-Tier Compatible)
- **Database**: Dual-mode (Standalone zero-config / Supabase PostgreSQL with RLS)
- **Blockchain**: Solana Mainnet Beta (Free Public Node JSON-RPC)
- **Budget**: $0 — Zero paid APIs, zero subscriptions required.

---

## Core Capabilities

### 1. Multi-Wallet Intelligence
- Monitor multiple public Solana addresses without requiring custodial access or private keys.
- Categorize wallets by role (`Whale`, `Market Maker`, `Alpha Caller`, `Deployer`, `Personal`).
- Distinct visual attribution: **Owned Signer** (cryptographically verified) vs **Public Monitored**.
- Real-time Mainnet transaction telemetry, token account tracking, and Solscan integration.

### 2. Cryptographic Wallet Authentication (SIWS)
- Full Sign-In-With-Solana (SIWS) specification implementation.
- Server-generated challenges with single-use cryptographically random nonces (16 bytes hex) and stateless HMAC-SHA256 challenge tokens for serverless multi-instance compatibility.
- Ed25519 signature verification on the server using native Node.js crypto primitives (zero external C++ bindings).
- Replay attack protection with immediate nonce invalidation and 5-minute TTL.
- Secure HTTP-only session cookies with HMAC-SHA256 signature verification.

### 3. Alpha Rooms (Multiplayer Collaboration)
- Private and public intelligence desks with invite code access control.
- Collaborative research notes, thesis logs, and trade feed streams.
- **Verified Trade Sharing**: Submit Solana transaction signatures; server verifies on-chain execution, classifies DEX aggregator (Jupiter v6/v4, Raydium v4/CLMM, Orca Whirlpools, Phoenix), and checks wallet participation.
- **Shared Watchlists**: Collaborate on token targets, notes, and live DexScreener pricing pools.
- Role-based permissions (`admin` vs `member`) with member removal and room management.
- Real-time cloud synchronization via Supabase Realtime when connected.

### 4. On-Chain Alert Engine & Scheduled Surveillance
- Automated surveillance rules evaluated against live Mainnet data:
  - Tracked wallet swaps
  - Watched token price thresholds
  - Portfolio concentration warnings
- In-app notification center with read/unread tracking, deduplication, and periodic polling (60s).
- **Scheduled Background Monitoring (`/api/cron/alerts`)**:
  - Secure cron endpoint authenticated via `Authorization: Bearer <CRON_SECRET>`.
  - Configured in `vercel.json` for Vercel Hobby tier (daily cron `0 0 * * *`).
  - *Honest Frequency Disclosure*: On Vercel Hobby free tier, server-side background cron executes once per 24 hours. When the application tab is active in browser, client-side polling checks rules every 60 seconds.

### 5. Rules-Based Risk Intelligence
- Explainable risk profiling grounded in public on-chain account state:
  - Asset concentration score (Herfindahl-inspired weighting)
  - Low-liquidity / unindexed mint detection
  - Activity velocity indicators
- Transparent institutional policies: zero fabricated PnL, simulated ROI, or fake predictions.

### 6. Security-Hardened Mainnet RPC Proxy
- Internal proxy route handler (`/api/rpc`) protecting client bundles from API key leakage.
- Eliminates browser Origin CORS `HTTP 403 Access Forbidden` blocks from public nodes.
- **Strict Method Allowlist**: Allows read-only queries (`getBalance`, `getSlot`, `getSignaturesForAddress`, `getTransaction`, `getTokenAccountsByOwner`, etc.); strictly rejects write or execution methods (`sendTransaction`, `requestAirdrop`).
- Request payload size limits (64KB) and sliding-window IP rate limiting (120 req/min).

---

## Design System — Porcelain & Ink

| Element | Hex Code | Design Principle |
| :--- | :--- | :--- |
| **Background** | `#F3F0E9` | Warm editorial parchment |
| **Cards & Surfaces** | `#FFFFFF` | Solid opaque card containers |
| **Primary Text** | `#1B2428` | Deep ink legible typography |
| **Secondary / Meta Text**| `#7D8A89` | Subtle technical metadata |
| **Borders** | `#DEDCD5` | Crisp 1px structural framing |
| **Dividers** | `#DAD8D1` | Minimal content separators |
| **Accent / Negative** | `#BA6249` | Terracotta alert indicator |
| **Positive / Verified** | `#387B60` | Forest green success status |
| **Selected Navigation** | `#E8E5DE` | Muted slate highlight |

**Strict Aesthetic Rules**: Zero gradients, zero neon glows, zero glassmorphism, zero backdrop blur, and zero decorative drop shadows.

---

## Quickstart & Local Setup

### 1. Prerequisites
- **Node.js**: v18.17+ or v20+
- **npm**: v9+

### 2. Installation
```bash
git clone https://github.com/huzi0000/tradesync.git
cd tradesync
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
*(All variables have sensible free-tier defaults. Supabase credentials are optional for standalone mode).*

### 4. Running Locally
```bash
# Production build & start
npm run build
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Automated QA & Security Verification

Run the comprehensive end-to-end test suite:
```bash
node test/e2e_qa_test.mjs
```

Verify strict TypeScript compilation:
```bash
npx tsc --noEmit
```

Expected output:
- **TypeScript**: 0 errors (Exit code 0)
- **E2E Test Suite**: 25/25 PASSED (Routes, SIWS Auth, Replay Defense, RPC Method Allowlist, Trade Verifier, Scheduled Cron, DexScreener Price Feed)

---

## Cloud Deployment (Vercel)

1. Fork or import repository `huzi0000/tradesync` in [Vercel Dashboard](https://vercel.com).
2. Configure Environment Variables in Project Settings:
   - `NEXT_PUBLIC_SOLANA_RPC_URL`: `/api/rpc`
   - `SOLANA_RPC_URL`: `https://solana-rpc.publicnode.com`
   - `AUTH_SECRET`: Random 32+ character hex string
   - `CRON_SECRET`: Random 32+ character hex string
   - *(Optional)* `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL
   - *(Optional)* `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Anon Key
   - *(Optional)* `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Key
3. Deploy! Vercel will automatically run `npm run build` and provision serverless functions with scheduled cron monitoring.

---

## Supabase Database Migration (Optional)

To enable persistent multi-user Alpha Rooms across separate browser clients, run the SQL migration in your Supabase SQL Editor:
```sql
-- Located at:
supabase/migrations/20261006_tradesync_phase2_schema.sql
```
This provisions:
- 13 PostgreSQL tables with UUID primary keys and foreign key constraints.
- Row-Level Security (RLS) policies enforcing ownership and private room access.
- Performance indexes on wallet addresses, room invite codes, and signatures.

---

## License
MIT License. Free for open source, commercial, and private institutional deployment.
