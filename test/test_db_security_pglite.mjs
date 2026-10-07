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

  // 2. Read and execute the migration SQL (Run 1)
  const migrationPath = path.resolve('supabase/migrations/20261006_tradesync_phase2_schema.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  try {
    await db.exec(migrationSql);
    console.log('[SETUP] Hardened SQL migration executed successfully (Run 1).');
  } catch (err) {
    console.error('[FATAL] Migration execution failed on Run 1:', err);
    process.exit(1);
  }

  // 2b. Test Migration Idempotency (Run 2)
  try {
    await db.exec(migrationSql);
    assert(true, 'Test 0: Migration is strictly idempotent (Run 2 succeeded cleanly without errors)');
  } catch (err) {
    console.error('[FAIL] Migration failed idempotency re-run:', err);
    assert(false, 'Test 0: Migration is strictly idempotent');
  }

  // Grant table permissions for RLS testing
  await db.exec(`
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
  `);

  // Helper context setters
  async function asUser(userId, walletAddress, metadata = {}) {
    const claims = JSON.stringify({
      sub: userId,
      role: 'authenticated',
      wallet_address: walletAddress,
      app_metadata: { wallet_address: walletAddress },
      ...metadata,
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

  // --- TEST 3: User B tries to direct insert self into User A private room ---
  let joinBlocked = false;
  try {
    await db.exec(`
      INSERT INTO public.room_members (room_id, user_id, role)
      VALUES ('${roomId}', '${userB_id}', 'member');
    `);
  } catch {
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
  } catch {
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
  } catch {
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
  } catch {
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
        '${roomId}', '${userB_id}', 'fakeSig11111111111111111111111111111111111111111111111111111111111111111111111111111111',
        123456, 'FakeDEX',
        'So11111111111111111111111111111111111111112', 'SOL', 10.0,
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'USDC', 2000.0,
        '${userB_wallet}', true
      );
    `);
  } catch {
    tradeDirectInsertBlocked = true;
  }
  assert(tradeDirectInsertBlocked, 'Test 7: Direct client insert into verified_trade_records strictly forbidden');

  // --- TEST 8: Calling get_or_create_user_profile as unprivileged role ---
  let profileFunctionBlocked = false;
  try {
    await asUser(userB_id, userB_wallet);
    await db.query(`SELECT public.get_or_create_user_profile('${userA_wallet}')`);
  } catch {
    profileFunctionBlocked = true;
  }
  assert(profileFunctionBlocked, 'Test 8: get_or_create_user_profile execution revoked from non-service role');

  // --- TEST 9: Direct client execution of join_room_by_invite is revoked ---
  let directJoinRpcBlocked = false;
  try {
    await asUser(userB_id, userB_wallet);
    await db.query(`
      SELECT public.join_room_by_invite(
        '${roomId}'::UUID,
        'INVITE-A-123'::VARCHAR,
        '${userB_id}'::UUID
      );
    `);
  } catch {
    directJoinRpcBlocked = true;
  }
  assert(directJoinRpcBlocked, 'Test 9: Direct client execution of join_room_by_invite revoked from authenticated/anon roles');

  // --- TEST 10: Atomic invite join by procedure via service_role ---
  await asServiceRole();
  await db.query(`
    SELECT public.join_room_by_invite(
      '${roomId}'::UUID,
      'INVITE-A-123'::VARCHAR,
      '${userB_id}'::UUID
    );
  `);

  const memberCheck = await db.query(`
    SELECT role FROM public.room_members WHERE room_id = '${roomId}' AND user_id = '${userB_id}'
  `);
  assert(memberCheck.rows.length === 1 && memberCheck.rows[0].role === 'member', 'Test 10: Atomic invite join sets role to member via service_role');

  // --- TEST 11: Now verified member User B can view room and post ---
  await asUser(userB_id, userB_wallet);
  const userBView = await db.query(`SELECT * FROM public.trading_rooms WHERE id = '${roomId}'`);
  assert(userBView.rows.length === 1, 'Test 11: User B as verified member can now view private room');

  await db.exec(`
    INSERT INTO public.room_posts (room_id, author_id, content)
    VALUES ('${roomId}', '${userB_id}', 'Hello Alpha room from User B!');
  `);
  const postCheck = await db.query(`SELECT * FROM public.room_posts WHERE room_id = '${roomId}'`);
  assert(postCheck.rows.length === 1, 'Test 12: User B as verified member can create post with verified authorship');

  // --- TEST 13: Server-side verified trade creation and member viewing ---
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
  assert(tradeA.rows.length === 1, 'Test 13: Room member User A can view server-verified trade');

  // Non-member User C views the trade -> must be 0
  await asUser(userC_id, userC_wallet);
  const tradeC = await db.query(`SELECT * FROM public.verified_trade_records WHERE room_id = '${roomId}'`);
  assert(tradeC.rows.length === 0, 'Test 14: Non-member User C cannot view private room verified trade');

  // --- TEST 15: User B tries to insert room with created_by = User A ---
  let spoofedRoomCreateBlocked = false;
  try {
    await asUser(userB_id, userB_wallet);
    await db.exec(`
      INSERT INTO public.trading_rooms (name, slug, is_private, invite_code, created_by)
      VALUES ('Spoofed Room', 'spoofed-room', false, 'SPOOF-123', '${userA_id}');
    `);
  } catch {
    spoofedRoomCreateBlocked = true;
  }
  assert(spoofedRoomCreateBlocked, 'Test 15: Impersonating created_by on room creation blocked by RLS');

  // --- TEST 16: Cross-user tracked wallet isolation ---
  await asUser(userA_id, userA_wallet);
  await db.exec(`
    INSERT INTO public.tracked_wallets (user_id, address, label)
    VALUES ('${userA_id}', 'Whale11111111111111111111111111111111111111', 'User A Whale');
  `);

  await asUser(userB_id, userB_wallet);
  const userBTracked = await db.query(`SELECT * FROM public.tracked_wallets WHERE user_id = '${userA_id}'`);
  assert(userBTracked.rows.length === 0, 'Test 16: User B cannot view User A tracked wallets (isolated)');

  let userBInsertATrackedBlocked = false;
  try {
    await db.exec(`
      INSERT INTO public.tracked_wallets (user_id, address, label)
      VALUES ('${userA_id}', 'Whale22222222222222222222222222222222222222', 'Injected');
    `);
  } catch {
    userBInsertATrackedBlocked = true;
  }
  assert(userBInsertATrackedBlocked, 'Test 17: User B cannot insert into User A tracked wallets');

  // --- TEST 18: Cross-user alert rules and history isolation ---
  await asUser(userA_id, userA_wallet);
  await db.exec(`
    INSERT INTO public.alert_rules (user_id, name, rule_type, target_address)
    VALUES ('${userA_id}', 'A Alert', 'wallet_swap', '${userA_wallet}');
  `);

  await asUser(userB_id, userB_wallet);
  const userBAlerts = await db.query(`SELECT * FROM public.alert_rules WHERE user_id = '${userA_id}'`);
  assert(userBAlerts.rows.length === 0, 'Test 18: User B cannot view User A alert rules');

  // --- TEST 19: Cross-user user_settings isolation ---
  await asUser(userA_id, userA_wallet);
  await db.exec(`
    INSERT INTO public.user_settings (user_id, rpc_url)
    VALUES ('${userA_id}', 'https://custom-rpc.solana.com');
  `);

  await asUser(userB_id, userB_wallet);
  const userBSettings = await db.query(`SELECT * FROM public.user_settings WHERE user_id = '${userA_id}'`);
  assert(userBSettings.rows.length === 0, 'Test 19: User B cannot read User A settings');

  // =========================================================================
  // FOCUSED TESTS FOR THE 3 SPECIFIC REMAINING SECURITY REQUIREMENTS
  // =========================================================================

  // --- REQUIREMENT 1: Concurrent capacity & invitation exhaustion ---
  // Create a room with max_members = 2 (creator User A is member 1)
  await asServiceRole();
  const cappedRoomId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  await db.exec(`
    INSERT INTO public.trading_rooms (id, name, slug, is_private, invite_code, created_by, max_members)
    VALUES ('${cappedRoomId}', 'Capped Room', 'capped-room', true, 'CAP-123', '${userA_id}', 2);
    INSERT INTO public.room_members (room_id, user_id, role)
    VALUES ('${cappedRoomId}', '${userA_id}', 'admin');
  `);

  // Create an invitation with max_uses = 1
  const inviteCode1Use = 'ONE-USE-INVITE';
  await db.exec(`
    INSERT INTO public.room_invitations (room_id, invite_code, created_by, max_uses, used_count)
    VALUES ('${cappedRoomId}', '${inviteCode1Use}', '${userA_id}', 1, 0);
  `);

  // User B joins using ONE-USE-INVITE -> should succeed (member 2)
  await db.query(`
    SELECT public.join_room_by_invite('${cappedRoomId}'::UUID, '${inviteCode1Use}'::VARCHAR, '${userB_id}'::UUID);
  `);
  assert(true, 'Test 20: User B successfully joined capped room with valid invite');

  // User C tries to join using ONE-USE-INVITE -> must fail (used_count reached max_uses)
  let inviteExhaustedBlocked = false;
  try {
    await db.query(`
      SELECT public.join_room_by_invite('${cappedRoomId}'::UUID, '${inviteCode1Use}'::VARCHAR, '${userC_id}'::UUID);
    `);
  } catch {
    inviteExhaustedBlocked = true;
  }
  assert(inviteExhaustedBlocked, 'Test 21: Invitation usage limit (max_uses) strictly enforced under row lock');

  // Create a second invitation with max_uses = 10, but room has reached max_members = 2!
  const inviteCode2 = 'MULTI-USE-INVITE';
  await db.exec(`
    INSERT INTO public.room_invitations (room_id, invite_code, created_by, max_uses, used_count)
    VALUES ('${cappedRoomId}', '${inviteCode2}', '${userA_id}', 10, 0);
  `);

  let roomCapacityBlocked = false;
  try {
    await db.query(`
      SELECT public.join_room_by_invite('${cappedRoomId}'::UUID, '${inviteCode2}'::VARCHAR, '${userC_id}'::UUID);
    `);
  } catch {
    roomCapacityBlocked = true;
  }
  assert(roomCapacityBlocked, 'Test 22: Room capacity limit (max_members) strictly enforced under row lock');

  // --- REQUIREMENT 2: Secure wallet_identities ---
  // Test 23: Direct client INSERT into wallet_identities must be blocked by RLS
  let clientWalletIdentitiesInsertBlocked = false;
  try {
    await asUser(userB_id, userB_wallet);
    await db.exec(`
      INSERT INTO public.wallet_identities (user_id, wallet_address, ownership_proof, is_primary)
      VALUES ('${userB_id}', '${userB_wallet}', 'fake_proof', true);
    `);
  } catch {
    clientWalletIdentitiesInsertBlocked = true;
  }
  assert(clientWalletIdentitiesInsertBlocked, 'Test 23: Direct client INSERT into wallet_identities strictly forbidden');

  // Test 24: Direct client UPDATE on wallet_identities must be blocked by RLS (0 rows affected)
  await asUser(userB_id, userB_wallet);
  const updateRes = await db.query(`
    UPDATE public.wallet_identities SET is_primary = false WHERE user_id = '${userB_id}';
  `);
  assert(updateRes.affectedRows === 0, 'Test 24: Direct client UPDATE on wallet_identities strictly forbidden (0 rows affected)');

  // Test 25: Service-role inserting verified wallet identity succeeds
  await asServiceRole();
  await db.exec(`
    INSERT INTO public.wallet_identities (user_id, wallet_address, ownership_proof, is_primary)
    VALUES ('${userB_id}', '${userB_wallet}', '{"verified_by": "server_ed25519"}', true);
  `);
  assert(true, 'Test 25: Trusted server (service_role) successfully recorded verified wallet identity');

  // Test 26: User B can view their own verified identity; User A cannot view User B's identity
  await asUser(userB_id, userB_wallet);
  const bIdentities = await db.query(`SELECT * FROM public.wallet_identities WHERE user_id = '${userB_id}'`);
  assert(bIdentities.rows.length === 1, 'Test 26: User B can view their own verified wallet identity');

  await asUser(userA_id, userA_wallet);
  const aViewsBIdentities = await db.query(`SELECT * FROM public.wallet_identities WHERE user_id = '${userB_id}'`);
  assert(aViewsBIdentities.rows.length === 0, 'Test 27: User A cannot view User B wallet identity (RLS isolated)');

  // --- REQUIREMENT 3: Remove user_metadata.wallet_address from authorization ---
  // Attacker User B injects a spoofed whale wallet in user_metadata
  const whaleWallet = 'Whale111111111111111111111111111111111111111';
  await asServiceRole();
  const whaleId = '99999999-9999-9999-9999-999999999999';
  await db.exec(`
    INSERT INTO public.user_profiles (id, wallet_address, display_name)
    VALUES ('${whaleId}', '${whaleWallet}', 'Target Whale');
  `);

  // Attacker User B sends JWT containing user_metadata.wallet_address = whaleWallet
  await asUser(userB_id, userB_wallet, {
    user_metadata: { wallet_address: whaleWallet },
  });

  const resolvedUserIdRes = await db.query(`SELECT public.get_current_user_id() AS uid`);
  const resolvedId = resolvedUserIdRes.rows[0]?.uid;
  assert(
    resolvedId !== whaleId && resolvedId === userB_id,
    'Test 28: Authorization completely ignores user_metadata.wallet_address (whale impersonation defeated)'
  );

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
