import { NextRequest, NextResponse } from 'next/server';
import { verifyWalletSignature, createSessionToken } from '@/lib/auth/siws';
import { isValidSolanaAddress } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, message, signature, nonce, challengeToken: bodyChallengeToken } = body;

    if (!address || !isValidSolanaAddress(address)) {
      return NextResponse.json({ error: 'Valid Solana address required' }, { status: 400 });
    }

    if (!message || !signature || !nonce) {
      return NextResponse.json(
        { error: 'Address, message, signature, and nonce are required' },
        { status: 400 }
      );
    }

    // Read challengeToken from cookie or request body
    const cookieChallengeToken = request.cookies.get('tradesync_challenge')?.value;
    const challengeToken = cookieChallengeToken || bodyChallengeToken;

    let signatureHex = signature;
    if (typeof signature === 'string' && /^[0-9a-fA-F]+$/.test(signature)) {
      signatureHex = signature;
    } else if (Array.isArray(signature)) {
      signatureHex = Buffer.from(signature).toString('hex');
    }

    const isValid = verifyWalletSignature(address, message, signatureHex, nonce, challengeToken);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid cryptographic signature. Ownership verification failed.' },
        { status: 401 }
      );
    }

    const token = createSessionToken(address);

    const response = NextResponse.json({
      success: true,
      walletAddress: address,
      authenticated: true,
      message: 'Wallet authenticated successfully',
    });

    // Invalidate the challenge cookie immediately
    response.cookies.set('tradesync_challenge', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    // Issue the secure session cookie
    response.cookies.set('tradesync_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication verification failed';
    const isSecurityViolation = message.includes('Replay') || message.includes('expired') || message.includes('mismatch') || message.includes('invalid');
    return NextResponse.json(
      { error: message },
      { status: isSecurityViolation ? 400 : 500 }
    );
  }
}
