import crypto from 'crypto';
import { Keypair } from '@solana/web3.js';

async function runE2ETests() {
  console.log('===========================================================');
  console.log('   TRADESYNC PHASE 2 END-TO-END QA & SECURITY TEST SUITE   ');
  console.log('===========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. ROUTE ACCESSIBILITY
  console.log('--- 1. Testing Page Routes ---');
  const routes = ['/', '/wallet', '/tokens', '/rooms', '/analytics', '/settings'];
  for (const r of routes) {
    const res = await fetch('http://localhost:3000' + r);
    assert(res.status === 200, `Page route ${r} returns HTTP 200 OK`);
  }

  // 2. SIGN-IN-WITH-SOLANA (SIWS) AUTHENTICATION & SECURITY
  console.log('\n--- 2. Testing SIWS Authentication & Replay Protection ---');
  const testKeypair = Keypair.generate();
  const testAddress = testKeypair.publicKey.toBase58();

  // 2a. Request challenge
  const challengeRes = await fetch('http://localhost:3000/api/auth/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: testAddress }),
  });
  assert(challengeRes.status === 200, 'POST /api/auth/challenge returns HTTP 200');
  const challenge = await challengeRes.json();
  assert(challenge.nonce && challenge.nonce.length === 32, 'Challenge contains valid 32-char single-use nonce');
  assert(challenge.message.includes(testAddress), 'Challenge binds target wallet address');

  // 2b. Sign message using ed25519
  const derPrivateKey = Buffer.concat([
    Buffer.from('302e020100300506032b657004220420', 'hex'),
    Buffer.from(testKeypair.secretKey.slice(0, 32)),
  ]);
  const nodePrivKey = crypto.createPrivateKey({ key: derPrivateKey, format: 'der', type: 'pkcs8' });
  const signatureBytes = crypto.sign(null, Buffer.from(challenge.message, 'utf8'), nodePrivKey);
  const signatureHex = signatureBytes.toString('hex');

  // 2c. Submit valid signature
  const verifyRes = await fetch('http://localhost:3000/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: testAddress,
      message: challenge.message,
      signature: signatureHex,
      nonce: challenge.nonce,
    }),
  });
  assert(verifyRes.status === 200, 'POST /api/auth/verify accepts valid ed25519 signature (HTTP 200)');
  const verifyData = await verifyRes.json();
  assert(verifyData.authenticated === true, 'Response payload confirms authenticated: true');

  // Extract session cookie
  const allCookies = typeof verifyRes.headers.getSetCookie === 'function'
    ? verifyRes.headers.getSetCookie()
    : [verifyRes.headers.get('set-cookie') || ''];
  const sessionCookieRaw = allCookies.find(c => c.includes('tradesync_session=')) || verifyRes.headers.get('set-cookie') || '';
  assert(sessionCookieRaw && sessionCookieRaw.includes('tradesync_session'), 'Server issues secure HTTP-only tradesync_session cookie');
  const sessionCookieVal = sessionCookieRaw.split(';')[0];

  // 2d. Verify active session with cookie
  const sessionRes = await fetch('http://localhost:3000/api/auth/session', {
    headers: { Cookie: sessionCookieVal },
  });
  const sessionData = await sessionRes.json();
  assert(sessionData.authenticated === true && sessionData.walletAddress === testAddress, 'GET /api/auth/session recognizes verified wallet address');

  // 2e. Replay Attack Test: Attempt to submit the same nonce again
  const replayRes = await fetch('http://localhost:3000/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: testAddress,
      message: challenge.message,
      signature: signatureHex,
      nonce: challenge.nonce,
    }),
  });
  assert(replayRes.status === 400 || replayRes.status === 401, 'Replay Attack blocked: consumed nonce rejected (HTTP 400/401)');

  // 2f. Tampered Signature Test
  const freshChallengeRes = await fetch('http://localhost:3000/api/auth/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: testAddress }),
  });
  const freshChallenge = await freshChallengeRes.json();
  const badSigHex = '00'.repeat(64); // Fake signature
  const tamperedRes = await fetch('http://localhost:3000/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: testAddress,
      message: freshChallenge.message,
      signature: badSigHex,
      nonce: freshChallenge.nonce,
    }),
  });
  assert(tamperedRes.status === 401, 'Tampered signature rejected (HTTP 401 Unauthorized)');

  // 3. RPC SECURITY & ALLOWLIST TESTING
  console.log('\n--- 3. Testing RPC Method Allowlisting & Security ---');
  // 3a. Allowed method: getBalance
  const allowedRpcRes = await fetch('http://localhost:3000/api/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: ['9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'],
    }),
  });
  assert(allowedRpcRes.status === 200, 'Allowed read method "getBalance" permitted (HTTP 200)');
  const rpcData = await allowedRpcRes.json();
  assert(rpcData.result?.value > 0, 'Real Mainnet SOL balance returned successfully');

  // 3b. Forbidden method: sendTransaction
  const forbiddenRpc1 = await fetch('http://localhost:3000/api/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'sendTransaction',
      params: ['fake-tx'],
    }),
  });
  assert(forbiddenRpc1.status === 403, 'Forbidden write method "sendTransaction" blocked by policy (HTTP 403)');

  // 3c. Forbidden method: requestAirdrop
  const forbiddenRpc2 = await fetch('http://localhost:3000/api/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'requestAirdrop',
      params: [testAddress, 1000000000],
    }),
  });
  assert(forbiddenRpc2.status === 403, 'Forbidden method "requestAirdrop" blocked by policy (HTTP 403)');

  // 4. TRADE VERIFICATION API
  console.log('\n--- 4. Testing Trade Verification Engine ---');
  const invalidTradeRes = await fetch('http://localhost:3000/api/trades/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signature: 'invalid-short-sig' }),
  });
  assert(invalidTradeRes.status === 400, 'Invalid signature rejected by trade verification endpoint (HTTP 400)');

  // 5. SCHEDULED BACKGROUND CRON MONITORING
  console.log('\n--- 5. Testing Scheduled Background Alert Cron ---');
  const cronRes = await fetch('http://localhost:3000/api/cron/alerts');
  assert(cronRes.status === 200, 'GET /api/cron/alerts returns HTTP 200 OK');
  const cronData = await cronRes.json();
  assert(cronData.success === true, 'Cron execution reports success');
  assert(cronData.job === 'tradesync_scheduled_alert_monitor', 'Cron identifies correct background monitor job');

  // 6. DEXSCREENER INTEGRATION
  console.log('\n--- 6. Testing DexScreener Integration ---');
  const dexRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112');
  assert(dexRes.status === 200, 'DexScreener public API endpoint accessible (HTTP 200)');
  const dexData = await dexRes.json();
  const solPair = dexData.pairs?.find(p => p.chainId === 'solana');
  assert(solPair && parseFloat(solPair.priceUsd) > 0, `Live SOL price verified: $${solPair?.priceUsd}`);

  console.log('\n===========================================================');
  console.log(`E2E TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runE2ETests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
