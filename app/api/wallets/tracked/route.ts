import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth/siws';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { isValidSolanaAddress } from '@/lib/utils';
import type { TrackedWallet } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('tradesync_session')?.value;
    const session = sessionCookie ? verifySessionToken(sessionCookie) : null;

    if (!session || !session.walletAddress) {
      return NextResponse.json({ wallets: [] });
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ wallets: [] });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('wallet_address', session.walletAddress)
      .single();

    if (!profile) {
      return NextResponse.json({ wallets: [] });
    }

    const { data: dbWallets, error } = await supabase
      .from('tracked_wallets')
      .select('*')
      .eq('user_id', profile.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const wallets: TrackedWallet[] = (dbWallets || []).map((w) => ({
      id: w.id,
      address: w.address,
      label: w.label,
      category: w.category as TrackedWallet['category'],
      notes: w.notes || '',
      addedAt: new Date(w.created_at).getTime(),
      isOwnerVerified: w.is_owner_verified,
      colorTag: w.color_tag || '#7D8A89',
    }));

    return NextResponse.json({ wallets });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tracked wallets' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('tradesync_session')?.value;
    const session = sessionCookie ? verifySessionToken(sessionCookie) : null;

    if (!session || !session.walletAddress) {
      return NextResponse.json(
        { error: 'Cryptographic wallet authentication required' },
        { status: 401 }
      );
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase is not configured on this server' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { address, label, category = 'Other', notes = '' } = body;

    if (!address || !isValidSolanaAddress(address.trim())) {
      return NextResponse.json({ error: 'Valid Solana address required' }, { status: 400 });
    }

    const trimmedAddress = address.trim();

    // 1. Resolve user profile
    let { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('wallet_address', session.walletAddress)
      .single();

    if (!profile) {
      const { data: newProfile } = await supabase
        .from('user_profiles')
        .insert({
          wallet_address: session.walletAddress,
          display_name: `${session.walletAddress.slice(0, 4)}...${session.walletAddress.slice(-4)}`,
        })
        .select('id')
        .single();
      profile = newProfile;
    }

    if (!profile) throw new Error('User profile resolution failed');

    const isConnectedUser = session.walletAddress === trimmedAddress;

    const { data: newWallet, error: insertErr } = await supabase
      .from('tracked_wallets')
      .insert({
        user_id: profile.id,
        address: trimmedAddress,
        label: label?.trim() || `${trimmedAddress.slice(0, 4)}...${trimmedAddress.slice(-4)}`,
        category,
        notes: notes.trim(),
        color_tag: isConnectedUser ? '#387B60' : '#7D8A89',
        is_owner_verified: isConnectedUser,
        is_active: true,
      })
      .select('*')
      .single();

    if (insertErr || !newWallet) throw insertErr || new Error('Failed to insert tracked wallet');

    const wallet: TrackedWallet = {
      id: newWallet.id,
      address: newWallet.address,
      label: newWallet.label,
      category: newWallet.category as TrackedWallet['category'],
      notes: newWallet.notes || '',
      addedAt: new Date(newWallet.created_at).getTime(),
      isOwnerVerified: newWallet.is_owner_verified,
      colorTag: newWallet.color_tag,
    };

    return NextResponse.json({ success: true, wallet });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add tracked wallet' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('tradesync_session')?.value;
    const session = sessionCookie ? verifySessionToken(sessionCookie) : null;

    if (!session || !session.walletAddress) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) return NextResponse.json({ success: true });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Wallet ID required' }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('wallet_address', session.walletAddress)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 403 });
    }

    await supabase
      .from('tracked_wallets')
      .delete()
      .eq('id', id)
      .eq('user_id', profile.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete tracked wallet' },
      { status: 500 }
    );
  }
}
