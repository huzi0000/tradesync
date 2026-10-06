import { NextRequest, NextResponse } from 'next/server';
import { verifyTransaction } from '@/lib/solana/connection';
import { verifySessionToken } from '@/lib/auth/siws';
import { isValidTransactionSignature } from '@/lib/utils';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { VerifiedTradeRecord } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('tradesync_session')?.value;
    const session = sessionCookie ? verifySessionToken(sessionCookie) : null;
    const authenticatedAddress = session?.walletAddress;

    const body = await request.json();
    const { signature, roomId } = body;

    if (!signature || !isValidTransactionSignature(signature)) {
      return NextResponse.json(
        { error: 'Valid Solana transaction signature (87-88 characters base58) is required.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    let userProfileId: string | null = null;

    if (supabase && authenticatedAddress) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('wallet_address', authenticatedAddress)
        .single();
      userProfileId = profile?.id || null;
    }

    // If submitting to a specific room, enforce room membership check
    if (roomId && supabase) {
      if (!session || !authenticatedAddress || !userProfileId) {
        return NextResponse.json(
          { error: 'Cryptographic authentication required to link trade to a room.' },
          { status: 401 }
        );
      }

      const { data: membership } = await supabase
        .from('room_members')
        .select('role')
        .eq('room_id', roomId)
        .eq('user_id', userProfileId)
        .single();

      const { data: room } = await supabase
        .from('trading_rooms')
        .select('created_by')
        .eq('id', roomId)
        .single();

      if (!membership && room?.created_by !== userProfileId) {
        return NextResponse.json(
          { error: 'Access denied: submitter must be an active member of this room.' },
          { status: 403 }
        );
      }
    }

    // Cryptographically verify the transaction against Solana Mainnet Beta RPC
    const verification = await verifyTransaction(signature, authenticatedAddress || undefined);

    if (!verification.valid) {
      return NextResponse.json(
        {
          valid: false,
          status: verification.status,
          error: verification.error || 'Transaction could not be verified on Solana Mainnet Beta.',
        },
        { status: 400 }
      );
    }

    const signers = verification.wallets || [];
    const isOwnerVerified = !!(authenticatedAddress && signers.includes(authenticatedAddress));
    const primarySigner = signers[0] || 'Unknown';

    const tradeRecord: VerifiedTradeRecord = {
      id: `trade-${Date.now()}-${signature.slice(0, 8)}`,
      roomId: roomId || undefined,
      signature: verification.signature,
      slot: verification.slot || 0,
      blockTime: verification.blockTime || null,
      dexName: verification.programId || 'Solana DEX Aggregator',
      inputToken: {
        mint: verification.inputToken?.mint || 'So11111111111111111111111111111111111111112',
        symbol: verification.inputToken?.symbol || 'SOL',
        amount: verification.inputToken?.amount || 0,
        decimals: verification.inputToken?.decimals || 9,
      },
      outputToken: {
        mint: verification.outputToken?.mint || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        symbol: verification.outputToken?.symbol || 'USDC',
        amount: verification.outputToken?.amount || 0,
        decimals: verification.outputToken?.decimals || 6,
      },
      signerWallet: primarySigner,
      isOwnerVerified,
      submittedByAddress: authenticatedAddress || primarySigner,
      submittedAt: Date.now(),
    };

    // If Supabase is connected and user profile exists, persist the verified record securely via service role
    if (supabase && userProfileId) {
      await supabase.from('verified_trade_records').upsert(
        {
          room_id: roomId || null,
          submitted_by: userProfileId,
          signature: verification.signature,
          slot: verification.slot || 0,
          block_time: verification.blockTime ? new Date(verification.blockTime * 1000).toISOString() : null,
          dex_name: verification.programId || 'Solana DEX Aggregator',
          input_mint: tradeRecord.inputToken.mint,
          input_symbol: tradeRecord.inputToken.symbol,
          input_amount: tradeRecord.inputToken.amount,
          output_mint: tradeRecord.outputToken.mint,
          output_symbol: tradeRecord.outputToken.symbol,
          output_amount: tradeRecord.outputToken.amount,
          signer_wallet: primarySigner,
          is_owner_verified: isOwnerVerified,
          metadata: {
            fee: verification.fee,
            verifiedAt: new Date().toISOString(),
          },
        },
        { onConflict: 'room_id,signature' }
      );
    }

    return NextResponse.json({
      valid: true,
      tradeRecord,
      ownershipNotice: isOwnerVerified
        ? 'Verified Owned Trade: Confirmed executed by your authenticated wallet.'
        : 'Observed Third-Party Trade: Public on-chain execution verified. Wallet ownership not proven.',
      safetyDisclaimer:
        'Verification confirms on-chain execution only. Does not imply trade profitability, financial endorsement, or protocol safety.',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Trade verification failed' },
      { status: 500 }
    );
  }
}
