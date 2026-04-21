import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  /**
   * `sharp` + `postgres` + `pino` are server-only — mark them so Next.js
   * bundling doesn't try to include them in the client chunk.
   */
  serverExternalPackages: ['sharp', 'postgres', 'pino', 'pino-pretty'],
  // Standalone output generates a minimal runtime bundle for Docker/Railway deploy.
  output: 'standalone',
};

export default config;
