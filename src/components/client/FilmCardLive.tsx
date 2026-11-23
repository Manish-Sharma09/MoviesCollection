'use client';
// The moving parts of a home page film card: the day of the run, and the worldwide total with today's
// takings and the minutes to the next live step. The static HTML shows the reported total; after hydration
// a film with a running estimate ticks in 5-minute steps (src/lib/live.ts), like the rest of the site.
import { CLIENT_TEXT } from '@/content/client-text';
import { formatMoney, splitFigure, type Currency, type Lang } from '@/lib/format';
import { DAY, istMidnight, liveState, STEP } from '@/lib/live';
import type { LiveInfo, Money } from '@/lib/types';
import { useCurrency, useLang, useNow } from './hooks';

/** ₹1,727.23 cr → ["₹", "1,727", ".23", "cr"]: the card shows two decimals, not the board's four. */
function parts(cur: Currency, m: Money, lang: Lang): [string, string, string, string] {
  const [c, int, dec, unit] = splitFigure(cur, m.usd, m.inr, lang);
  return [c, int, dec.slice(0, 3), unit];
}

/** "Day 19", in the page's language, following the clock after hydration. */
export function CardDay({ release, initial }: { release: string; initial: number }) {
  const lang = useLang();
  const now = useNow();
  const day = now === null ? initial : Math.floor((now - istMidnight(release)) / DAY) + 1;
  return <>{CLIENT_TEXT[lang].day(Math.max(1, day))}</>;
}

export function CardGross({ gross, native, live }: { gross: Money; native: Currency; live?: LiveInfo | null }) {
  const lang = useLang();
  const text = CLIENT_TEXT[lang];
  const cur = useCurrency() || native;
  const real = useNow();
  const step = real === null ? null : Math.floor(real / STEP) * STEP;
  const state = live && step !== null ? liveState({ ...gross, ...live }, step) : null;
  const [c, int, dec, unit] = parts(cur, state ?? gross, lang);
  const minutes = state && real !== null && step !== null ? Math.max(1, Math.ceil((step + STEP - real) / 60_000)) : null;

  return (
    <>
      <p className={state ? 'fc-figure is-live' : 'fc-figure'}>
        <span className="sr-only">{`${c}${int}${dec} ${unit}`}</span>
        <span aria-hidden="true"><span className="cur">{c}</span><span className="int">{int}{dec}</span><span className="unit">{unit}</span></span>
      </p>
      <p className="fc-live">
        {state ? (
          <>
            <span className={state.today.inr > 0 ? 'fc-today' : 'fc-today is-quiet'}>
              {state.today.inr > 0 ? <><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2 11 10H1z" /></svg>{text.today(formatMoney(state.today, cur, lang))}</> : text.noShows}
            </span>
            {minutes !== null ? (
              <span className="fc-refresh" title={`${text.refreshTitle} ${text.refreshMin(minutes)}`}>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3" /></svg>
                {text.refreshMin(minutes)}
              </span>
            ) : null}
          </>
        ) : <span className="fc-reported">{text.reportedTotal}</span>}
      </p>
    </>
  );
}
