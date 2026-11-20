import type { NextConfig } from 'next';
import { hostname, networkInterfaces } from 'node:os';

// `next dev` only serves its scripts and live reload to localhost. To open the dev site from another
// device on the same network (http://<this machine's address>:3000), that address must be allowed, or
// the page loads without its JavaScript. These are this machine's own addresses, read when the dev
// server starts (restart it if the machine's address changes). Development only.
const ownAddresses = [
  hostname(),
  ...Object.values(networkInterfaces())
    .flatMap((list) => list ?? [])
    .filter((a) => a.family === 'IPv4' && !a.internal)
    .map((a) => a.address),
];

// The site is a static export: `next build` renders every page to HTML in out/, which is uploaded
// to Cloudflare Pages. No server runs in production, so hosting stays free.
//
// Links between pages are plain <a> tags (full page loads), not next/link. That lets
// scripts/postbuild.mjs drop the per-page RSC payload files that client-side navigation would need:
// with them the site would be ~68,000 files, far past Cloudflare Pages' 20,000-file limit.
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  // Every page's HTML contains the build ID. Tying it to the commit (instead of a random ID per build)
  // keeps unchanged pages byte-identical between the 3-hourly rebuilds, so a deploy uploads only the
  // pages whose figures changed. Local builds without GITHUB_SHA get a random ID.
  generateBuildId: async () => process.env.GITHUB_SHA || null,
  allowedDevOrigins: ownAddresses,
};

export default nextConfig;
