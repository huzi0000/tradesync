import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth/siws';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { AlphaRoom } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ standalone: true, rooms: [] });
    }

    const sessionCookie = request.cookies.get('tradesync_session')?.value;
    const session = sessionCookie ? verifySessionToken(sessionCookie) : null;

    let userProfileId: string | null = null;
    let memberRoomIds = new Set<string>();
    let memberRoles = new Map<string, 'admin' | 'member'>();

    if (session) {
      // Look up user profile UUID for authenticated wallet
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('wallet_address', session.walletAddress)
        .single();

      if (profile) {
        userProfileId = profile.id;

        // Fetch memberships
        const { data: memberships } = await supabase
          .from('room_members')
          .select('room_id, role')
          .eq('user_id', userProfileId);

        if (memberships) {
          for (const m of memberships) {
            memberRoomIds.add(m.room_id);
            memberRoles.set(m.room_id, m.role as 'admin' | 'member');
          }
        }
      }
    }

    // Fetch rooms: public rooms OR rooms where user is member/creator
    const { data: dbRooms, error } = await supabase
      .from('trading_rooms')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const visibleRooms: AlphaRoom[] = (dbRooms || [])
      .filter((r) => !r.is_private || memberRoomIds.has(r.id) || (userProfileId && r.created_by === userProfileId))
      .map((r) => {
        let role = memberRoles.get(r.id);
        if (!role && userProfileId && r.created_by === userProfileId) {
          role = 'admin';
        }

        return {
          id: r.id,
          name: r.name,
          slug: r.slug,
          description: r.description || '',
          isPrivate: r.is_private,
          inviteCode: r.invite_code,
          memberCount: r.max_members || 1,
          createdBy: r.created_by,
          createdAt: new Date(r.created_at).getTime(),
          tags: r.tags || [],
          currentUserRole: role,
        };
      });

    return NextResponse.json({ rooms: visibleRooms });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch rooms' },
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
        { error: 'Cryptographic wallet authentication required to create rooms' },
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
    const { name, description, isPrivate, tags } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Room name is required' }, { status: 400 });
    }

    // 1. Resolve or create user profile UUID
    let { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('wallet_address', session.walletAddress)
      .single();

    if (!profile) {
      const { data: newProfile, error: profileErr } = await supabase
        .from('user_profiles')
        .insert({
          wallet_address: session.walletAddress,
          display_name: `${session.walletAddress.slice(0, 4)}...${session.walletAddress.slice(-4)}`,
        })
        .select('id')
        .single();

      if (profileErr || !newProfile) {
        throw new Error(`Profile creation failed: ${profileErr?.message}`);
      }
      profile = newProfile;
    }

    // 2. Generate slug & unique invite code
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
    const inviteCode = `SYNC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // 3. Insert trading room
    const { data: room, error: roomErr } = await supabase
      .from('trading_rooms')
      .insert({
        name: name.trim(),
        slug,
        description: description?.trim() || '',
        is_private: Boolean(isPrivate),
        invite_code: inviteCode,
        created_by: profile.id,
        tags: Array.isArray(tags) ? tags : [],
      })
      .select('*')
      .single();

    if (roomErr || !room) {
      throw new Error(`Room creation failed: ${roomErr?.message}`);
    }

    // 4. Insert creator as admin in room_members
    await supabase.from('room_members').insert({
      room_id: room.id,
      user_id: profile.id,
      role: 'admin',
    });

    const newAlphaRoom: AlphaRoom = {
      id: room.id,
      name: room.name,
      slug: room.slug,
      description: room.description || '',
      isPrivate: room.is_private,
      inviteCode: room.invite_code,
      memberCount: 1,
      createdBy: session.walletAddress,
      createdAt: new Date(room.created_at).getTime(),
      tags: room.tags || [],
      currentUserRole: 'admin',
    };

    return NextResponse.json({ success: true, room: newAlphaRoom });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create room' },
      { status: 500 }
    );
  }
}
