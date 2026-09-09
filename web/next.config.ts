import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

// Static export for GitHub Pages (spec §2).
// basePath is "" for the custom domain (pubs.nbdc-datahub.org) and local dev; it would be
// "/nbdc-publications" only if the site went back to being a project page under another domain.
// Keep this in sync with web/lib/base-path.ts (both read NEXT_PUBLIC_BASE_PATH).
// trailingSlash so routes export as directory/index.html (clean URLs on Pages).
// images.unoptimized because Pages has no image optimization server.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  // Pin file tracing to web/ (the repo also has a root lockfile for tooling).
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),
};

export default nextConfig;
