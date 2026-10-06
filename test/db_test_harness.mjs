import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';

async function runDatabaseSecurityTests() {
  console.log('============================================================');
  console.log('   TRADESYNC POSTGRESQL ISOLATED DATABASE SECURITY HARNESS  ');
  console.log('============================================================\n');

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

  // 1. Setup Supabase mock auth environment in isolated PostgreSQL
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    
    -- Mock auth.uid(), auth.jwt(), auth.role()
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
    $$;

    CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$
      SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'anon');
    $$;

    CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$
      SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::JSONB, '{}'::JSONB);
    $$;

    -- Roles
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
  `);

  console.log('[INFO] Mock Supabase auth schema and roles created.');

  // Helper to switch caller context
  async function asUser(userId, walletAddress, role = 'authenticated') {
    const claims = JSON.stringify({
      sub: userId || '',
      role: role,
      wallet_address: walletAddress || '',
      app_metadata: { wallet_address: walletAddress || '' },
    });
    await db.exec(`
      SET request.jwt.claim.sub = '${userId || ''}';
      SET request.jwt.claim.role = '${role}';
      SET request.jwt.claim.wallet_address = '${walletAddress || ''}';
      SET request.jwt.claims = '${claims}';
      SET ROLE ${role};
    `);
  }

  async function asSuperuser() {
    await db.exec(`
      RESET request.jwt.claim.sub;
      RESET request.jwt.claim.role;
      RESET request.jwt.claim.wallet_address;
      RESET request.jwt.claims;
      RESET ROLE;
    `);
  }

  return { db, assert, asUser, asSuperuser, getStats: () => ({ passed, failed }) };
}

export { runDatabaseSecurityTests };
