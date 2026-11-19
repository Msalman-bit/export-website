import type { NextConfig } from 'next';
import os from 'node:os';

// Security headers that do not depend on the request. The Content-Security-Policy carries a fresh
// nonce on every request, so it is set in src/proxy.ts instead.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
];

// This computer's own network addresses (for example 192.168.1.20). The dev server (npm run dev) serves its files only
// to localhost unless the host is listed here, so a phone on the same Wi-Fi can open http://<address>:3000 to look at
// the site. Development only: Next.js ignores this setting in production.
const lanAddresses = Object.values(os.networkInterfaces()).flat()
  .filter((a): a is os.NetworkInterfaceInfo => !!a && a.family === 'IPv4' && !a.internal)
  .map((a) => a.address);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: lanAddresses,
  reactStrictMode: true,
  // One self-contained server folder (.next/standalone) with only the dependencies it uses;
  // scripts/package-deploy.mjs adds the static files, public/ and the migrations to it.
  output: 'standalone',
  // PGlite loads its WebAssembly files from its own package folder: keep it out of the server bundle.
  serverExternalPackages: ['@electric-sql/pglite', 'pg'],
  // files read from disk at runtime, which the dependency tracing cannot see
  outputFileTracingIncludes: {
    '/**': ['./node_modules/@electric-sql/pglite/dist/**/*', './drizzle/**/*'],
  },
  experimental: {
    serverActions: { bodySizeLimit: '12mb' },
  },
  // Render's free build machine has too little memory for the type check (SKIP_BUILD_TYPECHECK=1 in render.yaml).
  // It changes nothing in the site: the types are still checked here (npm run typecheck, the tests) and in every
  // other build, the Hostinger package included.
  typescript: { ignoreBuildErrors: process.env.SKIP_BUILD_TYPECHECK === '1' },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        source: '/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }],
      },
    ];
  },
};

export default nextConfig;
