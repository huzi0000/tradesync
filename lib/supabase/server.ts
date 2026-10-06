import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
