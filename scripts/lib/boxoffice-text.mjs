// Reads a film's India and overseas totals from the "Box office" section of its English Wikipedia article.
// Infoboxes give only the worldwide gross; Indian film articles usually also say, in prose or a small table,
// what the film made in India (net and gross) and overseas. This parser is deliberately strict: it only takes
// an amount when the words right around it say which market and which measure it is, skips sentences that
// compare with other films' records, and keeps the largest such amount (running totals only grow, so the
// largest is the latest). src/lib/data.ts then cross-checks every figure against the film's worldwide gross.

const CRORE = 1e7;
const LAKH = 1e5;

/** The "Box office" section's wikitext (any heading level), or null. */
export function boxOfficeSection(wikitext) {
  const heading = /^(={2,4})\s*(?:Box[ -]office(?: performance| collections?)?|Commercial performance)\s*\1\s*$/im;
  const m = heading.exec(wikitext);
  if (!m) return null;
  const level = m[1].length;
  const rest = wikitext.slice(m.index + m[0].length);
  const next = new RegExp(`^={2,${level}}[^=].*={2,${level}}\\s*$`, 'm').exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

/** Wikitext to plain sentences: refs and most templates dropped, money templates spelled out, tables as rows. */
export function plainText(wikitext) {
  let t = wikitext
    .replace(/^=+[^=\n]+=+\s*$/gm, '\n\n') // headings end a sentence
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/\{\{\s*(?:efn|sfn|refn|cite|citation|notetag)[^{}]*\}\}/gi, '');
  // Money templates: {{INRConvert|475.62|c}}, {{INR}}, {{₹}}, {{US$|45 million}}, {{USD|45|million}}.
  t = t.replace(/\{\{\s*INRConvert\s*\|\s*([\d.,]+)\s*(?:\|\s*([a-z]+))?[^{}]*\}\}/gi, (_, n, u = '') => {
    const unit = { c: ' crore', l: ' lakh', m: ' million rupees', b: ' billion rupees', k: ' thousand rupees' }[u.toLowerCase()] ?? '';
    return `₹${n}${unit}`;
  });
  t = t.replace(/\{\{\s*(?:INR|₹|Indian Rupee|Rs\.?)\s*\}\}/gi, '₹')
    .replace(/\{\{\s*(?:US\$|USD)\s*\|\s*([^{}|]+?)\s*(?:\|\s*([^{}|]+?)\s*)?(?:\|[^{}]*)?\}\}/gi, (_, a, b) => `$${a}${b && !/^(?:link|long)/i.test(b) ? ` ${b}` : ''}`)
    .replace(/\{\{\s*(?:nbsp|snd|spaced ndash|ndash)\s*\}\}/gi, ' ')
    .replace(/&nbsp;/g, ' ');
  // Drop remaining templates (innermost first, a few passes for nesting).
  for (let i = 0; i < 4; i++) t = t.replace(/\{\{[^{}]*\}\}/g, '');
  t = t.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1').replace(/'{2,}/g, '').replace(/<[^>]+>/g, ' ');
  // Tables: one "sentence" per row, cells joined by spaces.
  t = t.replace(/^\{\|.*$/gm, '').replace(/^\|\}.*$/gm, '.').replace(/^\|[-+].*$/gm, '.')
    .replace(/^[|!]\s*/gm, ' ').replace(/\s*(?:\|\||!!)\s*/g, ' ').replace(/\|/g, ' ');
  return t.split(/(?<=[.!?])\s+(?=[A-Z"(])|\n\s*\.\s*\n|\n{2,}/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

const AMOUNT = /(?:₹|Rs\.?\s?|INR\s?)\s?([\d][\d,]*(?:\.\d+)?)\s*(crore|cr\b|lakh|million|billion)?|(?:US\s?\$|\$|USD\s?)\s?([\d][\d,]*(?:\.\d+)?)\s*(million|billion|mn\b|m\b)?/gi;
// Figures for part of the run (opening day, a weekend, the first week…) are not totals.
const PARTIAL = /\b(?:opening(?: day| weekend| week)?|first (?:day|weekend|week|two|three|four|five|six|seven|ten)|second (?:day|weekend|week)|third (?:day|weekend|week)|day one|(?:on|by) day \d|in (?:\d+|two|three|four|five|six|seven|eight|nine|ten) days|weekend|weekday|preview|advance(?:d)? booking|pre-sales?|single day|in a day|on its \w+ day)\b/i;
// One language version, a share or a profit is not the film's market total.
// A milestone passed ("crossed ₹500 crore") is a floor, not the total.
const NOT_TOTAL = /\b(?:hindi|telugu|tamil|malayalam|kannada|dubbed|english) (?:version|dub|net|gross|belt|markets?)\b|\bin (?:hindi|telugu|tamil|malayalam|kannada)\b|\bfirst\b[^.]{0,60}\bto\b|\bfastest\b|\b(?:over|more than|above|upwards of)\s*(?:₹|rs|\$|us\$|inr)|\b(?:distributor(?:'s)? share|share|profit|recover(?:ed|y)|budget|cost|cross(?:ed|es|ing)?|enter(?:ed|s|ing)? the|join(?:ed|s|ing)? the|club|milestone|mark)\b/i;
const COMPARISON = /\b(?:surpass|overtak|beat(?:ing|s)?\b|break(?:ing)? the record|previous(?:ly)? (?:held|record)|record (?:of|held)|compared (?:to|with))/i;

/** Rupees or US dollars, from one regex match. */
function value(m) {
  if (m[1]) {
    const n = Number(m[1].replace(/,/g, ''));
    const unit = (m[2] || '').toLowerCase();
    const inr = unit === 'crore' || unit === 'cr' ? n * CRORE : unit === 'lakh' ? n * LAKH
      : unit === 'million' ? n * 1e6 : unit === 'billion' ? n * 1e9 : n;
    return { inr: Math.round(inr) };
  }
  const n = Number(m[3].replace(/,/g, ''));
  const unit = (m[4] || '').toLowerCase();
  const usd = unit.startsWith('b') ? n * 1e9 : unit.startsWith('m') ? n * 1e6 : n;
  return { usd: Math.round(usd) };
}

/**
 * India net, India gross and overseas totals mentioned in the section, each with the sentence it came from.
 * Amounts stay in the currency they were written in ({ inr } or { usd }); the caller converts.
 */
export function marketFigures(section) {
  const found = {};
  const keep = (key, amount, sentence) => {
    const size = amount.inr ?? amount.usd * 90; // compare rupee and dollar amounts roughly
    if (!found[key] || size > found[key].size) found[key] = { ...amount, size, quote: sentence.slice(0, 240) };
  };
  for (const sentence of plainText(section)) {
    if (COMPARISON.test(sentence) || PARTIAL.test(sentence) || NOT_TOTAL.test(sentence)) continue;
    for (const m of sentence.matchAll(AMOUNT)) {
      const a = value(m);
      if (!(a.inr ?? a.usd) || (a.inr ?? a.usd) < 1e5) continue; // years, counts, footnote numbers
      // The words around this amount (up to the neighbouring amounts) say what it is.
      const before = sentence.slice(Math.max(0, m.index - 70), m.index).split(/(?:₹|\$)\s?[\d]/).pop() ?? '';
      const after = sentence.slice(m.index + m[0].length, m.index + m[0].length + 70).split(/(?:₹|\$)\s?[\d]/)[0];
      const near = `${before} ${after}`.toLowerCase();
      const worldwide = /\b(?:worldwide|global(?:ly)?|world-wide|total gross)\b/.test(near);
      const overseas = /\b(?:overseas|international(?:ly)?|outside india|abroad|foreign markets?)\b/.test(near);
      const india = /\b(?:india|indian box office|domestic(?:ally)?|nationwide)\b/.test(near);
      const net = /\bnett?\b/.test(near);
      const gross = /\bgross\b/.test(near);
      if (overseas && !worldwide && !net) keep('overseas', a, sentence);
      else if (india && net && !worldwide && !overseas && a.inr) keep('indiaNet', a, sentence);
      else if (india && gross && !net && !worldwide && !overseas) keep('indiaGross', a, sentence);
    }
  }
  return Object.fromEntries(Object.entries(found).map(([k, { size, ...v }]) => [k, v]));
}

// ---------- advance booking ----------
// Before and around release, articles report ticket pre-sales: "The film collected ₹35 crore from advance bookings
// for its opening day", "It made $40 million in presales". Only an amount inside such a sentence counts.
const ADVANCE = /\b(?:advance(?:d)?[- ](?:booking|bookings|sales|ticket sales|ticketing)|pre-?sales?|presales|pre-?bookings?)\b/i;
// Money that is not ticket sales (rights deals, budgets, distributor shares) in a sentence that also mentions pre-sales.
const NOT_TICKETS = /\b(?:share|profit|budget|cost|distribution rights|rights|deal|satellite|digital|ott|streaming|music|pre-release business|valued)\b/i;
// A record sentence ("breaking the first-day presale record set by…") is about one venue or day, not the film's advance total.
const ADV_RECORD = /\bbreak(?:ing|s)?\b[^.]{0,40}\brecords?\b|\brecords?\b[^.]{0,30}\b(?:set|held) by\b|\bfrom (?:a single|one) (?:cinema|theatre|theater|screen|venue)\b/i;
const FLOOR = /\b(?:over|more than|above|upwards of|crossed|crossing|exceed(?:ed|ing)?|nearly|almost|around|about|approximately|close to|estimated)\s*$/i;

/**
 * The advance booking (ticket pre-sales) amount an article reports: the largest one, since pre-sales only grow,
 * with `approx` when the article gives it as a floor or an estimate ("over ₹20 crore"), and the sentence it came
 * from. Amounts stay in the currency they were written in ({ inr } or { usd }). Null when none is reported.
 */
export function advanceFigure(wikitext) {
  let best = null;
  for (const sentence of plainText(wikitext)) {
    if (!ADVANCE.test(sentence) || COMPARISON.test(sentence) || ADV_RECORD.test(sentence) || NOT_TICKETS.test(sentence)) continue;
    for (const m of sentence.matchAll(AMOUNT)) {
      const a = value(m);
      const n = a.inr ?? a.usd;
      if (!n || n < 1e5) continue;
      // The amount has to sit in the same stretch of the sentence as the words about advance sales.
      const around = sentence.slice(Math.max(0, m.index - 110), m.index + m[0].length + 110);
      if (!ADVANCE.test(around)) continue;
      const size = a.inr ?? a.usd * 90;
      if (!best || size > best.size) {
        best = { ...a, size, approx: FLOOR.test(sentence.slice(Math.max(0, m.index - 24), m.index)), quote: sentence.slice(0, 240) };
      }
    }
  }
  if (!best) return null;
  const { size, ...rest } = best;
  return rest;
}
