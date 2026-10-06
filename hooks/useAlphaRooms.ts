'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlphaRoom, RoomMember, RoomPost, SharedWatchlistToken, VerifiedTradeRecord } from '../types';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';

const ROOMS_KEY = 'tradesync:alpha_rooms';
const POSTS_KEY = 'tradesync:room_posts';
const WATCHLISTS_KEY = 'tradesync:room_watchlists';
const MEMBERS_KEY = 'tradesync:room_members';

const INITIAL_ROOMS: AlphaRoom[] = [
  {
    id: 'room-jupiter-insiders',
    name: 'Jupiter Liquidity & Routing Research',
    slug: 'jupiter-liquidity-routing',
    description: 'Collaborative desk focused on Jupiter v6 swap routing, DEX liquidity shifts, and arbitrage efficiency.',
    memberCount: 3,
    isPrivate: true,
    inviteCode: 'JUP-ALPHA-2026',
    createdBy: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    createdAt: Date.now() - 604800000,
    tags: ['Jupiter', 'Arbitrage', 'DEX', 'Routing'],
    currentUserRole: 'member',
  },
  {
    id: 'room-solana-whales',
    name: 'Solana Ecosystem Core Watch',
    slug: 'solana-ecosystem-watch',
    description: 'Tracking major foundation transfers, validator stake movements, and liquid SPL token accumulations.',
    memberCount: 5,
    isPrivate: true,
    inviteCode: 'SOL-WHALE-99',
    createdBy: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    createdAt: Date.now() - 864000000,
    tags: ['Whales', 'Validators', 'Macro', 'SPL'],
    currentUserRole: 'member',
  },
];

export function useAlphaRooms(currentUserAddress?: string | null) {
  const [rooms, setRooms] = useState<AlphaRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [posts, setPosts] = useState<Record<string, RoomPost[]>>({});
  const [watchlists, setWatchlists] = useState<Record<string, SharedWatchlistToken[]>>({});
  const [members, setMembers] = useState<Record<string, RoomMember[]>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [cloudSynced, setCloudSynced] = useState(false);

  // Load from persistent storage + Supabase if configured
  useEffect(() => {
    let isMounted = true;

    // 1. Initial local load
    try {
      const storedRooms = localStorage.getItem(ROOMS_KEY);
      if (storedRooms) {
        setRooms(JSON.parse(storedRooms) as AlphaRoom[]);
      } else {
        setRooms(INITIAL_ROOMS);
        localStorage.setItem(ROOMS_KEY, JSON.stringify(INITIAL_ROOMS));
      }

      const storedPosts = localStorage.getItem(POSTS_KEY);
      if (storedPosts) setPosts(JSON.parse(storedPosts));

      const storedWatchlists = localStorage.getItem(WATCHLISTS_KEY);
      if (storedWatchlists) setWatchlists(JSON.parse(storedWatchlists));

      const storedMembers = localStorage.getItem(MEMBERS_KEY);
      if (storedMembers) setMembers(JSON.parse(storedMembers));
    } catch {
      setRooms(INITIAL_ROOMS);
    }
    setIsLoaded(true);

    // 2. Cloud Supabase Sync & Realtime Subscription
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        // Fetch rooms
        Promise.resolve(
          supabase
            .from('trading_rooms')
            .select('*')
            .order('created_at', { ascending: false })
        )
          .then(({ data: dbRooms, error }) => {
            if (!error && dbRooms && dbRooms.length > 0 && isMounted) {
              const mappedRooms: AlphaRoom[] = dbRooms.map((r) => ({
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
                currentUserRole: r.created_by === currentUserAddress ? 'admin' : 'member',
              }));
              setRooms(mappedRooms);
              setCloudSynced(true);
            }
          })
          .catch(() => {});

        // Fetch posts
        Promise.resolve(
          supabase
            .from('room_posts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100)
        )
          .then(({ data: dbPosts, error }) => {
            if (!error && dbPosts && isMounted) {
              const postsByRoom: Record<string, RoomPost[]> = {};
              for (const p of dbPosts) {
                if (!postsByRoom[p.room_id]) postsByRoom[p.room_id] = [];
                postsByRoom[p.room_id]!.push({
                  id: p.id,
                  roomId: p.room_id,
                  authorId: p.author_id,
                  authorAddress: p.author_id,
                  authorName: `${p.author_id.slice(0, 4)}...${p.author_id.slice(-4)}`,
                  content: p.content,
                  postType: p.post_type,
                  tradeData: p.metadata?.tradeData,
                  createdAt: new Date(p.created_at).getTime(),
                });
              }
              setPosts((prev) => ({ ...prev, ...postsByRoom }));
            }
          })
          .catch(() => {});

        // Realtime subscription on room_posts
        const channel = supabase
          .channel('public:room_posts')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'room_posts' },
            (payload) => {
              const p = payload.new as {
                id: string;
                room_id: string;
                author_id: string;
                content: string;
                post_type: RoomPost['postType'];
                metadata: { tradeData?: VerifiedTradeRecord };
                created_at: string;
              };
              if (p && isMounted) {
                const newPost: RoomPost = {
                  id: p.id,
                  roomId: p.room_id,
                  authorId: p.author_id,
                  authorAddress: p.author_id,
                  authorName: `${p.author_id.slice(0, 4)}...${p.author_id.slice(-4)}`,
                  content: p.content,
                  postType: p.post_type,
                  tradeData: p.metadata?.tradeData,
                  createdAt: new Date(p.created_at).getTime(),
                };
                setPosts((prev) => ({
                  ...prev,
                  [p.room_id]: [newPost, ...(prev[p.room_id] || [])],
                }));
              }
            }
          )
          .subscribe();

        return () => {
          isMounted = false;
          supabase.removeChannel(channel);
        };
      }
    }

    return () => {
      isMounted = false;
    };
  }, [currentUserAddress]);

  const saveRooms = useCallback((newRooms: AlphaRoom[]) => {
    try {
      localStorage.setItem(ROOMS_KEY, JSON.stringify(newRooms));
    } catch {}
    setRooms(newRooms);
  }, []);

  const savePosts = useCallback((newPosts: Record<string, RoomPost[]>) => {
    try {
      localStorage.setItem(POSTS_KEY, JSON.stringify(newPosts));
    } catch {}
    setPosts(newPosts);
  }, []);

  const saveWatchlists = useCallback((newWatchlists: Record<string, SharedWatchlistToken[]>) => {
    try {
      localStorage.setItem(WATCHLISTS_KEY, JSON.stringify(newWatchlists));
    } catch {}
    setWatchlists(newWatchlists);
  }, []);

  const saveMembers = useCallback((newMembers: Record<string, RoomMember[]>) => {
    try {
      localStorage.setItem(MEMBERS_KEY, JSON.stringify(newMembers));
    } catch {}
    setMembers(newMembers);
  }, []);

  // Create room
  const createRoom = useCallback((
    name: string,
    description: string,
    isPrivate: boolean,
    tags: string[]
  ): AlphaRoom => {
    const user = currentUserAddress || 'Anonymous-User';
    const id = `room-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const inviteCode = `SYNC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const newRoom: AlphaRoom = {
      id,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description,
      isPrivate,
      inviteCode,
      memberCount: 1,
      createdBy: user,
      createdAt: Date.now(),
      tags,
      currentUserRole: 'admin',
    };

    const nextRooms = [newRoom, ...rooms];
    saveRooms(nextRooms);

    // Initial member entry
    const initialMember: RoomMember = {
      userId: `user-${user.slice(0, 8)}`,
      walletAddress: user,
      displayName: `${user.slice(0, 4)}...${user.slice(-4)}`,
      role: 'admin',
      joinedAt: Date.now(),
    };
    const nextMembers = { ...members, [id]: [initialMember] };
    saveMembers(nextMembers);

    // Cloud insert if Supabase is active
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        Promise.resolve(
          supabase.from('trading_rooms').insert({
            name,
            slug: newRoom.slug,
            description,
            is_private: isPrivate,
            invite_code: inviteCode,
            tags,
          })
        ).catch(() => {});
      }
    }

    return newRoom;
  }, [currentUserAddress, rooms, members, saveRooms, saveMembers]);

  // Join room by invite code
  const joinRoomByInvite = useCallback((code: string): { success: boolean; error?: string; room?: AlphaRoom } => {
    const trimmed = code.trim().toUpperCase();
    const targetRoom = rooms.find(r => r.inviteCode.toUpperCase() === trimmed);

    if (!targetRoom) {
      return { success: false, error: 'Invalid invite code or room does not exist.' };
    }

    const user = currentUserAddress || 'Anonymous-User';
    const roomMembers = members[targetRoom.id] || [];

    if (roomMembers.some(m => m.walletAddress === user)) {
      return { success: true, room: targetRoom };
    }

    const newMember: RoomMember = {
      userId: `user-${user.slice(0, 8)}`,
      walletAddress: user,
      displayName: `${user.slice(0, 4)}...${user.slice(-4)}`,
      role: 'member',
      joinedAt: Date.now(),
    };

    const updatedMembers = { ...members, [targetRoom.id]: [...roomMembers, newMember] };
    saveMembers(updatedMembers);

    const updatedRooms = rooms.map(r =>
      r.id === targetRoom.id
        ? { ...r, memberCount: r.memberCount + 1, currentUserRole: 'member' as const }
        : r
    );
    saveRooms(updatedRooms);

    return { success: true, room: targetRoom };
  }, [rooms, members, currentUserAddress, saveMembers, saveRooms]);

  // Add post or research note
  const addPost = useCallback((
    roomId: string,
    content: string,
    postType: RoomPost['postType'] = 'note',
    tradeData?: VerifiedTradeRecord
  ) => {
    const user = currentUserAddress || 'Anonymous-User';
    const newPost: RoomPost = {
      id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      roomId,
      authorId: `user-${user.slice(0, 8)}`,
      authorAddress: user,
      authorName: `${user.slice(0, 4)}...${user.slice(-4)}`,
      content,
      postType,
      tradeData,
      createdAt: Date.now(),
    };

    const currentRoomPosts = posts[roomId] || [];
    const nextPosts = { ...posts, [roomId]: [newPost, ...currentRoomPosts] };
    savePosts(nextPosts);

    // Cloud insert if Supabase is active
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        Promise.resolve(
          supabase.from('room_posts').insert({
            room_id: roomId,
            post_type: postType,
            content,
            metadata: tradeData ? { tradeData } : {},
          })
        ).catch(() => {});
      }
    }

    return newPost;
  }, [currentUserAddress, posts, savePosts]);

  // Add token to room watchlist
  const addWatchlistToken = useCallback((
    roomId: string,
    mint: string,
    symbol: string,
    name: string,
    notes?: string,
    targetPrice?: number
  ) => {
    const user = currentUserAddress || 'Anonymous-User';
    const currentTokens = watchlists[roomId] || [];

    if (currentTokens.some(t => t.mint === mint)) return false;

    const newToken: SharedWatchlistToken = {
      id: `wl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      roomId,
      mint,
      symbol,
      name,
      notes,
      addedByAddress: user,
      targetPrice,
      addedAt: Date.now(),
    };

    const nextWatchlists = { ...watchlists, [roomId]: [newToken, ...currentTokens] };
    saveWatchlists(nextWatchlists);
    return true;
  }, [currentUserAddress, watchlists, saveWatchlists]);

  // Remove token from room watchlist
  const removeWatchlistToken = useCallback((roomId: string, mint: string) => {
    const currentTokens = watchlists[roomId] || [];
    const nextTokens = currentTokens.filter(t => t.mint !== mint);
    saveWatchlists({ ...watchlists, [roomId]: nextTokens });
  }, [watchlists, saveWatchlists]);

  // Remove member (admin action)
  const removeMember = useCallback((roomId: string, memberAddress: string): boolean => {
    const room = rooms.find(r => r.id === roomId);
    if (!room || room.currentUserRole !== 'admin') {
      return false;
    }

    const roomMembers = members[roomId] || [];
    const updatedMembers = roomMembers.filter(m => m.walletAddress !== memberAddress);
    saveMembers({ ...members, [roomId]: updatedMembers });

    const updatedRooms = rooms.map(r =>
      r.id === roomId ? { ...r, memberCount: Math.max(1, r.memberCount - 1) } : r
    );
    saveRooms(updatedRooms);

    return true;
  }, [rooms, members, saveMembers, saveRooms]);

  // Leave room
  const leaveRoom = useCallback((roomId: string): boolean => {
    const user = currentUserAddress || 'Anonymous-User';
    const roomMembers = members[roomId] || [];
    const updatedMembers = roomMembers.filter(m => m.walletAddress !== user);
    saveMembers({ ...members, [roomId]: updatedMembers });

    const updatedRooms = rooms.map(r =>
      r.id === roomId ? { ...r, memberCount: Math.max(0, r.memberCount - 1), currentUserRole: undefined } : r
    );
    saveRooms(updatedRooms);

    if (activeRoomId === roomId) {
      setActiveRoomId(null);
    }
    return true;
  }, [currentUserAddress, members, rooms, activeRoomId, saveMembers, saveRooms]);

  return {
    rooms,
    activeRoomId,
    setActiveRoomId,
    posts,
    watchlists,
    members,
    isLoaded,
    cloudSynced,
    createRoom,
    joinRoomByInvite,
    addPost,
    addWatchlistToken,
    removeWatchlistToken,
    removeMember,
    leaveRoom,
  };
}
