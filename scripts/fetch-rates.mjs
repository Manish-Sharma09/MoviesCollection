// Latest exchange rates (per 1 USD). Output: data/raw/rates.json
//
// 1. Frankfurter (European Central Bank reference rates): ~30 major currencies, preferred where it has one.
// 2. fawazahmed0/exchange-api (CC0, free, no key, updated daily): every other currency films report in
//    (PKR, BDT, NGN, ARS…), so none of them goes stale. Two mirrors of the same files.
// Either source alone is enough; if both fail, the last good file stays as it is.
import { getJson } from './lib/http.mjs';
import { saveJson } from './lib/steps.mjs';

const OUT = new URL('../data/raw/rates.json', import.meta.url);

// Pre-euro currencies still found on older films, fixed against the euro (official rates).
const LEGACY_PER_EUR = {
  DEM: 1.95583, FRF: 6.55957, ITL: 1936.27, ESP: 166.386, NLG: 2.20371, BEF: 40.3399,
  ATS: 13.7603, FIM: 5.94573, PTE: 200.482, IEP: 0.787564, GRD: 340.75,
};

// Last resort for a few currencies if neither source is reachable on a fresh checkout.
const FALLBACK_PER_USD = {
  PKR: 280, BDT: 120, LKR: 300, NPR: 150, RUB: 90, NGN: 1500, TWD: 32, ARS: 1000, EGP: 50,
  IRR: 42000, VND: 25000, AED: 3.6725, SAR: 3.75,
};

const WIDE_SOURCES = [
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
  'https://latest.currency-api.pages.dev/v1/currencies/usd.json',
];

async function ecb() {
  const json = await getJson('https://api.frankfurter.dev/v1/latest?base=USD', {}, { label: 'rates (ECB)', retries: 2 });
  if (!(json.rates?.INR > 0 && json.rates?.EUR > 0)) throw new Error('ECB rates: INR or EUR missing');
  return { date: json.date, rates: json.rates };
}

async function wide() {
  let lastErr;
  for (const url of WIDE_SOURCES) {
    try {
      const json = await getJson(url, {}, { label: 'rates (all currencies)', retries: 2 });
      const rates = {};
      for (const [code, v] of Object.entries(json.usd || {})) {
        if (/^[a-z]{3}$/.test(code) && Number.isFinite(v) && v > 0) rates[code.toUpperCase()] = v;
      }
      if (!(rates.INR > 0 && rates.EUR > 0)) throw new Error('INR or EUR missing');
      return { date: json.date, rates };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

async function main() {
  const [major, all] = await Promise.allSettled([ecb(), wide()]);
  for (const r of [major, all]) if (r.status === 'rejected') console.warn(`  ${r.reason.message}`);
  if (major.status === 'rejected' && all.status === 'rejected') throw new Error('No exchange-rate source reachable; keeping the last rates.');
  const perUsd = { ...FALLBACK_PER_USD, ...all.value?.rates, ...major.value?.rates, USD: 1 };
  for (const [code, perEur] of Object.entries(LEGACY_PER_EUR)) perUsd[code] = perEur * perUsd.EUR;
  const date = major.value?.date || all.value.date;
  const source = [major.value && 'ECB via frankfurter.dev', all.value && 'fawazahmed0/exchange-api'].filter(Boolean).join(' + ');
  await saveJson(OUT, { date, fetchedAt: new Date().toISOString(), source, perUsd }, 1);
  console.log(`Rates for ${date} (${source}): ${Object.keys(perUsd).length} currencies, 1 USD = ₹${perUsd.INR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
