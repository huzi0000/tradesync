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
        { error: 'Cryptographic wallet authentication required to join room' },
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
    const { inviteCode } = body;

    if (!inviteCode || typeof inviteCode !== 'string') {
      return NextResponse.json({ error: 'Valid invite code required' }, { status: 400 });
    }

    // 1. Find room by invite code
    const { data: room, error: roomErr } = await supabase
      .from('trading_rooms')
      .select('*')
      .ilike('invite_code', inviteCode.trim())
      .single();

    if (roomErr || !room) {
      return NextResponse.json({ error: 'Room not found or invalid invite code' }, { status: 404 });
    }

    // 2. Resolve or create user profile UUID
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

    if (!profile) {
      throw new Error('Failed to resolve user profile');
    }

    // 3. Insert or check membership
    const { data: existingMember } = await supabase
      .from('room_members')
      .select('*')
      .eq('room_id', room.id)
      .eq('user_id', profile.id)
      .single();

    if (!existingMember) {
      await supabase.from('room_members').insert({
        room_id: room.id,
        user_id: profile.id,
        role: 'member',
      });
    }

    const alphaRoom: AlphaRoom = {
      id: room.id,
      name: room.name,
      slug: room.slug,
      description: room.description || '',
      isPrivate: room.is_private,
      inviteCode: room.invite_code,
      memberCount: room.max_members || 1,
      createdBy: room.created_by,
      createdAt: new Date(room.created_at).getTime(),
      tags: room.tags || [],
      currentUserRole: existingMember ? existingMember.role : 'member',
    };

    return NextResponse.json({ success: true, room: alphaRoom });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to join room' },
      { status: 500 }
    );
  }
}
