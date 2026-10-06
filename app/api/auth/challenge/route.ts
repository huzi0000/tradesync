import { NextRequest, NextResponse } from 'next/server';
import { createAuthChallenge } from '@/lib/auth/siws';
import { isValidSolanaAddress } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address } = body;

    if (!address || !isValidSolanaAddress(address)) {
      return NextResponse.json(
        { error: 'Valid Solana wallet address is required' },
        { status: 400 }
      );
    }

    const host = request.headers.get('host') || 'tradesync.app';
    const challenge = createAuthChallenge(address, host);

    const response = NextResponse.json(challenge);

    // Set secure challenge cookie for serverless replay defense
    response.cookies.set('tradesync_challenge', challenge.challengeToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 5 * 60, // 5 minutes
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate challenge' },
      { status: 500 }
    );
  }
}
