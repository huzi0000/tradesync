import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth/siws';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { AlphaRoom } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('tradesync_session')?.value;
    const session = sessionCookie ? verifySessionToken(sessionCookie) : null;

    if (!session || !session.walletAddress) {
      return NextResponse.json(
        { error: 'Cryptographic wallet authentication required to join room. Please sign in with your Solana wallet.' },
        { status: 401 }
      );
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase database service is not configured on this server' },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawInviteCode = body.inviteCode || body.invite_code || body.code;

    if (!rawInviteCode || typeof rawInviteCode !== 'string' || !rawInviteCode.trim()) {
      return NextResponse.json({ error: 'Valid invite code required' }, { status: 400 });
    }

    const normalizedInviteCode = rawInviteCode.trim().toUpperCase();

    // 1. Find room by invite code (case-insensitive with normalized code)
    const { data: room, error: roomErr } = await supabase
      .from('trading_rooms')
      .select('*')
      .ilike('invite_code', normalizedInviteCode)
      .maybeSingle();

    if (roomErr) {
      console.error('[TradeSync Join] Database error searching for room:', roomErr);
      return NextResponse.json(
        { error: `Database error querying trading room: ${roomErr.message}` },
        { status: 500 }
      );
    }

    if (!room) {
      return NextResponse.json(
        { error: 'Invalid invite code or room does not exist' },
        { status: 404 }
      );
    }

    // 2. Resolve or create user profile UUID
    let { data: profile, error: profileFetchErr } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('wallet_address', session.walletAddress)
      .maybeSingle();

    if (profileFetchErr) {
      console.error('[TradeSync Join] Profile lookup error:', profileFetchErr);
    }

    if (!profile) {
      const { data: upsertedProfile, error: profileUpsertErr } = await supabase
        .from('user_profiles')
        .upsert(
          {
            wallet_address: session.walletAddress,
            display_name: `${session.walletAddress.slice(0, 4)}...${session.walletAddress.slice(-4)}`,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'wallet_address' }
        )
        .select('id')
        .single();

      if (profileUpsertErr || !upsertedProfile) {
        console.error('[TradeSync Join] Failed to upsert user profile:', profileUpsertErr);
        throw new Error(`Failed to resolve user profile: ${profileUpsertErr?.message || 'Unknown error'}`);
      }
      profile = upsertedProfile;
    }

    if (!profile) {
      throw new Error('Failed to resolve user profile');
    }

    // 3. Insert or check membership
    const { data: existingMember, error: memberCheckErr } = await supabase
      .from('room_members')
      .select('role')
      .eq('room_id', room.id)
      .eq('user_id', profile.id)
      .maybeSingle();

    if (memberCheckErr) {
      console.error('[TradeSync Join] Member check error:', memberCheckErr);
    }

    const finalRole: 'admin' | 'member' = existingMember ? (existingMember.role as 'admin' | 'member') : 'member';

    if (!existingMember) {
      // First attempt stored procedure execution
      const { error: joinErr } = await supabase.rpc('join_room_by_invite', {
        p_room_id: room.id,
        p_invite_code: normalizedInviteCode,
        p_user_id: profile.id,
      });

      if (joinErr) {
        console.warn('[TradeSync Join] join_room_by_invite RPC notification:', joinErr.message);

        // Immediate rejection for genuine domain validation errors
        if (
          joinErr.message.includes('Invalid, expired, or exhausted') ||
          joinErr.message.includes('maximum member capacity') ||
          joinErr.message.includes('Room not found')
        ) {
          return NextResponse.json(
            { error: joinErr.message },
            { status: 400 }
          );
        }

        // Verify room invite code matches normalized code
        if (room.invite_code.toUpperCase() !== normalizedInviteCode) {
          return NextResponse.json(
            { error: 'Invalid invite code for this room' },
            { status: 400 }
          );
        }

        // Check room capacity limit before insert
        const { count, error: countErr } = await supabase
          .from('room_members')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', room.id);

        if (!countErr && typeof count === 'number' && count >= (room.max_members || 50)) {
          return NextResponse.json(
            { error: 'Room has reached maximum member capacity.' },
            { status: 400 }
          );
        }

        // Record membership under verified server role
        const { error: insertErr } = await supabase.from('room_members').insert({
          room_id: room.id,
          user_id: profile.id,
          role: 'member',
        });

        if (insertErr && !insertErr.message.includes('duplicate') && !insertErr.message.includes('unique')) {
          console.error('[TradeSync Join] Failed to insert room membership:', insertErr);
          return NextResponse.json(
            { error: insertErr.message || 'Failed to join room' },
            { status: 400 }
          );
        }
      }
    }

    // 4. Calculate accurate member count
    const { count: totalMembers } = await supabase
      .from('room_members')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id);

    const alphaRoom: AlphaRoom = {
      id: room.id,
      name: room.name,
      slug: room.slug,
      description: room.description || '',
      isPrivate: room.is_private,
      inviteCode: room.invite_code,
      memberCount: typeof totalMembers === 'number' ? totalMembers : 1,
      createdBy: room.created_by,
      createdAt: new Date(room.created_at).getTime(),
      tags: room.tags || [],
      currentUserRole: finalRole,
    };

    return NextResponse.json({ success: true, room: alphaRoom });
  } catch (error) {
    console.error('[TradeSync Join] Unhandled error joining room:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to join room' },
      { status: 500 }
    );
  }
}
