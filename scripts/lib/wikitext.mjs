// Minimal wikitext helpers for reading "Infobox film" fields (gross, budget, starring)
// and turning money text like "₹1,642–1,800 crore" or "$2.923 billion" into numbers.

const CURRENCY_TEMPLATES = {
  inr: '₹', 'indian rupee': '₹', '₹': '₹', rupee: '₹',
  'us$': '$', usd: '$', 'us dollar': '$',
  gbp: '£', '£': '£', eur: '€', '€': '€',
  jpy: 'JP¥', yen: 'JP¥', cny: 'CN¥', rmb: 'CN¥', 'cn¥': 'CN¥',
  krw: '₩', '₩': '₩', hkd: 'HK$', aud: 'A$', cad: 'CA$', nzd: 'NZ$',
  twd: 'NT$', sgd: 'S$', brl: 'R$', rub: '₽', thb: '฿', try: '₺', php: '₱', mxn: 'MX$',
  idr: 'Rp', myr: 'RM', chf: 'CHF', ngn: '₦', pkr: 'PKR', bdt: 'BDT', lkr: 'LKR', npr: 'NPR',
};

const LIST_TEMPLATES = new Set([
  'plainlist', 'plain list', 'ubl', 'unbulleted list', 'hlist', 'flatlist', 'flat list',
  'bulleted list', 'bulletedlist', 'nowrap', 'nobr', 'small', 'big', 'nowrap begin', 'endplainlist',
  'nobold', 'abbr', 'lang', 'transl', 'tooltip', 'avoid wrap',
]);

const INR_CONVERT_UNITS = { c: 'crore', l: 'lakh', b: 'billion', m: 'million', k: 'thousand', t: 'trillion' };

function positionalArgs(parts) {
  return parts.filter((p) => !/^\s*[\w -]+\s*=/.test(p)).map((p) => p.trim());
}

function renderTemplate(inner) {
  const parts = inner.split('|');
  const name = parts[0].trim().toLowerCase().replace(/_/g, ' ');
  const args = positionalArgs(parts.slice(1));

  if (name === 'inrconvert') {
    const unit = INR_CONVERT_UNITS[(args[1] || '').toLowerCase()] || '';
    return `₹${args[0] || ''} ${unit}`;
  }
  if (name === 'currency') {
    const sym = CURRENCY_TEMPLATES[(args[1] || 'usd').toLowerCase()] || '$';
    return `${sym}${args[0] || ''}`;
  }
  if (name in CURRENCY_TEMPLATES) return `${CURRENCY_TEMPLATES[name]}${args[0] || ''}`;
  if (LIST_TEMPLATES.has(name)) return args.join('\n');
  if (['nbsp', 'nbs', 'spaces', 'sp'].includes(name)) return ' ';
  if (['ndash', 'en dash', '–'].includes(name)) return '–';
  if (['mdash', 'em dash'].includes(name)) return '—';
  if (['estimation', 'est', 'est.', 'circa', 'c.', 'approx', 'approximately'].includes(name)) return 'est. ';
  if (name === 'abbr' || name === 'lang') return args[0] || '';
  return ''; // efn, sfn, cite…, citation needed, increase, etc.
}

/** Strip refs, comments, links and templates, leaving readable plain text. */
export function cleanWikitext(text) {
  if (!text) return '';
  let s = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>/]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '')
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/\[https?:\/\/\S+\s([^\]]*)\]/g, '$1');

  // Resolve templates from the innermost outwards.
  for (let i = 0; i < 20 && s.includes('{{'); i++) {
    const next = s.replace(/\{\{([^{}]*)\}\}/g, (_, inner) => renderTemplate(inner));
    if (next === s) break;
    s = next;
  }

  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&ndash;|&#8211;/g, '–')
    .replace(/&mdash;|&#8212;/g, '—')
    .replace(/&#x20B9;|&#8377;/gi, '₹')
    .replace(/&amp;/g, '&')
    .replace(/'''?/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/^[ \t]*\*+[ \t]*/gm, '')
    .trim();
}

/** Return the raw wikitext value of an infobox parameter, e.g. getInfoboxField(text, 'gross'). */
export function getInfoboxField(wikitext, field) {
  if (!wikitext) return null;
  const re = new RegExp(`(?:^|\\n|\\|)\\s*\\|?\\s*${field}\\s*=`, 'i');
  const m = re.exec(wikitext);
  if (!m) return null;
  let i = m.index + m[0].length;
  let braces = 0;
  let brackets = 0;
  let out = '';
  while (i < wikitext.length) {
    const two = wikitext.slice(i, i + 2);
    if (two === '{{') { braces++; out += two; i += 2; continue; }
    if (two === '}}') {
      if (braces === 0) break; // end of the infobox itself
      braces--; out += two; i += 2; continue;
    }
    if (two === '[[') { brackets++; out += two; i += 2; continue; }
    if (two === ']]') { brackets = Math.max(0, brackets - 1); out += two; i += 2; continue; }
    const ch = wikitext[i];
    if (braces === 0 && brackets === 0) {
      if (ch === '|') break;
      if (ch === '\n' && /^\n\s*(\||\}\})/.test(wikitext.slice(i, i + 40))) break;
    }
    out += ch;
    i++;
  }
  return out.trim() || null;
}

// Longest symbols first so "US$" wins over "$" and "CN¥" over "¥".
const CURRENCY_SYMBOLS = [
  ['US$', 'USD'], ['USD', 'USD'], ['CA$', 'CAD'], ['C$', 'CAD'], ['AU$', 'AUD'], ['A$', 'AUD'],
  ['NZ$', 'NZD'], ['HK$', 'HKD'], ['NT$', 'TWD'], ['S$', 'SGD'], ['R$', 'BRL'], ['MX$', 'MXN'],
  ['CN¥', 'CNY'], ['RMB', 'CNY'], ['CNY', 'CNY'], ['JP¥', 'JPY'], ['JPY', 'JPY'],
  ['INR', 'INR'], ['Rs.', 'INR'], ['Rs', 'INR'], ['₹', 'INR'],
  ['GBP', 'GBP'], ['£', 'GBP'], ['EUR', 'EUR'], ['€', 'EUR'], ['KRW', 'KRW'], ['₩', 'KRW'],
  ['RUB', 'RUB'], ['₽', 'RUB'], ['฿', 'THB'], ['₺', 'TRY'], ['₱', 'PHP'], ['Rp', 'IDR'],
  ['RM', 'MYR'], ['CHF', 'CHF'], ['₦', 'NGN'], ['PKR', 'PKR'], ['BDT', 'BDT'], ['৳', 'BDT'],
  ['LKR', 'LKR'], ['NPR', 'NPR'], ['¥', 'JPY'], ['$', 'USD'],
];

const SCALES = {
  thousand: 1e3, k: 1e3, lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5,
  million: 1e6, mn: 1e6, m: 1e6, crore: 1e7, crores: 1e7, cr: 1e7,
  billion: 1e9, bn: 1e9, b: 1e9, arab: 1e9, trillion: 1e12,
};

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SYMBOL_RE = CURRENCY_SYMBOLS.map(([s]) => escape(s)).join('|');
const NUM = '(\\d[\\d,]*(?:\\.\\d+)?)';
const SCALE_RE = '(thousand|lakhs?|lacs?|million|mn|crores?|cr|billion|bn|arab|trillion|k|m|b)\\b\\.?';
const MONEY_RE = new RegExp(
  `(?<![A-Za-z])(${SYMBOL_RE})\\s*${NUM}(?:\\s*${SCALE_RE})?` +
    `(?:\\s*(?:–|-|—|to)\\s*(?:${SYMBOL_RE})?\\s*${NUM}(?:\\s*${SCALE_RE})?)?`,
  'gi'
);
const SUFFIX_RE = new RegExp(
  `${NUM}(?:\\s*(?:–|-|—|to)\\s*${NUM})?\\s*${SCALE_RE}?\\s*(rupees|yuan|won|yen|euros|pounds|dollars)\\b`,
  'gi'
);
const SUFFIX_CURRENCY = { rupees: 'INR', yuan: 'CNY', won: 'KRW', yen: 'JPY', euros: 'EUR', pounds: 'GBP', dollars: 'USD' };

const toNumber = (n) => Number(String(n).replace(/,/g, ''));

/**
 * Parse money text. Returns { currency, low, high, approx } (full units, e.g. 1.05e10 for
 * "₹1,050 crore") or null. When the text lists several amounts in the same currency
 * (India vs worldwide, etc.) the largest one wins; amounts in other currencies are ignored
 * because they are usually conversions in brackets.
 */
export function parseMoney(text) {
  if (!text) return null;
  const s = text.replace(/ /g, ' ').replace(/(\d)\s*\+/g, '$1');
  const approx = /\best\.|estimat|approx|\bc\.\s|~|≈|\bover\b|\babove\b|\bmore than\b/i.test(s);
  const found = [];

  for (const m of s.matchAll(MONEY_RE)) {
    const [, sym, n1, sc1, n2, sc2] = m;
    const currency = CURRENCY_SYMBOLS.find(([k]) => k.toLowerCase() === sym.toLowerCase())[1];
    const scaleHigh = SCALES[(sc2 || sc1 || '').toLowerCase()] || 1;
    const scaleLow = SCALES[(sc1 || sc2 || '').toLowerCase()] || 1;
    const low = toNumber(n1) * scaleLow;
    const high = n2 ? toNumber(n2) * scaleHigh : low;
    if (!Number.isFinite(low) || low <= 0) continue;
    found.push({ currency, low: Math.min(low, high), high: Math.max(low, high), index: m.index });
  }
  for (const m of s.matchAll(SUFFIX_RE)) {
    const [, n1, n2, sc, word] = m;
    const scale = SCALES[(sc || '').toLowerCase()] || 1;
    const low = toNumber(n1) * scale;
    const high = n2 ? toNumber(n2) * scale : low;
    if (!Number.isFinite(low) || low <= 0) continue;
    found.push({ currency: SUFFIX_CURRENCY[word.toLowerCase()], low, high, index: m.index });
  }
  if (!found.length) return null;

  found.sort((a, b) => a.index - b.index);
  const currency = found[0].currency;
  const best = found
    .filter((f) => f.currency === currency)
    .reduce((a, b) => (b.low > a.low ? b : a));
  return { currency, low: best.low, high: best.high, approx };
}

/** Split an infobox list (starring, language…) into clean names. */
export function parseList(text, max = 8) {
  return cleanWikitext(text || '')
    .split(/\n|,|;|•|·/)
    .map((x) => x.replace(/\(.*?\)/g, '').trim())
    .filter((x) => x && x.length < 60 && !/^and$/i.test(x))
    .slice(0, max);
}
