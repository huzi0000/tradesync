import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth/siws';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { RoomPost, VerifiedTradeRecord } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await context.params;
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ posts: [] });
    }

    const sessionCookie = request.cookies.get('tradesync_session')?.value;
    const session = sessionCookie ? verifySessionToken(sessionCookie) : null;

    // Check room access
    const { data: room, error: roomErr } = await supabase
      .from('trading_rooms')
      .select('id, is_private, created_by')
      .eq('id', roomId)
      .single();

    if (roomErr || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    if (room.is_private) {
      if (!session) {
        return NextResponse.json({ error: 'Authentication required for private room' }, { status: 401 });
      }

      // Check membership
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('wallet_address', session.walletAddress)
        .single();

      if (!profile) {
        return NextResponse.json({ error: 'Access denied to private room' }, { status: 403 });
      }

      const { data: membership } = await supabase
        .from('room_members')
        .select('role')
        .eq('room_id', roomId)
        .eq('user_id', profile.id)
        .single();

      if (!membership && room.created_by !== profile.id) {
        return NextResponse.json({ error: 'Access denied: not a room member' }, { status: 403 });
      }
    }

    // Fetch posts
    const { data: dbPosts, error: postsErr } = await supabase
      .from('room_posts')
      .select('*, user_profiles!author_id (wallet_address, display_name)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (postsErr) {
      throw postsErr;
    }

    const posts: RoomPost[] = (dbPosts || []).map((p) => {
      const authorWallet = p.user_profiles?.wallet_address || 'Unknown';
      const authorName = p.user_profiles?.display_name || `${authorWallet.slice(0, 4)}...${authorWallet.slice(-4)}`;

      return {
        id: p.id,
        roomId: p.room_id,
        authorId: p.author_id,
        authorAddress: authorWallet,
        authorName,
        content: p.content,
        postType: p.post_type,
        tradeData: p.metadata?.tradeData as VerifiedTradeRecord | undefined,
        createdAt: new Date(p.created_at).getTime(),
      };
    });

    return NextResponse.json({ posts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await context.params;
    const sessionCookie = request.cookies.get('tradesync_session')?.value;
    const session = sessionCookie ? verifySessionToken(sessionCookie) : null;

    if (!session || !session.walletAddress) {
      return NextResponse.json(
        { error: 'Cryptographic wallet authentication required to post' },
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
    const { content, postType = 'note', tradeData } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Post content cannot be empty' }, { status: 400 });
    }

    // Resolve user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, display_name')
      .eq('wallet_address', session.walletAddress)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 403 });
    }

    // Verify room membership
    const { data: membership } = await supabase
      .from('room_members')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_id', profile.id)
      .single();

    // Also check if user is the room creator
    const { data: room } = await supabase
      .from('trading_rooms')
      .select('created_by')
      .eq('id', roomId)
      .single();

    if (!membership && room?.created_by !== profile.id) {
      return NextResponse.json({ error: 'Only room members can post messages' }, { status: 403 });
    }

    // Insert post
    const { data: newPost, error: insertErr } = await supabase
      .from('room_posts')
      .insert({
        room_id: roomId,
        author_id: profile.id,
        post_type: postType,
        content: content.trim(),
        metadata: tradeData ? { tradeData } : {},
      })
      .select('*')
      .single();

    if (insertErr || !newPost) {
      throw insertErr || new Error('Failed to create post');
    }

    const post: RoomPost = {
      id: newPost.id,
      roomId: newPost.room_id,
      authorId: newPost.author_id,
      authorAddress: session.walletAddress,
      authorName: profile.display_name || `${session.walletAddress.slice(0, 4)}...${session.walletAddress.slice(-4)}`,
      content: newPost.content,
      postType: newPost.post_type,
      tradeData: tradeData || undefined,
      createdAt: new Date(newPost.created_at).getTime(),
    };

    return NextResponse.json({ success: true, post });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create post' },
      { status: 500 }
    );
  }
}
