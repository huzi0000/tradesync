import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_ADMIN_KEY;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

export function isSupabaseServerConfigured(): boolean {
  return Boolean(
    supabaseUrl &&
    supabaseUrl.startsWith('https://') &&
    (supabaseServiceRoleKey || supabaseAnonKey)
  );
}

export function getSupabaseServerClient(): SupabaseClient | null {
  if (!isSupabaseServerConfigured() || !supabaseUrl) {
    return null;
  }

  const key = supabaseServiceRoleKey || supabaseAnonKey;
  if (!key) return null;

  if (!supabaseServiceRoleKey && process.env.NODE_ENV !== 'production') {
    console.warn(
      '[TradeSync Supabase] Notice: Server client initialized with anon key. Service role operations may be blocked by RLS if SUPABASE_SERVICE_ROLE_KEY is not configured.'
    );
  }

  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
