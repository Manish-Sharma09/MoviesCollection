// Text used by browser components (search, live estimates). Kept apart from en.ts/hi.ts so the
// long page copy is not shipped to the browser.
import type { Lang } from '@/lib/format';

const en = {
  films: (n: number) => `${n} films`,
  searchUnavailable: 'Search is temporarily unavailable. Try again.',
  noMatch: 'No film or person by that name yet. Try a shorter spelling.',
  liveTitle: (t: string) => `Live estimate as of ${t} India time, between reported figures`,
  today: (x: string) => `+${x} today`,
  noShows: 'No shows running right now',
  cancel: 'Cancel',
  // Live page
  todayAll: 'Collected today by films in cinemas',
  inCinemas: 'in cinemas',
  liveEstimates: 'live estimates',
  checked: 'figures checked',
  liveNowTitle: 'Live now',
  liveNowNote: 'Totals move every 5 minutes between reported figures.',
  alsoTitle: 'Also in cinemas',
  alsoNote: 'No live estimate for these: either no new figure in the last four days, or not enough daily figures to base one on. They show their last reported total.',
  trendHeader: 'Daily trend',
  totalHeader: 'Total',
  day: (n: number) => `Day ${n}`,
  lastReport: (d: string) => `Reported ${d}`,
  trendDay: (d: number, x: string) => `Day ${d}: ${x}`,
  trendDays: (a: number, b: number, x: string) => `Days ${a}–${b}: ${x} a day`,
  trendLabel: (n: number) => `Collection by day for the latest ${n} reports`,
  updatedNow: 'New figures just arrived.',
  // Film pages (the live figure) are English only.
  liveLabel: 'Live collection estimate',
  nextUpdate: 'Next update in',
  perHour: (x: string) => `Earning about ${x} an hour right now.`,
  beforeShows: 'Shows start around 9 am India time; the estimate rises from then.',
  lastReported: (x: string, t: string) => `Last reported ${x}. Estimate as of ${t} until the next report.`,
};

const hi: typeof en = {
  ...en,
  films: (n) => `${n} फ़िल्में`,
  searchUnavailable: 'खोज अभी उपलब्ध नहीं है। फिर कोशिश करें।',
  noMatch: 'इस नाम की कोई फ़िल्म या कलाकार नहीं मिला। छोटी स्पेलिंग आज़माएं।',
  liveTitle: (t) => `भारतीय समय ${t} तक का लाइव अनुमान, रिपोर्ट किए गए आंकड़ों के बीच`,
  today: (x) => `आज +${x}`,
  noShows: 'अभी कोई शो नहीं चल रहा',
  cancel: 'रद्द करें',
  todayAll: 'सिनेमाघरों की फ़िल्मों का आज का कलेक्शन',
  inCinemas: 'सिनेमाघरों में',
  liveEstimates: 'लाइव अनुमान',
  checked: 'आंकड़ों की जाँच',
  liveNowTitle: 'अभी लाइव',
  liveNowNote: 'रिपोर्ट किए गए आंकड़ों के बीच कुल कलेक्शन हर 5 मिनट में बढ़ता है।',
  alsoTitle: 'सिनेमाघरों में और फ़िल्में',
  alsoNote: 'इनका लाइव अनुमान नहीं है: या तो पिछले चार दिनों में कोई नया आंकड़ा नहीं आया, या अनुमान के लिए रोज़ के आंकड़े काफ़ी नहीं हैं। इनका आख़िरी रिपोर्ट किया गया कुल कलेक्शन दिखता है।',
  trendHeader: 'रोज़ का रुझान',
  totalHeader: 'कुल',
  day: (n) => `दिन ${n}`,
  lastReport: (d) => `रिपोर्ट ${d}`,
  trendDay: (d, x) => `दिन ${d}: ${x}`,
  trendDays: (a, b, x) => `दिन ${a}–${b}: ${x} प्रति दिन`,
  trendLabel: (n) => `हाल की ${n} रिपोर्ट का रोज़ का कलेक्शन`,
  updatedNow: 'नए आंकड़े अभी आए हैं।',
  liveLabel: 'लाइव कलेक्शन अनुमान',
  nextUpdate: 'अगला अपडेट',
  beforeShows: 'शो भारतीय समय सुबह करीब 9 बजे शुरू होते हैं; अनुमान तब से बढ़ता है।',
};

export const CLIENT_TEXT: Record<Lang, typeof en> = { en, hi };
