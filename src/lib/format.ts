// Formatting helpers shared by the pages, the browser components and scripts/merge.mjs
// (Node runs this file directly, so it must stay free of imports and non-erasable TypeScript).

export type Lang = 'en' | 'hi';
export type Currency = 'INR' | 'USD';

export function slugify(text: unknown): string {
  return String(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// Money units per page language. Digits stay Western (1,234) in Hindi too, as Hindi news sites write them.
export const UNITS = {
  en: { cr: ' cr', lakh: ' lakh', B: 'B', M: 'M', K: 'K' },
  hi: { cr: ' करोड़', lakh: ' लाख', B: ' अरब', M: ' मिलियन', K: ' हज़ार' },
} as const;

export function formatINR(n: number, lang: Lang = 'en'): string {
  const u = UNITS[lang] || UNITS.en;
  if (n >= 1e7) {
    const c = n / 1e7;
    const digits = c >= 1000 ? 0 : c >= 10 ? 1 : 2;
    return `₹${c.toLocaleString('en-IN', { maximumFractionDigits: digits })}${u.cr}`;
  }
  if (n >= 1e5) return `₹${(n / 1e5).toLocaleString('en-IN', { maximumFractionDigits: 1 })}${u.lakh}`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function formatUSD(n: number, lang: Lang = 'en'): string {
  const u = UNITS[lang] || UNITS.en;
  if (n >= 1e9) return `$${(n / 1e9).toLocaleString('en-US', { maximumFractionDigits: 2 })}${u.B}`;
  if (n >= 1e6) {
    const m = n / 1e6;
    return `$${m.toLocaleString('en-US', { maximumFractionDigits: m >= 100 ? 1 : 2 })}${u.M}`;
  }
  if (n >= 1e3) return `$${Math.round(n / 1e3).toLocaleString('en-US')}${u.K}`;
  return `$${Math.round(n)}`;
}

/** Compact amount in one currency: ₹1,495.6 cr or $160.53M. */
export function formatMoney(m: { usd: number; inr: number }, currency: Currency, lang: Lang = 'en'): string {
  return currency === 'INR' ? formatINR(m.inr, lang) : formatUSD(m.usd, lang);
}

/** Two decimals, the way running collections are reported: ₹1,495.62 cr, $160.12M. */
export function formatFine(currency: Currency, usd: number, inr: number, lang: Lang = 'en'): string {
  const u = UNITS[lang] || UNITS.en;
  if (currency === 'INR') {
    const opts = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    if (inr >= 1e7) return `₹${(inr / 1e7).toLocaleString('en-IN', opts)}${u.cr}`;
    return `₹${(inr / 1e5).toLocaleString('en-IN', opts)}${u.lakh}`;
  }
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(3)}${u.B}`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)}${u.M}`;
  return `$${Math.round(usd / 1e3).toLocaleString('en-US')}${u.K}`;
}

/** Splits a live total for the film page's headline figure: ₹1,497.8512 cr → ["₹", "1,497", ".8512", "cr"]. */
export function splitFigure(currency: Currency, usd: number, inr: number, lang: Lang = 'en'): [string, string, string, string] {
  const u = UNITS[lang] || UNITS.en;
  let value: number;
  let unit: string;
  if (currency === 'INR') [value, unit] = inr >= 1e7 ? [inr / 1e7, u.cr] : [inr / 1e5, u.lakh];
  else [value, unit] = usd >= 1e9 ? [usd / 1e9, u.B] : [usd / 1e6, u.M];
  const [int, dec] = value.toFixed(4).split('.');
  const grouped = Number(int).toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US');
  return [currency === 'INR' ? '₹' : '$', grouped, `.${dec}`, unit.trim()];
}

/** Escapes text for the HTML strings in src/content (article, FAQ and legal pages). */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
export function countryName(code: string): string {
  try {
    return regionNames.of(code) || code;
  } catch {
    return code;
  }
}

/** Wikidata stores year-only dates as YYYY-01-01, so those show as just the year. */
export function formatDate(iso: string | null | undefined, lang: Lang = 'en'): string | null {
  if (!iso) return null;
  if (iso.endsWith('-01-01')) return iso.slice(0, 4);
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

export function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function joinNames(list: string[], lang: Lang = 'en'): string {
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} ${lang === 'hi' ? 'और' : 'and'} ${list.at(-1)}`;
}

export function formatCount(n: number): string {
  return Number(n).toLocaleString('en-IN');
}

// Language names in Hindi, from the runtime's own locale data, for the /hi/ language pages.
const HINDI_LANGUAGE_FIX: Record<string, string> = {
  Hindi: 'हिंदी', Mandarin: 'मंदारिन', Bengali: 'बांग्ला', Tagalog: 'तागालोग', 'Egyptian Arabic': 'मिस्री अरबी',
  Kannada: 'कन्नड़', Marathi: 'मराठी', Punjabi: 'पंजाबी', Gujarati: 'गुजराती', Odia: 'ओड़िया',
  Bhojpuri: 'भोजपुरी', Assamese: 'असमिया', Silent: 'मूक फ़िल्म',
};
let languageCodes: Map<string, string> | null = null;
export function hindiLanguageName(name: string): string {
  if (HINDI_LANGUAGE_FIX[name]) return HINDI_LANGUAGE_FIX[name];
  if (!languageCodes) {
    languageCodes = new Map();
    const en = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' });
    const az = 'abcdefghijklmnopqrstuvwxyz';
    for (const a of az) for (const b of az) {
      const n = en.of(a + b);
      if (n && !languageCodes.has(n)) languageCodes.set(n, a + b);
    }
  }
  const code = languageCodes.get(name);
  if (!code) return name;
  return new Intl.DisplayNames(['hi'], { type: 'language', fallback: 'none' }).of(code) || name;
}
