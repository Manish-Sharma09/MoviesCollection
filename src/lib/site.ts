// Site settings, all optional, set as GitHub Actions variables (or in the shell for a local build).
// Read at build time only.

const siteUrl = (process.env.SITE_URL || 'https://collection-board.pages.dev').replace(/\/$/, '');
const host = new URL(siteUrl).hostname;

export const SITE = {
  name: process.env.SITE_NAME || 'Collection Board',
  url: siteUrl,
  host,
  onPagesDev: host.endsWith('.pages.dev'),
};

/** Google Analytics 4 measurement ID, e.g. G-ABC123XYZ. Left out entirely when not set. */
export const GA_ID = /^G-[A-Z0-9]{4,20}$/.test(process.env.GA_ID || '') ? process.env.GA_ID! : null;

/** Contact address. Defaults to contact@your-domain once a custom domain is set (Cloudflare Email Routing). */
export const CONTACT_EMAIL = [process.env.CONTACT_EMAIL, SITE.onPagesDev ? null : `contact@${host.replace(/^www\./, '')}`]
  .find((e): e is string => Boolean(e) && /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(e!)) || null;

