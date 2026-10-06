import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Transpile Solana wallet adapter packages (they use ESM)
  transpilePackages: [
    '@solana/wallet-adapter-base',
    '@solana/wallet-adapter-react',
    '@solana/wallet-adapter-react-ui',
  ],
  // Allow images from DexScreener for token logos
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'dd.dexscreener.com' },
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
    ],
  },
};

export default nextConfig;
