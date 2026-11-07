import path from 'node:path';
import type { NextConfig } from 'next';

// Env: apps/web/.env is a symlink to the repo-root .env (shared with worker + drizzle-kit).

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ['@sponsors/db', '@sponsors/email'],
  serverExternalPackages: ['postgres'],
  turbopack: {
    root: path.resolve(__dirname, '../..'),
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
