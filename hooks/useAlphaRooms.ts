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

  // Load from persistent storage + server API
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

    // 2. Fetch authenticated rooms from server API
    fetch('/api/rooms')
      .then((res) => res.json())
      .then((data) => {
        if (data.rooms && data.rooms.length > 0 && isMounted) {
          setRooms(data.rooms);
          setCloudSynced(true);
          try {
            localStorage.setItem(ROOMS_KEY, JSON.stringify(data.rooms));
          } catch {}
        }
      })
      .catch(() => {});

    // 3. Supabase Realtime Subscription if configured
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
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

  // When active room changes, fetch fresh posts from server API
  useEffect(() => {
    if (!activeRoomId) return;

    fetch(`/api/rooms/${activeRoomId}/posts`)
      .then((res) => res.json())
      .then((data) => {
        if (data.posts && Array.isArray(data.posts)) {
          setPosts((prev) => ({
            ...prev,
            [activeRoomId]: data.posts,
          }));
          try {
            const currentStored = JSON.parse(localStorage.getItem(POSTS_KEY) || '{}');
            localStorage.setItem(
              POSTS_KEY,
              JSON.stringify({ ...currentStored, [activeRoomId]: data.posts })
            );
          } catch {}
        }
      })
      .catch(() => {});
  }, [activeRoomId]);

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

  // Create room with server verification
  const createRoom = useCallback(async (
    name: string,
    description: string,
    isPrivate: boolean,
    tags: string[]
  ): Promise<AlphaRoom> => {
    const user = currentUserAddress || 'Anonymous-User';
    const fallbackId = `room-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const fallbackInviteCode = `SYNC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    let newRoom: AlphaRoom = {
      id: fallbackId,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description,
      isPrivate,
      inviteCode: fallbackInviteCode,
      memberCount: 1,
      createdBy: user,
      createdAt: Date.now(),
      tags,
      currentUserRole: 'admin',
    };

    // Try server API first
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, isPrivate, tags }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          newRoom = data.room;
        }
      }
    } catch {}

    const nextRooms = [newRoom, ...rooms];
    saveRooms(nextRooms);

    const initialMember: RoomMember = {
      userId: `user-${user.slice(0, 8)}`,
      walletAddress: user,
      displayName: `${user.slice(0, 4)}...${user.slice(-4)}`,
      role: 'admin',
      joinedAt: Date.now(),
    };
    const nextMembers = { ...members, [newRoom.id]: [initialMember] };
    saveMembers(nextMembers);

    return newRoom;
  }, [currentUserAddress, rooms, members, saveRooms, saveMembers]);

  // Join room by invite code with server verification
  const joinRoomByInvite = useCallback(async (code: string): Promise<{ success: boolean; error?: string; room?: AlphaRoom }> => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      return { success: false, error: 'Please enter an invite code.' };
    }

    // Try server API first
    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ inviteCode: trimmed }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.room) {
        const joinedRoom: AlphaRoom = data.room;
        setRooms((prev) => {
          const exists = prev.some((r) => r.id === joinedRoom.id);
          const next = exists
            ? prev.map((r) => (r.id === joinedRoom.id ? joinedRoom : r))
            : [joinedRoom, ...prev];
          saveRooms(next);
          return next;
        });

        // Also add member record locally if user wallet exists
        if (currentUserAddress) {
          setMembers((prev) => {
            const currentList = prev[joinedRoom.id] || [];
            if (!currentList.some((m) => m.walletAddress === currentUserAddress)) {
              const newM: RoomMember = {
                userId: `user-${currentUserAddress.slice(0, 8)}`,
                walletAddress: currentUserAddress,
                displayName: `${currentUserAddress.slice(0, 4)}...${currentUserAddress.slice(-4)}`,
                role: joinedRoom.currentUserRole || 'member',
                joinedAt: Date.now(),
              };
              const updated = { ...prev, [joinedRoom.id]: [...currentList, newM] };
              saveMembers(updated);
              return updated;
            }
            return prev;
          });
        }

        return { success: true, room: joinedRoom };
      }

      // If the server responded with an error, do NOT mask it with a misleading local fallback!
      if (!res.ok) {
        return {
          success: false,
          error: data?.error || `Failed to join room (HTTP ${res.status})`,
        };
      }
    } catch (netErr) {
      console.warn('[useAlphaRooms] Server join request unreachable, falling back to local storage:', netErr);
    }

    // Fallback to local check ONLY when offline / server unreachable
    const targetRoom = rooms.find((r) => r.inviteCode.toUpperCase() === trimmed);
    if (!targetRoom) {
      return { success: false, error: 'Invalid invite code or room does not exist.' };
    }

    const user = currentUserAddress || 'Anonymous-User';
    const roomMembers = members[targetRoom.id] || [];

    if (roomMembers.some((m) => m.walletAddress === user)) {
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

    const updatedRooms = rooms.map((r) =>
      r.id === targetRoom.id
        ? { ...r, memberCount: r.memberCount + 1, currentUserRole: 'member' as const }
        : r
    );
    saveRooms(updatedRooms);

    return { success: true, room: targetRoom };
  }, [rooms, members, currentUserAddress, saveMembers, saveRooms]);

  // Add post or research note with server verification
  const addPost = useCallback(async (
    roomId: string,
    content: string,
    postType: RoomPost['postType'] = 'note',
    tradeData?: VerifiedTradeRecord
  ): Promise<RoomPost> => {
    const user = currentUserAddress || 'Anonymous-User';
    let newPost: RoomPost = {
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

    // Try server API first
    try {
      const res = await fetch(`/api/rooms/${roomId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, postType, tradeData }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.post) {
          newPost = data.post;
        }
      }
    } catch {}

    const currentRoomPosts = posts[roomId] || [];
    const nextPosts = { ...posts, [roomId]: [newPost, ...currentRoomPosts] };
    savePosts(nextPosts);

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

    if (currentTokens.some((t) => t.mint === mint)) return false;

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
    const nextTokens = currentTokens.filter((t) => t.mint !== mint);
    saveWatchlists({ ...watchlists, [roomId]: nextTokens });
  }, [watchlists, saveWatchlists]);

  // Remove member (admin action)
  const removeMember = useCallback((roomId: string, memberAddress: string): boolean => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room || room.currentUserRole !== 'admin') {
      return false;
    }

    const roomMembers = members[roomId] || [];
    const updatedMembers = roomMembers.filter((m) => m.walletAddress !== memberAddress);
    saveMembers({ ...members, [roomId]: updatedMembers });

    const updatedRooms = rooms.map((r) =>
      r.id === roomId ? { ...r, memberCount: Math.max(1, r.memberCount - 1) } : r
    );
    saveRooms(updatedRooms);

    return true;
  }, [rooms, members, saveMembers, saveRooms]);

  // Leave room
  const leaveRoom = useCallback((roomId: string): boolean => {
    const user = currentUserAddress || 'Anonymous-User';
    const roomMembers = members[roomId] || [];
    const updatedMembers = roomMembers.filter((m) => m.walletAddress !== user);
    saveMembers({ ...members, [roomId]: updatedMembers });

    const updatedRooms = rooms.map((r) =>
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
