// Site settings, all optional, set as GitHub Actions variables (or in the shell for a local build).
// Read at build time only.

const siteUrl = (process.env.SITE_URL || 'https://collection-board.pages.dev').replace(/\/$/, '');
const host = new URL(siteUrl).hostname;

export const SITE = {
  name: process.env.SITE_NAME || 'Collection Board',
  url: siteUrl,
  host,
  onPagesDev: host.endsWith('.pages.dev'),
  /** Who runs the site (a person's or business's name), shown on the about page and as the guides' author. */
  owner: process.env.SITE_OWNER?.trim().slice(0, 80) || null,
};

/** Google Analytics 4 measurement ID, e.g. G-ABC123XYZ. Left out entirely when not set. */
export const GA_ID = /^G-[A-Z0-9]{4,20}$/.test(process.env.GA_ID || '') ? process.env.GA_ID! : null;

/**
 * Google AdSense publisher ID, e.g. ca-pub-1234567890123456. When set, every page loads the AdSense tag
 * (site verification and Auto ads), /ads.txt is published, and the privacy policy and terms describe ads.
 */
export const ADSENSE_CLIENT = /^ca-pub-\d{16}$/.test(process.env.ADSENSE_CLIENT?.trim() || '') ? process.env.ADSENSE_CLIENT!.trim() : null;

/** Optional AdSense display ad unit ID (10 digits). When set with ADSENSE_CLIENT, pages get fixed ad slots. */
export const ADSENSE_SLOT = ADSENSE_CLIENT && /^\d{10}$/.test(process.env.ADSENSE_SLOT?.trim() || '') ? process.env.ADSENSE_SLOT!.trim() : null;

/** Contact address. Defaults to contact@your-domain once a custom domain is set (Cloudflare Email Routing). */
export const CONTACT_EMAIL = [process.env.CONTACT_EMAIL, SITE.onPagesDev ? null : `contact@${host.replace(/^www\./, '')}`]
  .find((e): e is string => Boolean(e) && /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(e!)) || null;

