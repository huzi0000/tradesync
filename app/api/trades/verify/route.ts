import { NextRequest, NextResponse } from 'next/server';
import { verifyTransaction } from '@/lib/solana/connection';
import { verifySessionToken } from '@/lib/auth/siws';
import { isValidTransactionSignature } from '@/lib/utils';
import { VerifiedTradeRecord } from '@/types';

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
        symbol: verification.inputToken?.symbol || 'INPUT',
        amount: verification.inputToken?.amount || 0,
        decimals: verification.inputToken?.decimals || 9,
      },
      outputToken: {
        mint: verification.outputToken?.mint || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        symbol: verification.outputToken?.symbol || 'OUTPUT',
        amount: verification.outputToken?.amount || 0,
        decimals: verification.outputToken?.decimals || 6,
      },
      signerWallet: primarySigner,
      isOwnerVerified,
      submittedByAddress: authenticatedAddress || primarySigner,
      submittedAt: Date.now(),
    };

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
