import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log('================================================================');
  console.log('   TRADESYNC POSTGRESQL / SUPABASE ISOLATED SECURITY TEST HARNESS');
  console.log('================================================================\n');

  const db = new PGlite();
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

  // 1. Setup mock Supabase auth environment
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
    $$;

    CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$
      SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'anon');
    $$;

    CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$
      SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::JSONB, '{}'::JSONB);
    $$;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
      END IF;
    END $$;

    -- Grant schema permissions
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
  `);

  console.log('[SETUP] Mock Supabase auth schema and roles created.');

  // 2. Read and execute the migration SQL
  const migrationPath = path.resolve('supabase/migrations/20261006_tradesync_phase2_schema.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  try {
    await db.exec(migrationSql);
    console.log('[SETUP] Hardened SQL migration executed successfully without syntax errors.\n');
  } catch (err) {
    console.error('[FATAL] Migration execution failed:', err);
    process.exit(1);
  }

  // Grant table permissions for RLS testing
  await db.exec(`
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
  `);

  // Helper context setters
  async function asUser(userId, walletAddress) {
    const claims = JSON.stringify({
      sub: userId,
      role: 'authenticated',
      wallet_address: walletAddress,
      app_metadata: { wallet_address: walletAddress },
    });
    await db.exec(`
      SET request.jwt.claim.sub = '${userId}';
      SET request.jwt.claim.role = 'authenticated';
      SET request.jwt.claim.wallet_address = '${walletAddress}';
      SET request.jwt.claims = '${claims}';
      SET ROLE authenticated;
    `);
  }

  async function asAnon() {
    await db.exec(`
      RESET request.jwt.claim.sub;
      SET request.jwt.claim.role = 'anon';
      RESET request.jwt.claim.wallet_address;
      SET request.jwt.claims = '{}';
      SET ROLE anon;
    `);
  }

  async function asServiceRole() {
    await db.exec(`
      RESET request.jwt.claim.sub;
      SET request.jwt.claim.role = 'service_role';
      RESET request.jwt.claim.wallet_address;
      SET request.jwt.claims = '{"role": "service_role"}';
      RESET ROLE;
    `);
  }

  // --- SEED IDENTITIES (via service_role) ---
  await asServiceRole();

  const userA_id = '11111111-1111-1111-1111-111111111111';
  const userA_wallet = 'UserA11111111111111111111111111111111111111';
  const userB_id = '22222222-2222-2222-2222-222222222222';
  const userB_wallet = 'UserB22222222222222222222222222222222222222';
  const userC_id = '33333333-3333-3333-3333-333333333333';
  const userC_wallet = 'UserC33333333333333333333333333333333333333';

  await db.exec(`
    INSERT INTO public.user_profiles (id, wallet_address, display_name) VALUES
      ('${userA_id}', '${userA_wallet}', 'User Alpha'),
      ('${userB_id}', '${userB_wallet}', 'User Beta'),
      ('${userC_id}', '${userC_wallet}', 'User Gamma');
  `);

  // --- TEST 1: User A creates private room ---
  await asUser(userA_id, userA_wallet);
  const roomId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  await db.exec(`
    INSERT INTO public.trading_rooms (id, name, slug, is_private, invite_code, created_by)
    VALUES ('${roomId}', 'Alpha Syndicate', 'alpha-syndicate', true, 'INVITE-A-123', '${userA_id}');
    
    INSERT INTO public.room_members (room_id, user_id, role)
    VALUES ('${roomId}', '${userA_id}', 'admin');
  `);
  assert(true, 'Test 1: User A successfully created private room as admin');

  // --- TEST 2: User B tries to view User A private room ---
  await asUser(userB_id, userB_wallet);
  const readRes = await db.query(`SELECT * FROM public.trading_rooms WHERE id = '${roomId}'`);
  assert(readRes.rows.length === 0, 'Test 2: User B cannot view User A private room (RLS isolated)');

  // --- TEST 3: User B tries to insert self into User A private room ---
  let joinBlocked = false;
  try {
    await db.exec(`
      INSERT INTO public.room_members (room_id, user_id, role)
      VALUES ('${roomId}', '${userB_id}', 'member');
    `);
  } catch (err) {
    joinBlocked = true;
  }
  assert(joinBlocked, 'Test 3: User B direct join to private room rejected by RLS');

  // --- TEST 4: User B tries to escalate to admin role ---
  let adminEscalationBlocked = false;
  try {
    // Create a public room by User A first
    await asUser(userA_id, userA_wallet);
    const pubRoomId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    await db.exec(`
      INSERT INTO public.trading_rooms (id, name, slug, is_private, invite_code, created_by)
      VALUES ('${pubRoomId}', 'Public Arena', 'public-arena', false, 'PUB-123', '${userA_id}');
      INSERT INTO public.room_members (room_id, user_id, role)
      VALUES ('${pubRoomId}', '${userA_id}', 'admin');
    `);

    // Now User B tries to join public room as admin
    await asUser(userB_id, userB_wallet);
    await db.exec(`
      INSERT INTO public.room_members (room_id, user_id, role)
      VALUES ('${pubRoomId}', '${userB_id}', 'admin');
    `);
  } catch (err) {
    adminEscalationBlocked = true;
  }
  assert(adminEscalationBlocked, 'Test 4: User self-assigning admin role rejected by trigger/RLS');

  // --- TEST 5: User B tries to post to private room (author_id = User B) ---
  let postWithoutMembershipBlocked = false;
  try {
    await asUser(userB_id, userB_wallet);
    await db.exec(`
      INSERT INTO public.room_posts (room_id, author_id, content)
      VALUES ('${roomId}', '${userB_id}', 'Unauthorized leak');
    `);
  } catch (err) {
    postWithoutMembershipBlocked = true;
  }
  assert(postWithoutMembershipBlocked, 'Test 5: Posting without room membership strictly blocked (BOTH authorship AND membership required)');

  // --- TEST 6: User B tries to post to private room impersonating User A (author_id = User A) ---
  let postImpersonationBlocked = false;
  try {
    await asUser(userB_id, userB_wallet);
    await db.exec(`
      INSERT INTO public.room_posts (room_id, author_id, content)
      VALUES ('${roomId}', '${userA_id}', 'Spoofed post as User A');
    `);
  } catch (err) {
    postImpersonationBlocked = true;
  }
  assert(postImpersonationBlocked, 'Test 6: Post authorship impersonation strictly blocked by RLS');

  // --- TEST 7: User B tries to insert forged verified trade record ---
  let tradeDirectInsertBlocked = false;
  try {
    await asUser(userB_id, userB_wallet);
    await db.exec(`
      INSERT INTO public.verified_trade_records (
        room_id, submitted_by, signature, slot, dex_name,
        input_mint, input_symbol, input_amount,
        output_mint, output_symbol, output_amount,
        signer_wallet, is_owner_verified
      ) VALUES (
        '${roomId}', '${userB_id}', 'fakeSig111111111111111111111111111111111111111111111111111111111111111111111111111111111111',
        123456, 'FakeDEX',
        'So11111111111111111111111111111111111111112', 'SOL', 10.0,
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'USDC', 2000.0,
        '${userB_wallet}', true
      );
    `);
  } catch (err) {
    tradeDirectInsertBlocked = true;
  }
  assert(tradeDirectInsertBlocked, 'Test 7: Direct client insert into verified_trade_records strictly forbidden');

  // --- TEST 8: Calling get_or_create_user_profile as unprivileged role ---
  let profileFunctionBlocked = false;
  try {
    await asUser(userB_id, userB_wallet);
    await db.query(`SELECT public.get_or_create_user_profile('${userA_wallet}')`);
  } catch (err) {
    profileFunctionBlocked = true;
  }
  assert(profileFunctionBlocked, 'Test 8: get_or_create_user_profile execution revoked from non-service role');

  // --- TEST 9: Atomic invite join by procedure (service_role or valid invite) ---
  await asServiceRole();
  await db.query(`
    SELECT public.join_room_by_invite(
      '${roomId}'::UUID,
      'INVITE-A-123'::VARCHAR,
      '${userB_id}'::UUID
    );
  `);

  // Verify User B is now a member with 'member' role
  const memberCheck = await db.query(`
    SELECT role FROM public.room_members WHERE room_id = '${roomId}' AND user_id = '${userB_id}'
  `);
  assert(memberCheck.rows.length === 1 && memberCheck.rows[0].role === 'member', 'Test 9: Atomic invite join sets role to member');

  // --- TEST 10: Now verified member User B can view room and post ---
  await asUser(userB_id, userB_wallet);
  const userBView = await db.query(`SELECT * FROM public.trading_rooms WHERE id = '${roomId}'`);
  assert(userBView.rows.length === 1, 'Test 10: User B as verified member can now view private room');

  await db.exec(`
    INSERT INTO public.room_posts (room_id, author_id, content)
    VALUES ('${roomId}', '${userB_id}', 'Hello Alpha room from User B!');
  `);
  const postCheck = await db.query(`SELECT * FROM public.room_posts WHERE room_id = '${roomId}'`);
  assert(postCheck.rows.length === 1, 'Test 11: User B as verified member can create post with verified authorship');

  // --- TEST 12: Server-side verified trade creation and member viewing ---
  await asServiceRole();
  const valid88Sig = '5j7sN2rF11111111111111111111111111111111111111111111111111111111111111111111111111111111';
  await db.exec(`
    INSERT INTO public.verified_trade_records (
      room_id, submitted_by, signature, slot, dex_name,
      input_mint, input_symbol, input_amount,
      output_mint, output_symbol, output_amount,
      signer_wallet, is_owner_verified
    ) VALUES (
      '${roomId}', '${userB_id}', '${valid88Sig}',
      999999, 'Jupiter v6',
      'So11111111111111111111111111111111111111112', 'SOL', 5.0,
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'USDC', 1150.0,
      '${userB_wallet}', true
    );
  `);

  // Member User A views the trade
  await asUser(userA_id, userA_wallet);
  const tradeA = await db.query(`SELECT * FROM public.verified_trade_records WHERE room_id = '${roomId}'`);
  assert(tradeA.rows.length === 1, 'Test 12: Room member User A can view server-verified trade');

  // Non-member User C views the trade -> must be 0
  await asUser(userC_id, userC_wallet);
  const tradeC = await db.query(`SELECT * FROM public.verified_trade_records WHERE room_id = '${roomId}'`);
  assert(tradeC.rows.length === 0, 'Test 13: Non-member User C cannot view private room verified trade');

  // --- TEST 14: User B tries to insert room with created_by = User A ---
  let spoofedRoomCreateBlocked = false;
  try {
    await asUser(userB_id, userB_wallet);
    await db.exec(`
      INSERT INTO public.trading_rooms (name, slug, is_private, invite_code, created_by)
      VALUES ('Spoofed Room', 'spoofed-room', false, 'SPOOF-123', '${userA_id}');
    `);
  } catch (err) {
    spoofedRoomCreateBlocked = true;
  }
  assert(spoofedRoomCreateBlocked, 'Test 14: Impersonating created_by on room creation blocked by RLS');

  // --- TEST 15: Cross-user tracked wallet isolation ---
  await asUser(userA_id, userA_wallet);
  await db.exec(`
    INSERT INTO public.tracked_wallets (user_id, address, label)
    VALUES ('${userA_id}', 'Whale11111111111111111111111111111111111111', 'User A Whale');
  `);

  await asUser(userB_id, userB_wallet);
  const userBTracked = await db.query(`SELECT * FROM public.tracked_wallets WHERE user_id = '${userA_id}'`);
  assert(userBTracked.rows.length === 0, 'Test 15: User B cannot view User A tracked wallets (isolated)');

  let userBInsertATrackedBlocked = false;
  try {
    await db.exec(`
      INSERT INTO public.tracked_wallets (user_id, address, label)
      VALUES ('${userA_id}', 'Whale22222222222222222222222222222222222222', 'Injected');
    `);
  } catch (err) {
    userBInsertATrackedBlocked = true;
  }
  assert(userBInsertATrackedBlocked, 'Test 16: User B cannot insert into User A tracked wallets');

  // --- TEST 17: Cross-user alert rules and history isolation ---
  await asUser(userA_id, userA_wallet);
  await db.exec(`
    INSERT INTO public.alert_rules (user_id, name, rule_type, target_address)
    VALUES ('${userA_id}', 'A Alert', 'wallet_swap', '${userA_wallet}');
  `);

  await asUser(userB_id, userB_wallet);
  const userBAlerts = await db.query(`SELECT * FROM public.alert_rules WHERE user_id = '${userA_id}'`);
  assert(userBAlerts.rows.length === 0, 'Test 17: User B cannot view User A alert rules');

  // --- TEST 18: Cross-user user_settings isolation ---
  await asUser(userA_id, userA_wallet);
  await db.exec(`
    INSERT INTO public.user_settings (user_id, rpc_url)
    VALUES ('${userA_id}', 'https://custom-rpc.solana.com');
  `);

  await asUser(userB_id, userB_wallet);
  const userBSettings = await db.query(`SELECT * FROM public.user_settings WHERE user_id = '${userA_id}'`);
  assert(userBSettings.rows.length === 0, 'Test 18: User B cannot read User A settings');

  console.log(`\n================================================================`);
  console.log(`DATABASE SECURITY TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
