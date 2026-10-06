import crypto from 'crypto';
import { Keypair, PublicKey } from '@solana/web3.js';
import { createAuthChallenge, verifyWalletSignature, createSessionToken, verifySessionToken } from '../lib/auth/siws.ts';
import { evaluateRiskProfile } from '../lib/risk/engine.ts';

async function runTestSuite() {
  console.log('====================================================');
  console.log('   TRADESYNC PHASE 2 AUTOMATED QA & SECURITY SUITE   ');
  console.log('====================================================\n');

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

  // -------------------------------------------------------------------------
  // TEST 1: SIWS Challenge Creation
  // -------------------------------------------------------------------------
  const testKeypair = Keypair.generate();
  const testAddress = testKeypair.publicKey.toBase58();
  const challenge = createAuthChallenge(testAddress, 'localhost:3000');

  assert(challenge.nonce && challenge.nonce.length === 32, 'Challenge generates 32-char hex nonce');
  assert(challenge.message.includes(testAddress), 'Challenge message binds target wallet address');
  assert(challenge.message.includes('localhost:3000'), 'Challenge binds requesting host domain');

  // -------------------------------------------------------------------------
  // TEST 2: Cryptographic ed25519 Signature Verification
  // -------------------------------------------------------------------------
  // Sign message using Node.js ed25519 private key created from keypair
  const derPrivateKey = Buffer.concat([
    Buffer.from('302e020100300506032b657004220420', 'hex'),
    Buffer.from(testKeypair.secretKey.slice(0, 32)),
  ]);
  const nodePrivKey = crypto.createPrivateKey({ key: derPrivateKey, format: 'der', type: 'pkcs8' });
  const signatureBytes = crypto.sign(null, Buffer.from(challenge.message, 'utf8'), nodePrivKey);
  const signatureHex = signatureBytes.toString('hex');

  const isValidSig = verifyWalletSignature(testAddress, challenge.message, signatureHex, challenge.nonce);
  assert(isValidSig === true, 'Valid Solana wallet signature verifies cryptographically');

  // -------------------------------------------------------------------------
  // TEST 3: Replay Protection (Single-Use Nonce)
  // -------------------------------------------------------------------------
  let replayBlocked = false;
  try {
    verifyWalletSignature(testAddress, challenge.message, signatureHex, challenge.nonce);
  } catch (err) {
    replayBlocked = err.message.includes('not found') || err.message.includes('Replay');
  }
  assert(replayBlocked === true, 'Replay protection successfully blocks reuse of consumed nonce');

  // -------------------------------------------------------------------------
  // TEST 4: Tampered Message Detection
  // -------------------------------------------------------------------------
  const freshChallenge = createAuthChallenge(testAddress, 'localhost:3000');
  const tamperedMessage = freshChallenge.message.replace('TradeSync', 'MaliciousSite');
  const tamperedSigBytes = crypto.sign(null, Buffer.from(tamperedMessage, 'utf8'), nodePrivKey);
  const isValidTampered = verifyWalletSignature(
    testAddress,
    freshChallenge.message,
    tamperedSigBytes.toString('hex'),
    freshChallenge.nonce
  );
  assert(isValidTampered === false, 'Tampered message fails cryptographic verification');

  // -------------------------------------------------------------------------
  // TEST 5: Signed HMAC Session Tokens
  // -------------------------------------------------------------------------
  const token = createSessionToken(testAddress);
  const session = verifySessionToken(token);
  assert(session && session.walletAddress === testAddress, 'Signed session token creates verified session payload');
  assert(session && session.authenticated === true, 'Session token indicates authenticated status');

  const tamperedToken = token.slice(0, -4) + 'abcd';
  assert(verifySessionToken(tamperedToken) === null, 'Tampered session token fails HMAC signature check');

  // -------------------------------------------------------------------------
  // TEST 6: Risk Intelligence Rules Engine
  // -------------------------------------------------------------------------
  const mockTokens = [
    { mint: 'TokenA', amount: 100, decimals: 6, uiAmount: 100, price: 10, value: 1000, symbol: 'TOKA' },
    { mint: 'TokenB', amount: 5, decimals: 6, uiAmount: 5, price: 2, value: 10, symbol: 'TOKB' },
  ];
  const riskReport = evaluateRiskProfile(testAddress, 0.5, mockTokens);
  assert(riskReport.concentrationScore > 70, 'Concentration risk detected for high single-asset weighting');
  assert(riskReport.dominantTokenSymbol === 'TOKA', 'Dominant asset correctly identified as TOKA');
  assert(riskReport.findings.length > 0, 'Risk findings include actionable institutional evidence');

  console.log('\n====================================================');
  console.log(`QA RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(e => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
