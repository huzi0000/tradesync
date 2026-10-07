'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardMeta } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AddressDisplay } from '../../components/ui/AddressDisplay';
import { TradeShareModal } from '../../components/rooms/TradeShareModal';
import { useAlphaRooms } from '../../hooks/useAlphaRooms';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Users,
  Lock,
  Plus,
  KeyRound,
  ArrowRight,
  Send,
  Share2,
  Copy,
  Check,
  ShieldCheck,
  Trash2,
  LogOut,
  ExternalLink,
  MessageSquare,
  TrendingUp,
  FileText,
  Bookmark,
} from 'lucide-react';
import { formatTimeAgo, getSolscanTxUrl, isValidSolanaAddress } from '../../lib/utils';
import { VerifiedTradeRecord } from '../../types';

export default function RoomsPage() {
  const { publicKey } = useWallet();
  const userAddress = publicKey ? publicKey.toString() : null;

  const {
    rooms,
    activeRoomId,
    setActiveRoomId,
    posts,
    watchlists,
    members,
    createRoom,
    joinRoomByInvite,
    addPost,
    addWatchlistToken,
    removeWatchlistToken,
    removeMember,
    leaveRoom,
  } = useAlphaRooms(userAddress);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showShareTradeModal, setShowShareTradeModal] = useState(false);

  // Create form
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [newRoomPrivate, setNewRoomPrivate] = useState(true);
  const [newRoomTags, setNewRoomTags] = useState('Solana, Alpha, Swaps');

  // Join form
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  // Active room workspace tabs
  const [roomTab, setRoomTab] = useState<'feed' | 'trades' | 'watchlist' | 'members'>('feed');

  // Feed post inputs
  const [postContent, setPostContent] = useState('');

  // Watchlist inputs
  const [wlMint, setWlMint] = useState('');
  const [wlSymbol, setWlSymbol] = useState('');
  const [wlNotes, setWlNotes] = useState('');
  const [wlTarget, setWlTarget] = useState('');
  const [wlError, setWlError] = useState<string | null>(null);

  // Copy state
  const [copiedCode, setCopiedCode] = useState(false);

  const activeRoom = rooms.find(r => r.id === activeRoomId);
  const activePosts = activeRoomId ? posts[activeRoomId] || [] : [];
  const activeWatchlist = activeRoomId ? watchlists[activeRoomId] || [] : [];
  const activeMembers = activeRoomId ? members[activeRoomId] || [] : [];

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    const tags = newRoomTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const created = await createRoom(newRoomName.trim(), newRoomDesc.trim(), newRoomPrivate, tags);
    setShowCreateModal(false);
    setNewRoomName('');
    setNewRoomDesc('');
    if (created?.id) setActiveRoomId(created.id);
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    const trimmed = joinCode.trim().toUpperCase();
    if (!trimmed) {
      setJoinError('Please enter an invite code');
      return;
    }
    const res = await joinRoomByInvite(trimmed);
    if (!res.success) {
      setJoinError(res.error || 'Failed to join room');
      return;
    }
    setShowJoinModal(false);
    setJoinCode('');
    if (res.room) setActiveRoomId(res.room.id);
  };

  const handleSendPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoomId || !postContent.trim()) return;
    addPost(activeRoomId, postContent.trim(), 'note');
    setPostContent('');
  };

  const handleTradeShared = (trade: VerifiedTradeRecord, note: string) => {
    if (!activeRoomId) return;
    const content = note
      ? `${note}\n\n[Verified Swap: ${trade.inputToken.amount.toFixed(4)} ${trade.inputToken.symbol} → ${trade.outputToken.amount.toFixed(4)} ${trade.outputToken.symbol} via ${trade.dexName}]`
      : `Shared a verified on-chain swap via ${trade.dexName}`;
    addPost(activeRoomId, content, 'trade', trade);
  };

  const handleAddWatchlistToken = (e: React.FormEvent) => {
    e.preventDefault();
    setWlError(null);
    if (!activeRoomId) return;

    if (!isValidSolanaAddress(wlMint.trim())) {
      setWlError('Invalid Solana token mint address');
      return;
    }

    const success = addWatchlistToken(
      activeRoomId,
      wlMint.trim(),
      wlSymbol.trim().toUpperCase() || 'TOKEN',
      wlSymbol.trim() || 'Custom SPL Token',
      wlNotes.trim(),
      wlTarget ? parseFloat(wlTarget) : undefined
    );

    if (!success) {
      setWlError('Token is already on this room watchlist');
      return;
    }

    setWlMint('');
    setWlSymbol('');
    setWlNotes('');
    setWlTarget('');
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1500);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DAD8D1]">
        <div>
          <h2 className="text-base font-bold text-[#1B2428] tracking-tight">Alpha Rooms</h2>
          <p className="text-xs text-[#7D8A89]">
            Private desks for collaborative Solana trading intelligence & verified trade sharing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowJoinModal(true)}>
            <KeyRound size={13} />
            <span>Join via Code</span>
          </Button>
          <Button size="sm" variant="primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={13} />
            <span>Create Room</span>
          </Button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      {!activeRoom ? (
        /* Room Directory View */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#7D8A89]">
              Available & Joined Desks ({rooms.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rooms.map(room => (
              <Card key={room.id} className="hover:border-[#1B2428] transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-[#1B2428]">{room.name}</h4>
                      {room.isPrivate && (
                        <Badge variant="neutral">
                          <span className="flex items-center gap-1">
                            <Lock size={10} /> Private
                          </span>
                        </Badge>
                      )}
                    </div>
                    {room.currentUserRole && (
                      <Badge variant={room.currentUserRole === 'admin' ? 'info' : 'neutral'}>
                        {room.currentUserRole === 'admin' ? 'Admin' : 'Member'}
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-[#7D8A89] leading-relaxed mb-3">
                    {room.description}
                  </p>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {room.tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#F8F7F4] border border-[#DEDCD5] text-[#7D8A89]"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#DAD8D1] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-[#7D8A89]">
                    <Users size={13} />
                    <span>{room.memberCount} member(s)</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setActiveRoomId(room.id)}>
                    <span>Enter Room</span>
                    <ArrowRight size={13} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        /* Active Room Workspace */
        <div className="space-y-4">
          {/* Active Room Top Banner */}
          <div className="p-4 bg-white border border-[#DEDCD5] rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DAD8D1]">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveRoomId(null)}
                    className="text-xs text-[#BA6249] hover:underline"
                  >
                    ← All Rooms
                  </button>
                  <span className="text-xs text-[#7D8A89]">/</span>
                  <h3 className="text-sm font-bold text-[#1B2428]">{activeRoom.name}</h3>
                  <Badge variant={activeRoom.currentUserRole === 'admin' ? 'info' : 'neutral'}>
                    {activeRoom.currentUserRole === 'admin' ? 'Admin' : 'Member'}
                  </Badge>
                </div>
                <p className="text-xs text-[#7D8A89]">{activeRoom.description}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => copyInviteCode(activeRoom.inviteCode)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#F8F7F4] border border-[#DEDCD5] text-xs font-mono text-[#1B2428] hover:bg-[#E8E5DE] transition-colors"
                  title="Copy room invitation code"
                >
                  {copiedCode ? <Check size={12} className="text-[#387B60]" /> : <Copy size={12} />}
                  <span>{activeRoom.inviteCode}</span>
                </button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => leaveRoom(activeRoom.id)}
                  title="Leave this room"
                >
                  <LogOut size={12} />
                  <span className="hidden sm:inline">Leave</span>
                </Button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 pt-3 text-xs overflow-x-auto">
              <button
                onClick={() => setRoomTab('feed')}
                className={`px-3 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5 ${
                  roomTab === 'feed'
                    ? 'bg-[#E8E5DE] text-[#1B2428]'
                    : 'text-[#7D8A89] hover:bg-[#F8F7F4] hover:text-[#1B2428]'
                }`}
              >
                <MessageSquare size={13} />
                <span>Research & Trade Feed</span>
                <span className="text-[10px] opacity-75">({activePosts.length})</span>
              </button>

              <button
                onClick={() => setRoomTab('trades')}
                className={`px-3 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5 ${
                  roomTab === 'trades'
                    ? 'bg-[#E8E5DE] text-[#1B2428]'
                    : 'text-[#7D8A89] hover:bg-[#F8F7F4] hover:text-[#1B2428]'
                }`}
              >
                <TrendingUp size={13} />
                <span>Verified Trades</span>
                <span className="text-[10px] opacity-75">
                  ({activePosts.filter(p => p.tradeData).length})
                </span>
              </button>

              <button
                onClick={() => setRoomTab('watchlist')}
                className={`px-3 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5 ${
                  roomTab === 'watchlist'
                    ? 'bg-[#E8E5DE] text-[#1B2428]'
                    : 'text-[#7D8A89] hover:bg-[#F8F7F4] hover:text-[#1B2428]'
                }`}
              >
                <Bookmark size={13} />
                <span>Shared Watchlist</span>
                <span className="text-[10px] opacity-75">({activeWatchlist.length})</span>
              </button>

              <button
                onClick={() => setRoomTab('members')}
                className={`px-3 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5 ${
                  roomTab === 'members'
                    ? 'bg-[#E8E5DE] text-[#1B2428]'
                    : 'text-[#7D8A89] hover:bg-[#F8F7F4] hover:text-[#1B2428]'
                }`}
              >
                <Users size={13} />
                <span>Members & Access</span>
                <span className="text-[10px] opacity-75">({activeMembers.length})</span>
              </button>
            </div>
          </div>

          {/* TAB 1: FEED & TRADE SHARING */}
          {roomTab === 'feed' && (
            <div className="space-y-4">
              {/* Post Creation Box */}
              <div className="p-3 bg-white border border-[#DEDCD5] rounded-lg">
                <form onSubmit={handleSendPost} className="space-y-2">
                  <textarea
                    rows={2}
                    value={postContent}
                    onChange={e => setPostContent(e.target.value)}
                    placeholder="Share market insight, on-chain observations, or trade thesis..."
                    className="w-full p-2.5 text-xs text-[#1B2428] bg-[#F8F7F4] border border-[#DEDCD5] rounded focus:outline-none focus:border-[#1B2428]"
                  />
                  <div className="flex items-center justify-between">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowShareTradeModal(true)}
                    >
                      <Share2 size={13} />
                      <span>Share Verified Swap</span>
                    </Button>
                    <Button type="submit" size="sm" variant="primary" disabled={!postContent.trim()}>
                      <Send size={13} />
                      <span>Post</span>
                    </Button>
                  </div>
                </form>
              </div>

              {/* Feed Stream */}
              <div className="space-y-3">
                {activePosts.length === 0 ? (
                  <div className="p-8 text-center bg-white border border-[#DEDCD5] rounded-lg">
                    <MessageSquare size={20} className="mx-auto text-[#7D8A89] mb-2" />
                    <p className="text-xs font-semibold text-[#1B2428]">Room Feed is Empty</p>
                    <p className="text-[11px] text-[#7D8A89] mt-1">
                      Be the first to publish a research note or share a verified Solana swap.
                    </p>
                  </div>
                ) : (
                  activePosts.map(p => (
                    <div key={p.id} className="p-3.5 bg-white border border-[#DEDCD5] rounded-lg space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#1B2428] font-mono">
                            {p.authorName}
                          </span>
                          <span className="text-[10px] text-[#7D8A89]">
                            {formatTimeAgo(p.createdAt / 1000)}
                          </span>
                        </div>
                        {p.tradeData && (
                          <Badge variant={p.tradeData.isOwnerVerified ? 'success' : 'neutral'}>
                            {p.tradeData.isOwnerVerified ? 'Verified Owner' : 'Observed Swap'}
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-[#1B2428] whitespace-pre-wrap leading-relaxed">
                        {p.content}
                      </p>

                      {p.tradeData && (
                        <div className="p-2.5 bg-[#F8F7F4] border border-[#DEDCD5] rounded space-y-1.5 text-xs">
                          <div className="flex items-center justify-between font-bold text-[#1B2428]">
                            <span>{p.tradeData.dexName}</span>
                            <span className="text-[10px] text-[#7D8A89] font-normal">
                              Slot: #{p.tradeData.slot}
                            </span>
                          </div>
                          <div className="flex items-center justify-between font-mono">
                            <span>
                              {p.tradeData.inputToken.amount.toFixed(4)} {p.tradeData.inputToken.symbol}
                            </span>
                            <ArrowRight size={12} className="text-[#7D8A89]" />
                            <span className="text-[#387B60] font-semibold">
                              +{p.tradeData.outputToken.amount.toFixed(4)} {p.tradeData.outputToken.symbol}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-[#7D8A89] pt-1 border-t border-[#DAD8D1]">
                            <span>Signer: {p.tradeData.signerWallet.slice(0, 6)}...</span>
                            <a
                              href={getSolscanTxUrl(p.tradeData.signature)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#BA6249] hover:underline"
                            >
                              Solscan ↗
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: VERIFIED TRADES */}
          {roomTab === 'trades' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#7D8A89]">
                  Verified Room Trade Records
                </h4>
                <Button size="sm" variant="primary" onClick={() => setShowShareTradeModal(true)}>
                  <Plus size={13} />
                  <span>Verify & Share Swap</span>
                </Button>
              </div>

              <div className="overflow-x-auto border border-[#DEDCD5] rounded-lg bg-white">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F8F7F4] border-b border-[#DAD8D1] text-[#7D8A89]">
                    <tr>
                      <th className="py-2.5 px-3">DEX Venue</th>
                      <th className="py-2.5 px-3">Swap Flow</th>
                      <th className="py-2.5 px-3">Signer</th>
                      <th className="py-2.5 px-3">Verification</th>
                      <th className="py-2.5 px-3 text-right">Explorer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DAD8D1]">
                    {activePosts.filter(p => p.tradeData).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[#7D8A89]">
                          No trades verified in this room yet. Use Verify & Share Swap to submit a transaction.
                        </td>
                      </tr>
                    ) : (
                      activePosts
                        .filter(p => p.tradeData)
                        .map(p => {
                          const t = p.tradeData!;
                          return (
                            <tr key={t.id} className="hover:bg-[#FAF8F5]">
                              <td className="py-2.5 px-3 font-semibold text-[#1B2428]">{t.dexName}</td>
                              <td className="py-2.5 px-3 font-mono">
                                {t.inputToken.amount.toFixed(4)} {t.inputToken.symbol} →{' '}
                                <span className="text-[#387B60] font-semibold">
                                  {t.outputToken.amount.toFixed(4)} {t.outputToken.symbol}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono">
                                <AddressDisplay address={t.signerWallet} chars={4} />
                              </td>
                              <td className="py-2.5 px-3">
                                <Badge variant={t.isOwnerVerified ? 'success' : 'neutral'}>
                                  {t.isOwnerVerified ? 'Verified Owner' : 'Observed'}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <a
                                  href={getSolscanTxUrl(t.signature)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#BA6249] hover:underline"
                                >
                                  Solscan ↗
                                </a>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: SHARED WATCHLIST */}
          {roomTab === 'watchlist' && (
            <div className="space-y-4">
              <form
                onSubmit={handleAddWatchlistToken}
                className="p-3 bg-white border border-[#DEDCD5] rounded-lg space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <Input
                    placeholder="Token Mint Address..."
                    value={wlMint}
                    onChange={e => setWlMint(e.target.value)}
                    className="font-mono text-xs"
                    required
                  />
                  <Input
                    placeholder="Symbol (e.g. JUP)"
                    value={wlSymbol}
                    onChange={e => setWlSymbol(e.target.value)}
                    className="text-xs"
                  />
                  <Input
                    placeholder="Target Price USD ($)"
                    type="number"
                    step="any"
                    value={wlTarget}
                    onChange={e => setWlTarget(e.target.value)}
                    className="text-xs"
                  />
                  <Button type="submit" size="sm" variant="primary">
                    <Plus size={13} />
                    <span>Add to Room Watchlist</span>
                  </Button>
                </div>
                {wlError && <p className="text-xs text-[#BA6249]">{wlError}</p>}
              </form>

              <div className="overflow-x-auto border border-[#DEDCD5] rounded-lg bg-white">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F8F7F4] border-b border-[#DAD8D1] text-[#7D8A89]">
                    <tr>
                      <th className="py-2.5 px-3">Asset</th>
                      <th className="py-2.5 px-3">Mint Address</th>
                      <th className="py-2.5 px-3">Target Price</th>
                      <th className="py-2.5 px-3">Added By</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DAD8D1]">
                    {activeWatchlist.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[#7D8A89]">
                          No tokens in shared room watchlist yet.
                        </td>
                      </tr>
                    ) : (
                      activeWatchlist.map(t => (
                        <tr key={t.id} className="hover:bg-[#FAF8F5]">
                          <td className="py-2.5 px-3 font-semibold text-[#1B2428]">{t.symbol}</td>
                          <td className="py-2.5 px-3 font-mono">
                            <AddressDisplay address={t.mint} chars={4} />
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            {t.targetPrice ? `$${t.targetPrice.toFixed(4)}` : '—'}
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <AddressDisplay address={t.addedByAddress} chars={3} />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => removeWatchlistToken(activeRoom.id, t.mint)}
                              className="p-1 rounded text-[#7D8A89] hover:text-[#BA6249]"
                              title="Remove token"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: MEMBERS & ACCESS CONTROL */}
          {roomTab === 'members' && (
            <div className="space-y-4">
              <div className="overflow-x-auto border border-[#DEDCD5] rounded-lg bg-white">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F8F7F4] border-b border-[#DAD8D1] text-[#7D8A89]">
                    <tr>
                      <th className="py-2.5 px-3">Member</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Joined</th>
                      {activeRoom.currentUserRole === 'admin' && (
                        <th className="py-2.5 px-3 text-right">Admin Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DAD8D1]">
                    {activeMembers.map((m, idx) => (
                      <tr key={idx} className="hover:bg-[#FAF8F5]">
                        <td className="py-2.5 px-3 font-mono font-semibold text-[#1B2428]">
                          {m.displayName}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant={m.role === 'admin' ? 'info' : 'neutral'}>
                            {m.role}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-[#7D8A89]">
                          {formatTimeAgo(m.joinedAt / 1000)}
                        </td>
                        {activeRoom.currentUserRole === 'admin' && (
                          <td className="py-2.5 px-3 text-right">
                            {m.walletAddress !== userAddress && (
                              <button
                                onClick={() => removeMember(activeRoom.id, m.walletAddress)}
                                className="p-1 rounded text-[#7D8A89] hover:text-[#BA6249]"
                                title="Remove member from room"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE ROOM MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-md bg-white border border-[#DEDCD5] rounded-lg shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[#DAD8D1] bg-[#F8F7F4]">
              <h3 className="text-sm font-semibold text-[#1B2428]">Create New Alpha Desk</h3>
              <p className="text-xs text-[#7D8A89]">Private collaborative workspace for verified Solana intelligence</p>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#1B2428] mb-1">Room Name</label>
                <Input
                  value={newRoomName}
                  onChange={e => setNewRoomName(e.target.value)}
                  placeholder="e.g. Orca Whirlpool Arbitrage"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2428] mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newRoomDesc}
                  onChange={e => setNewRoomDesc(e.target.value)}
                  placeholder="Desk research focus, strategy, or objectives..."
                  className="w-full p-2 text-xs bg-white border border-[#DEDCD5] rounded focus:outline-none focus:border-[#1B2428]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2428] mb-1">Tags (comma-separated)</label>
                <Input
                  value={newRoomTags}
                  onChange={e => setNewRoomTags(e.target.value)}
                  placeholder="e.g. DeFi, Raydium, Whales"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="privateCheck"
                  checked={newRoomPrivate}
                  onChange={e => setNewRoomPrivate(e.target.checked)}
                  className="rounded border-[#DEDCD5]"
                />
                <label htmlFor="privateCheck" className="text-xs text-[#1B2428]">
                  Require invite code to join (Private Room)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#DAD8D1]">
                <Button type="button" size="sm" variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" variant="primary">
                  Create Room
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN ROOM MODAL */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-sm bg-white border border-[#DEDCD5] rounded-lg shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[#DAD8D1] bg-[#F8F7F4]">
              <h3 className="text-sm font-semibold text-[#1B2428]">Join via Invite Code</h3>
              <p className="text-xs text-[#7D8A89]">Enter room access key provided by desk admin</p>
            </div>

            <form onSubmit={handleJoinSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#1B2428] mb-1">Invite Code</label>
                <Input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  placeholder="e.g. JUP-ALPHA-2026"
                  className="font-mono text-xs uppercase"
                  required
                />
              </div>

              {joinError && <p className="text-xs text-[#BA6249]">{joinError}</p>}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#DAD8D1]">
                <Button type="button" size="sm" variant="outline" onClick={() => setShowJoinModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" variant="primary">
                  Join Room
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VERIFY & SHARE TRADE MODAL */}
      {activeRoom && (
        <TradeShareModal
          isOpen={showShareTradeModal}
          onClose={() => setShowShareTradeModal(false)}
          roomId={activeRoom.id}
          onTradeShared={handleTradeShared}
        />
      )}
    </div>
  );
}
