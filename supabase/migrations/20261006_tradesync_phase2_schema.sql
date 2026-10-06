-- ============================================================================
-- TRADESYNC DATABASE SCHEMA — CRYPTOGRAPHICALLY HARDENED PRODUCTION RELEASE
-- Collaborative Solana Trading Intelligence Workspace
-- PostgreSQL / Supabase Migration
-- ============================================================================

-- Ensure pgcrypto extension if available (PostgreSQL 13+ includes gen_random_uuid natively)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 1. USER PROFILES & WALLET IDENTITIES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(44) NOT NULL UNIQUE,
    display_name VARCHAR(64),
    bio TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_wallet ON public.user_profiles (wallet_address);

CREATE TABLE IF NOT EXISTS public.wallet_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    wallet_address VARCHAR(44) NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ownership_proof TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_wallet_identity UNIQUE (user_id, wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_wallet_identities_address ON public.wallet_identities (wallet_address);

-- ----------------------------------------------------------------------------
-- 2. MULTI-WALLET INTELLIGENCE (TRACKED WALLETS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracked_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    address VARCHAR(44) NOT NULL,
    label VARCHAR(64) NOT NULL,
    category VARCHAR(32) DEFAULT 'Other',
    notes TEXT,
    color_tag VARCHAR(16) DEFAULT '#7D8A89',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_owner_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_tracked_wallet UNIQUE (user_id, address)
);

CREATE INDEX IF NOT EXISTS idx_tracked_wallets_user ON public.tracked_wallets (user_id);
CREATE INDEX IF NOT EXISTS idx_tracked_wallets_address ON public.tracked_wallets (address);

-- ----------------------------------------------------------------------------
-- 3. ALPHA ROOMS (MULTIPLAYER COLLABORATION)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trading_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    is_private BOOLEAN NOT NULL DEFAULT TRUE,
    invite_code VARCHAR(32) NOT NULL UNIQUE,
    created_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
    max_members INT NOT NULL DEFAULT 50,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trading_rooms_invite ON public.trading_rooms (invite_code);
CREATE INDEX IF NOT EXISTS idx_trading_rooms_creator ON public.trading_rooms (created_by);

CREATE TABLE IF NOT EXISTS public.room_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.trading_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_room_member UNIQUE (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_members_room ON public.room_members (room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON public.room_members (user_id);

CREATE TABLE IF NOT EXISTS public.room_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.trading_rooms(id) ON DELETE CASCADE,
    invite_code VARCHAR(32) NOT NULL UNIQUE,
    created_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    max_uses INT NOT NULL DEFAULT 100,
    used_count INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_invitations_code ON public.room_invitations (invite_code);

-- ----------------------------------------------------------------------------
-- 4. ROOM POSTS & TRADE FEEDS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.room_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.trading_rooms(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    post_type VARCHAR(16) NOT NULL DEFAULT 'note' CHECK (post_type IN ('note', 'trade', 'research', 'alert')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_posts_room_created ON public.room_posts (room_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. VERIFIED TRADE RECORDS (IMMUTABLE ON-CHAIN PROOFS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verified_trade_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.trading_rooms(id) ON DELETE SET NULL,
    submitted_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    signature VARCHAR(96) NOT NULL,
    slot BIGINT NOT NULL,
    block_time TIMESTAMPTZ,
    dex_name VARCHAR(64) NOT NULL,
    input_mint VARCHAR(44) NOT NULL,
    input_symbol VARCHAR(32) NOT NULL,
    input_amount NUMERIC(28, 9) NOT NULL,
    output_mint VARCHAR(44) NOT NULL,
    output_symbol VARCHAR(32) NOT NULL,
    output_amount NUMERIC(28, 9) NOT NULL,
    signer_wallet VARCHAR(44) NOT NULL,
    is_owner_verified BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_verified_trade_room_signature UNIQUE (room_id, signature)
);

CREATE INDEX IF NOT EXISTS idx_verified_trades_sig ON public.verified_trade_records (signature);
CREATE INDEX IF NOT EXISTS idx_verified_trades_room ON public.verified_trade_records (room_id);
CREATE INDEX IF NOT EXISTS idx_verified_trades_signer ON public.verified_trade_records (signer_wallet);

-- ----------------------------------------------------------------------------
-- 6. SHARED & PERSONAL WATCHLISTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shared_watchlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.trading_rooms(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL DEFAULT 'Primary Watchlist',
    description TEXT,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_room_shared_watchlist UNIQUE (room_id, name)
);

CREATE TABLE IF NOT EXISTS public.watchlist_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    watchlist_id UUID NOT NULL REFERENCES public.shared_watchlists(id) ON DELETE CASCADE,
    mint VARCHAR(44) NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    name VARCHAR(64) NOT NULL,
    notes TEXT,
    added_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    target_price NUMERIC(20, 8),
    alert_threshold NUMERIC(20, 8),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_watchlist_token UNIQUE (watchlist_id, mint)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_tokens_mint ON public.watchlist_tokens (mint);

-- ----------------------------------------------------------------------------
-- 7. ON-CHAIN ALERT ENGINE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(32) NOT NULL CHECK (rule_type IN ('wallet_swap', 'token_movement', 'price_threshold', 'concentration_risk')),
    target_address VARCHAR(44) NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}'::JSONB,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_triggered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_user ON public.alert_rules (user_id);

CREATE TABLE IF NOT EXISTS public.alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES public.alert_rules(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(16) NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::JSONB,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_history_user_read ON public.alert_history (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_alert_history_triggered ON public.alert_history (triggered_at DESC);

-- ----------------------------------------------------------------------------
-- 8. USER SETTINGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    rpc_url TEXT NOT NULL DEFAULT '/api/rpc',
    theme VARCHAR(16) NOT NULL DEFAULT 'system',
    auto_refresh BOOLEAN NOT NULL DEFAULT TRUE,
    refresh_interval INT NOT NULL DEFAULT 30,
    display_currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 9. SECURITY DEFINER HELPER FUNCTIONS (HARDENED SEARCH PATH & LEAST PRIVILEGE)
-- ----------------------------------------------------------------------------

-- 9.1 Resolves current authenticated user UUID from auth.uid() or verified JWT wallet claims
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.user_profiles
  WHERE (auth.uid() IS NOT NULL AND id = auth.uid())
     OR (NULLIF(auth.jwt() ->> 'wallet_address', '') IS NOT NULL AND wallet_address = (auth.jwt() ->> 'wallet_address'))
     OR (NULLIF(auth.jwt() -> 'app_metadata' ->> 'wallet_address', '') IS NOT NULL AND wallet_address = (auth.jwt() -> 'app_metadata' ->> 'wallet_address'))
     OR (NULLIF(auth.jwt() -> 'user_metadata' ->> 'wallet_address', '') IS NOT NULL AND wallet_address = (auth.jwt() -> 'user_metadata' ->> 'wallet_address'))
  LIMIT 1;
$$;

-- 9.2 Check room membership non-recursively (eliminates 42P17 recursion)
CREATE OR REPLACE FUNCTION public.check_is_room_member(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL OR p_room_id IS NULL THEN FALSE
    ELSE EXISTS (
      SELECT 1 FROM public.room_members
      WHERE room_id = p_room_id AND user_id = p_user_id
    )
  END;
$$;

-- 9.3 Check room admin status non-recursively
CREATE OR REPLACE FUNCTION public.check_is_room_admin(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL OR p_room_id IS NULL THEN FALSE
    ELSE EXISTS (
      SELECT 1 FROM public.room_members
      WHERE room_id = p_room_id AND user_id = p_user_id AND role = 'admin'
    )
  END;
$$;

-- 9.4 Profile creation / resolution: RESTRICTED TO SERVICE_ROLE & MATCHING WALLET
CREATE OR REPLACE FUNCTION public.get_or_create_user_profile(p_wallet_address VARCHAR(44))
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_caller_role TEXT;
  v_jwt_wallet TEXT;
BEGIN
  -- Validate format of Solana address
  IF p_wallet_address IS NULL OR LENGTH(p_wallet_address) < 32 OR LENGTH(p_wallet_address) > 44 THEN
    RAISE EXCEPTION 'Invalid Solana wallet address format.';
  END IF;

  v_caller_role := COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), auth.role());
  v_jwt_wallet := COALESCE(
    NULLIF(auth.jwt() ->> 'wallet_address', ''),
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'wallet_address', ''),
    NULLIF(current_setting('request.jwt.claim.wallet_address', true), '')
  );

  -- Impersonation check: Non-service callers cannot resolve arbitrary wallets
  IF v_caller_role IS NOT NULL AND v_caller_role NOT IN ('service_role', 'supabase_admin') THEN
    IF v_jwt_wallet IS NULL OR v_jwt_wallet != p_wallet_address THEN
      RAISE EXCEPTION 'Unauthorized: cannot access or create profile for another wallet.';
    END IF;
  END IF;

  SELECT id INTO v_user_id FROM public.user_profiles WHERE wallet_address = p_wallet_address;
  IF v_user_id IS NULL THEN
    INSERT INTO public.user_profiles (wallet_address, display_name)
    VALUES (
      p_wallet_address,
      SUBSTRING(p_wallet_address FROM 1 FOR 4) || '...' || SUBSTRING(p_wallet_address FROM LENGTH(p_wallet_address) - 3 FOR 4)
    )
    RETURNING id INTO v_user_id;
  END IF;

  RETURN v_user_id;
END;
$$;

-- Revoke public execution to prevent profile enumeration/forgery
REVOKE ALL ON FUNCTION public.get_or_create_user_profile(VARCHAR) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_or_create_user_profile(VARCHAR) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_user_profile(VARCHAR) TO service_role;

-- 9.5 Atomic Server/Function Invitation Join Procedure
CREATE OR REPLACE FUNCTION public.join_room_by_invite(
  p_room_id UUID,
  p_invite_code VARCHAR(32),
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_room RECORD;
  v_current_count INT;
BEGIN
  IF p_user_id IS NULL OR p_room_id IS NULL OR p_invite_code IS NULL THEN
    RAISE EXCEPTION 'Invalid parameters for joining room.';
  END IF;

  -- Verify room exists
  SELECT * INTO v_room FROM public.trading_rooms WHERE id = p_room_id;
  IF v_room IS NULL THEN
    RAISE EXCEPTION 'Room not found.';
  END IF;

  -- If room is private, validate invite code
  IF v_room.is_private THEN
    -- Check room invitation record or default room invite code
    SELECT * INTO v_invitation
    FROM public.room_invitations
    WHERE room_id = p_room_id
      AND invite_code = p_invite_code
      AND (expires_at IS NULL OR expires_at > NOW())
      AND used_count < max_uses;

    IF v_invitation IS NULL AND v_room.invite_code != p_invite_code THEN
      RAISE EXCEPTION 'Invalid or expired invitation code.';
    END IF;
  END IF;

  -- Check capacity
  SELECT COUNT(*) INTO v_current_count FROM public.room_members WHERE room_id = p_room_id;
  IF v_current_count >= v_room.max_members THEN
    RAISE EXCEPTION 'Room has reached maximum member capacity.';
  END IF;

  -- Insert member as 'member' (never admin)
  INSERT INTO public.room_members (room_id, user_id, role)
  VALUES (p_room_id, p_user_id, 'member')
  ON CONFLICT (room_id, user_id) DO NOTHING;

  -- Increment invitation usage if applicable
  IF v_invitation IS NOT NULL THEN
    UPDATE public.room_invitations
    SET used_count = used_count + 1
    WHERE id = v_invitation.id;
  END IF;

  RETURN TRUE;
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. DATABASE INTEGRITY TRIGGERS (DEFENSE IN DEPTH)
-- ----------------------------------------------------------------------------

-- 10.1 Enforce room member integrity & prevent privilege escalation
CREATE OR REPLACE FUNCTION public.trg_enforce_room_member_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prevent privilege escalation: role='admin' can ONLY be assigned if the user is the room creator
  IF NEW.role = 'admin' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.trading_rooms
      WHERE id = NEW.room_id AND created_by = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Privilege escalation rejected: only the room creator can be an admin.';
    END IF;
  END IF;

  -- Enforce member limit
  IF (SELECT COUNT(*) FROM public.room_members WHERE room_id = NEW.room_id) >= 
     (SELECT max_members FROM public.trading_rooms WHERE id = NEW.room_id) THEN
    RAISE EXCEPTION 'Room has reached maximum member capacity.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_room_members_integrity ON public.room_members;
CREATE TRIGGER trg_room_members_integrity
BEFORE INSERT ON public.room_members
FOR EACH ROW
EXECUTE FUNCTION public.trg_enforce_room_member_integrity();

-- 10.2 Enforce verified trade record integrity
CREATE OR REPLACE FUNCTION public.trg_validate_verified_trade_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.room_id IS NOT NULL THEN
    IF NOT public.check_is_room_member(NEW.room_id, NEW.submitted_by) THEN
      RAISE EXCEPTION 'Unauthorized: Submitter must be an active member of the room.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_verified_trade_record ON public.verified_trade_records;
CREATE TRIGGER trg_validate_verified_trade_record
BEFORE INSERT ON public.verified_trade_records
FOR EACH ROW
EXECUTE FUNCTION public.trg_validate_verified_trade_record();

-- ----------------------------------------------------------------------------
-- 11. ROW-LEVEL SECURITY (RLS) POLICIES — COMPREHENSIVE HARDENING
-- ----------------------------------------------------------------------------

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracked_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verified_trade_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- 11.1 User Profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.user_profiles;
CREATE POLICY "Profiles are viewable by everyone"
    ON public.user_profiles FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can create or update their own profile" ON public.user_profiles;
CREATE POLICY "Users can create their own profile"
    ON public.user_profiles FOR INSERT
    WITH CHECK (
        id = public.get_current_user_id()
        OR (auth.role() = 'authenticated' AND wallet_address = (auth.jwt() ->> 'wallet_address'))
    );

CREATE POLICY "Users can update their own profile"
    ON public.user_profiles FOR UPDATE
    USING (id = public.get_current_user_id())
    WITH CHECK (id = public.get_current_user_id());

-- 11.2 Wallet Identities
DROP POLICY IF EXISTS "Users view own wallet identities" ON public.wallet_identities;
CREATE POLICY "Users view own wallet identities"
    ON public.wallet_identities FOR SELECT
    USING (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "Users manage own wallet identities" ON public.wallet_identities;
CREATE POLICY "Users manage own wallet identities"
    ON public.wallet_identities FOR ALL
    USING (user_id = public.get_current_user_id())
    WITH CHECK (user_id = public.get_current_user_id());

-- 11.3 Tracked Wallets
DROP POLICY IF EXISTS "Users manage their own tracked wallets" ON public.tracked_wallets;
CREATE POLICY "Users manage their own tracked wallets"
    ON public.tracked_wallets FOR ALL
    USING (user_id = public.get_current_user_id())
    WITH CHECK (user_id = public.get_current_user_id());

-- 11.4 Trading Rooms
DROP POLICY IF EXISTS "Rooms viewable by members or public" ON public.trading_rooms;
CREATE POLICY "Rooms viewable by members or public"
    ON public.trading_rooms FOR SELECT
    USING (
        NOT is_private
        OR public.check_is_room_member(id, public.get_current_user_id())
        OR created_by = public.get_current_user_id()
    );

DROP POLICY IF EXISTS "Authenticated users can create rooms" ON public.trading_rooms;
CREATE POLICY "Authenticated users can create rooms"
    ON public.trading_rooms FOR INSERT
    WITH CHECK (
        created_by = public.get_current_user_id()
    );

DROP POLICY IF EXISTS "Room admins can update rooms" ON public.trading_rooms;
CREATE POLICY "Room admins can update rooms"
    ON public.trading_rooms FOR UPDATE
    USING (
        public.check_is_room_admin(id, public.get_current_user_id())
        OR created_by = public.get_current_user_id()
    );

DROP POLICY IF EXISTS "Room admins can delete rooms" ON public.trading_rooms;
CREATE POLICY "Room admins can delete rooms"
    ON public.trading_rooms FOR DELETE
    USING (
        public.check_is_room_admin(id, public.get_current_user_id())
        OR created_by = public.get_current_user_id()
    );

-- 11.5 Room Members (Zero Unauthorized Joins, Zero Self-Admin Escalation)
DROP POLICY IF EXISTS "Room members viewable by members or public room" ON public.room_members;
CREATE POLICY "Room members viewable by members or public room"
    ON public.room_members FOR SELECT
    USING (
        user_id = public.get_current_user_id()
        OR public.check_is_room_member(room_id, public.get_current_user_id())
        OR EXISTS (SELECT 1 FROM public.trading_rooms WHERE id = room_id AND NOT is_private)
    );

DROP POLICY IF EXISTS "Members can join public rooms only" ON public.room_members;
CREATE POLICY "Users can insert room membership"
    ON public.room_members FOR INSERT
    WITH CHECK (
        -- 1. Must be inserting for oneself
        user_id = public.get_current_user_id()
        AND (
            -- Case 1: Room creator can add themselves to their own room (as admin or member)
            EXISTS (
                SELECT 1 FROM public.trading_rooms
                WHERE id = room_id AND created_by = public.get_current_user_id()
            )
            -- Case 2: Regular user joining a public room (strictly as 'member')
            OR (
                role = 'member'
                AND EXISTS (
                    SELECT 1 FROM public.trading_rooms
                    WHERE id = room_id AND NOT is_private
                )
            )
        )
    );

DROP POLICY IF EXISTS "Users can leave rooms or admins can remove members" ON public.room_members;
CREATE POLICY "Users can leave rooms or admins can remove members"
    ON public.room_members FOR DELETE
    USING (
        user_id = public.get_current_user_id()
        OR public.check_is_room_admin(room_id, public.get_current_user_id())
    );

-- 11.6 Room Invitations
DROP POLICY IF EXISTS "Invitations viewable by room members" ON public.room_invitations;
CREATE POLICY "Invitations viewable by room members"
    ON public.room_invitations FOR SELECT
    USING (
        public.check_is_room_member(room_id, public.get_current_user_id())
    );

DROP POLICY IF EXISTS "Room admins can create invitations" ON public.room_invitations;
CREATE POLICY "Room admins can create invitations"
    ON public.room_invitations FOR INSERT
    WITH CHECK (
        public.check_is_room_admin(room_id, public.get_current_user_id())
        AND created_by = public.get_current_user_id()
    );

-- 11.7 Room Posts (Requires BOTH Verified Authorship AND Active Room Membership)
DROP POLICY IF EXISTS "Room posts viewable by members or public" ON public.room_posts;
CREATE POLICY "Room posts viewable by members or public"
    ON public.room_posts FOR SELECT
    USING (
        public.check_is_room_member(room_id, public.get_current_user_id())
        OR EXISTS (SELECT 1 FROM public.trading_rooms WHERE id = room_id AND NOT is_private)
    );

DROP POLICY IF EXISTS "Room members can create posts" ON public.room_posts;
CREATE POLICY "Verified room members can create posts"
    ON public.room_posts FOR INSERT
    WITH CHECK (
        -- Strict requirement 1: Caller must be the author
        author_id = public.get_current_user_id()
        -- Strict requirement 2: Caller must be an active member of this specific room
        AND public.check_is_room_member(room_id, public.get_current_user_id())
    );

DROP POLICY IF EXISTS "Post authors can delete their posts" ON public.room_posts;
CREATE POLICY "Post authors or room admins can delete posts"
    ON public.room_posts FOR DELETE
    USING (
        author_id = public.get_current_user_id()
        OR public.check_is_room_admin(room_id, public.get_current_user_id())
    );

-- 11.8 Verified Trade Records (FORBIDS CLIENT INSERT; SERVICE_ROLE ONLY)
DROP POLICY IF EXISTS "Verified trades viewable by room members or public" ON public.verified_trade_records;
CREATE POLICY "Verified trades viewable by room members or public"
    ON public.verified_trade_records FOR SELECT
    USING (
        room_id IS NULL
        OR public.check_is_room_member(room_id, public.get_current_user_id())
        OR EXISTS (SELECT 1 FROM public.trading_rooms WHERE id = room_id AND NOT is_private)
    );

-- Direct client INSERT is completely forbidden to prevent trade forgery
DROP POLICY IF EXISTS "Members can submit verified trades" ON public.verified_trade_records;
CREATE POLICY "Direct client insert forbidden on verified trades"
    ON public.verified_trade_records FOR INSERT
    WITH CHECK (false);

CREATE POLICY "Direct client update forbidden on verified trades"
    ON public.verified_trade_records FOR UPDATE
    USING (false);

CREATE POLICY "Direct client delete forbidden on verified trades"
    ON public.verified_trade_records FOR DELETE
    USING (false);

-- 11.9 Shared Watchlists & Tokens
DROP POLICY IF EXISTS "Watchlists viewable by room members" ON public.shared_watchlists;
CREATE POLICY "Watchlists viewable by room members"
    ON public.shared_watchlists FOR SELECT
    USING (
        public.check_is_room_member(room_id, public.get_current_user_id())
        OR EXISTS (SELECT 1 FROM public.trading_rooms WHERE id = room_id AND NOT is_private)
    );

DROP POLICY IF EXISTS "Members can manage shared watchlists" ON public.shared_watchlists;
CREATE POLICY "Members can manage shared watchlists"
    ON public.shared_watchlists FOR ALL
    USING (public.check_is_room_member(room_id, public.get_current_user_id()))
    WITH CHECK (public.check_is_room_member(room_id, public.get_current_user_id()));

DROP POLICY IF EXISTS "Watchlist tokens viewable by room members" ON public.watchlist_tokens;
CREATE POLICY "Watchlist tokens viewable by room members"
    ON public.watchlist_tokens FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.shared_watchlists sw
            WHERE sw.id = watchlist_id AND (
                public.check_is_room_member(sw.room_id, public.get_current_user_id())
                OR EXISTS (SELECT 1 FROM public.trading_rooms tr WHERE tr.id = sw.room_id AND NOT tr.is_private)
            )
        )
    );

DROP POLICY IF EXISTS "Members can manage watchlist tokens" ON public.watchlist_tokens;
CREATE POLICY "Members can manage watchlist tokens"
    ON public.watchlist_tokens FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.shared_watchlists sw
            WHERE sw.id = watchlist_id AND public.check_is_room_member(sw.room_id, public.get_current_user_id())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.shared_watchlists sw
            WHERE sw.id = watchlist_id AND public.check_is_room_member(sw.room_id, public.get_current_user_id())
        )
    );

-- 11.10 Alert Rules & History
DROP POLICY IF EXISTS "Users manage own alert rules" ON public.alert_rules;
CREATE POLICY "Users manage own alert rules"
    ON public.alert_rules FOR ALL
    USING (user_id = public.get_current_user_id())
    WITH CHECK (user_id = public.get_current_user_id());

DROP POLICY IF EXISTS "Users manage own alert history" ON public.alert_history;
CREATE POLICY "Users manage own alert history"
    ON public.alert_history FOR ALL
    USING (user_id = public.get_current_user_id())
    WITH CHECK (user_id = public.get_current_user_id());

-- 11.11 User Settings
DROP POLICY IF EXISTS "Users manage own settings" ON public.user_settings;
CREATE POLICY "Users manage own settings"
    ON public.user_settings FOR ALL
    USING (user_id = public.get_current_user_id())
    WITH CHECK (user_id = public.get_current_user_id());

-- ----------------------------------------------------------------------------
-- 12. SUPABASE REALTIME REPLICATION CONFIGURATION
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.trading_rooms;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.room_posts;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_watchlists;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.watchlist_tokens;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_history;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
