import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { SolanaWalletProvider } from '../components/layout/WalletProvider';
import { AppShell } from '../components/layout/AppShell';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'TradeSync — Solana Trading Intelligence',
  description:
    'A collaborative, Mainnet-first Solana trading intelligence platform for traders and private communities.',
  icons: { icon: '/favicon.ico' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full`}
    >
      <body className="h-full antialiased">
        <SolanaWalletProvider>
          <AppShell>{children}</AppShell>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
