-- ============================================================================
-- TRADESYNC DATABASE SCHEMA — PHASE 2
-- Collaborative Solana Trading Intelligence Workspace
-- PostgreSQL / Supabase Compatible Migration
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. USER PROFILES & WALLET IDENTITIES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(44) NOT NULL UNIQUE,
    display_name VARCHAR(64),
    bio TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_wallet ON public.user_profiles (wallet_address);

CREATE TABLE IF NOT EXISTS public.wallet_identities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.trading_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_room_member UNIQUE (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_members_room ON public.room_members (room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON public.room_members (user_id);

CREATE TABLE IF NOT EXISTS public.room_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- 5. VERIFIED TRADE RECORDS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verified_trade_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES public.trading_rooms(id) ON DELETE SET NULL,
    submitted_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    signature VARCHAR(88) NOT NULL,
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.trading_rooms(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL DEFAULT 'Primary Watchlist',
    description TEXT,
    created_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_room_shared_watchlist UNIQUE (room_id, name)
);

CREATE TABLE IF NOT EXISTS public.watchlist_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- 9. ROW-LEVEL SECURITY (RLS) POLICIES
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

-- Profiles: Public read, owner update
CREATE POLICY "Public profiles are viewable by everyone" 
    ON public.user_profiles FOR SELECT USING (true);

-- Tracked Wallets: Only owner can view and mutate
CREATE POLICY "Users can manage their own tracked wallets" 
    ON public.tracked_wallets FOR ALL 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

-- Trading Rooms: Public rooms or member-only private rooms
CREATE POLICY "Rooms viewable by members or public" 
    ON public.trading_rooms FOR SELECT 
    USING (
        NOT is_private OR 
        EXISTS (
            SELECT 1 FROM public.room_members 
            WHERE room_id = public.trading_rooms.id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Room admins can update rooms" 
    ON public.trading_rooms FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.room_members 
            WHERE room_id = public.trading_rooms.id AND user_id = auth.uid() AND role = 'admin'
        )
    );

-- Room Members: Viewable by co-members
CREATE POLICY "Room members viewable by fellow members" 
    ON public.room_members FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.room_members rm 
            WHERE rm.room_id = public.room_members.room_id AND rm.user_id = auth.uid()
        )
    );

-- Room Posts: Read/write restricted to active members
CREATE POLICY "Room posts viewable by room members" 
    ON public.room_posts FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.room_members 
            WHERE room_id = public.room_posts.room_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Room members can create posts" 
    ON public.room_posts FOR INSERT 
    WITH CHECK (
        auth.uid() = author_id AND
        EXISTS (
            SELECT 1 FROM public.room_members 
            WHERE room_id = public.room_posts.room_id AND user_id = auth.uid()
        )
    );

-- Alerts: User isolation
CREATE POLICY "Users manage own alert rules" 
    ON public.alert_rules FOR ALL 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own alert history" 
    ON public.alert_history FOR ALL 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);
