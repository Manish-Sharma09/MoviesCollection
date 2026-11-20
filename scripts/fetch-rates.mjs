// Latest exchange rates (per 1 USD) from the free Frankfurter API (European Central Bank data).
// Output: data/raw/rates.json
import { writeFile } from 'node:fs/promises';
import { getJson } from './lib/http.mjs';

const OUT = new URL('../data/raw/rates.json', import.meta.url);

// Pre-euro currencies still found on older films, fixed against the euro (official rates).
const LEGACY_PER_EUR = {
  DEM: 1.95583, FRF: 6.55957, ITL: 1936.27, ESP: 166.386, NLG: 2.20371, BEF: 40.3399,
  ATS: 13.7603, FIM: 5.94573, PTE: 200.482, IEP: 0.787564, GRD: 340.75,
};

// Currencies the ECB does not publish. Approximate rates per USD; update now and then.
const FALLBACK_PER_USD = {
  PKR: 280, BDT: 120, LKR: 300, NPR: 150, RUB: 90, NGN: 1500, TWD: 32, ARS: 1000, EGP: 50,
  IRR: 42000, VND: 25000, AED: 3.6725, SAR: 3.75,
};

async function main() {
  const json = await getJson('https://api.frankfurter.dev/v1/latest?base=USD', {}, { label: 'rates' });
  const perUsd = { USD: 1, ...FALLBACK_PER_USD, ...json.rates };
  for (const [code, perEur] of Object.entries(LEGACY_PER_EUR)) perUsd[code] = perEur * perUsd.EUR;
  await writeFile(OUT, JSON.stringify({ date: json.date, source: 'ECB via frankfurter.dev', perUsd }, null, 1));
  console.log(`Rates for ${json.date}: 1 USD = ₹${perUsd.INR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
