import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth/siws';

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get('tradesync_session')?.value;

  if (!sessionCookie) {
    return NextResponse.json({ authenticated: false, walletAddress: null, userId: null });
  }

  const session = verifySessionToken(sessionCookie);
  if (!session) {
    const res = NextResponse.json({ authenticated: false, walletAddress: null, userId: null });
    res.cookies.delete('tradesync_session');
    return res;
  }

  return NextResponse.json(session);
}
