// Runs after `next build`: turns out/ into the site Cloudflare Pages serves.
//
// 1. Error pages: /error-404/, /hi/error-404/ and /error-500/ become 404.html, hi/404.html and 500.html
//    (Next reserves the /404 route for its own bare not-found page, which 404.html replaces). Cloudflare Pages
//    serves the nearest 404.html, so missing /hi/ pages get the Hindi one.
// 2. RSC payloads: Next writes four .txt files per page for client-side navigation. The site links
//    with plain <a> (full page loads), so nothing requests them, and keeping them would put the site
//    at ~68,000 files, past Cloudflare Pages' 20,000-file limit. Every page's HTML has its own inline
//    payload for hydration.
// 3. _headers (Cloudflare Pages) and vercel.json (Vercel): security headers, caching, and noindex for the
//    host's free address once a domain is set.
// 4. ads.txt, naming the site's AdSense account as its only authorised ad seller (when ADSENSE_CLIENT is set).
// 5. Fails the build if the file count is still over the limit.
// 6. Warns about settings AdSense reviewers look for (custom domain, contact address, who runs the site).
import { readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ADSENSE_CLIENT, CONTACT_EMAIL, SITE } from '../src/lib/site.ts';

const OUT = join(process.cwd(), 'out');
const MAX_FILES = 20_000;

// 1. Error pages
for (const [from, to] of [['error-404', '404.html'], ['hi/error-404', 'hi/404.html'], ['error-500', '500.html']]) {
  await rename(join(OUT, from, 'index.html'), join(OUT, to));
  await rm(join(OUT, from), { recursive: true });
}
await rm(join(OUT, '_not-found'), { recursive: true, force: true });
// Next's own bare not-found page (served at /404/); 404.html replaces it.
await rm(join(OUT, '404'), { recursive: true, force: true });

// 2. RSC payloads: index.txt and __next.*.txt next to every page
const isPayload = (name) => name === 'index.txt' || (name.startsWith('__next.') && name.endsWith('.txt'));
let removed = 0;
for (const entry of await readdir(OUT, { recursive: true, withFileTypes: true })) {
  if (entry.isFile() && isPayload(entry.name)) {
    await rm(join(entry.parentPath, entry.name));
    removed++;
  }
}

// 3. Cloudflare Pages headers. Once the site has its own domain, the *.pages.dev copy is kept out of
// search results so Google does not index the same pages twice. Preview deployments never get indexed.
await writeFile(join(OUT, '_headers'), `${SITE.onPagesDev ? '' : `# The real site is ${SITE.url}; keep the pages.dev copy out of search results.
https://:project.pages.dev/*
  X-Robots-Tag: noindex

`}# Preview deployments (one per upload) are never indexed.
https://:version.:project.pages.dev/*
  X-Robots-Tag: noindex

/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: camera=(), microphone=(), geolocation=()

# Scripts, styles and fonts under /_next/static/ have content hashes in their names.
/_next/static/*
  Cache-Control: public, max-age=31536000, immutable

/search.json
  Cache-Control: public, max-age=3600

# Read every few minutes by an open /live/ page; always check for a newer copy.
/live.json
  Cache-Control: no-cache

/favicon.ico
  Cache-Control: public, max-age=604800
/favicon.svg
  Cache-Control: public, max-age=604800
/og-image.png
  Cache-Control: public, max-age=604800
`);

// 3b. The same headers for Vercel, which reads vercel.json from the uploaded folder (and ignores _headers).
// Once the site has its own domain, the *.vercel.app copy is kept out of search results.
const cache = (source, value) => ({ source, headers: [{ key: 'Cache-Control', value }] });
await writeFile(join(OUT, 'vercel.json'), `${JSON.stringify({
  trailingSlash: true,
  headers: [
    ...(SITE.host.endsWith('.vercel.app') ? [] : [{
      source: '/(.*)',
      has: [{ type: 'host', value: '.*\\.vercel\\.app' }],
      headers: [{ key: 'X-Robots-Tag', value: 'noindex' }],
    }]),
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
    cache('/_next/static/(.*)', 'public, max-age=31536000, immutable'),
    cache('/search.json', 'public, max-age=3600'),
    cache('/live.json', 'no-cache'),
    cache('/(favicon\\.ico|favicon\\.svg|og-image\\.png)', 'public, max-age=604800'),
  ],
}, null, 2)}\n`);

// 4. ads.txt (IAB format; f08c47fec0942fa0 is Google's certification authority ID)
if (ADSENSE_CLIENT) {
  await writeFile(join(OUT, 'ads.txt'), `google.com, ${ADSENSE_CLIENT.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`);
}

// 5. File count
const files = (await readdir(OUT, { recursive: true, withFileTypes: true })).filter((e) => e.isFile()).length;
console.log(`Post-build: removed ${removed} RSC payload files; out/ has ${files.toLocaleString('en-US')} files (limit ${MAX_FILES.toLocaleString('en-US')}).`);
if (files > MAX_FILES) {
  console.error(`out/ has more than ${MAX_FILES} files, which Cloudflare Pages will reject.`);
  process.exit(1);
}

// 6. AdSense readiness. Not errors: the site builds either way, but a review is likely to fail without these.
const missing = [
  SITE.onFreeHost && `SITE_URL is a ${SITE.host.replace(/^[^.]+/, '*')} address; AdSense only approves a domain you own.`,
  !CONTACT_EMAIL && 'No contact address: set CONTACT_EMAIL (or a custom domain with Cloudflare Email Routing for contact@).',
  !SITE.owner && 'SITE_OWNER is not set: the about page and guides do not say who runs the site.',
].filter(Boolean);
if (missing.length) console.warn(`AdSense readiness:\n  - ${missing.join('\n  - ')}`);
