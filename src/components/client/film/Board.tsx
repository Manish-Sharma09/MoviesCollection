'use client';
// The readout on a film page's box office board: a market switch (Worldwide / Overseas / India net), the total
// on flip-board digits, and one line of context. Worldwide is the running total: for a film in cinemas it ticks
// with the live estimate (src/lib/live.ts) every 5 minutes. Overseas and India figures are the totals stated in
// the film's Wikipedia article (scripts/fetch-boxoffice.mjs), checked against the worldwide gross.
import { useState, type ReactNode } from 'react';
import { formatFine, formatMoney, splitFigure, type Currency, type Lang } from '@/lib/format';
import { liveState, STEP } from '@/lib/live';
import type { LiveInfo, Money } from '@/lib/types';
import { otherCurrency } from '../basics';
import { useCurrency, useLang, useNow } from '../hooks';
import { Figure } from '../Live';

/** A market button. `value` is null when the film's Wikipedia article does not state that total. */
export interface MarketTab { key: string; label: string; value: Money | null; note?: string }

/** A reported amount split for the board: ₹1,968 cr → ["₹", "1,968", "", "cr"]; $210.6M → ["$", "210", ".6", "M"]. */
function boardParts(cur: Currency, m: Money, lang: Lang): [string, string, string, string] {
  const text = formatMoney(m, cur, lang);
  const match = text.match(/^([₹$])([\d,]+)(\.\d+)?\s*(.*)$/);
  return match ? [match[1], match[2], match[3] ?? '', match[4]] : ['', text, '', ''];
}

const timeIST = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

export function BoardReadout({ gross, native, live, label, range, markets }: {
  gross: Money; native: Currency; live?: LiveInfo; label: string; range?: ReactNode; markets: MarketTab[];
}) {
  const lang = useLang();
  const mode = useCurrency();
  const real = useNow();
  const [market, setMarket] = useState('worldwide');
  const cur = mode || native;
  const step = real === null ? null : Math.floor(real / STEP) * STEP;
  const state = live && step !== null ? liveState({ ...gross, ...live }, step) : null;
  const tabs: MarketTab[] = [{ key: 'worldwide', label: 'Worldwide', value: gross }, ...markets];
  const chosen = tabs.find((t) => t.key === market) ?? tabs[0];
  const worldwide = chosen.key === 'worldwide';
  const running = worldwide && state && real !== null && step !== null;

  let parts: [string, string, string, string];
  let line: ReactNode;
  if (running) {
    parts = splitFigure(cur, state.usd, state.inr, lang);
    line = (
      <>
        <span className="board-today">Today <b className="m">{state.today.inr > 0 ? formatFine(cur, state.today.usd, state.today.inr, lang) : '—'}</b></span>
        <span><span className="m">{formatFine(otherCurrency(cur), state.usd, state.inr, lang)}</span> · last report {formatMoney(gross, cur, lang)}</span>
      </>
    );
  } else if (worldwide) {
    parts = boardParts(cur, gross, lang);
    line = <span><span className="m">{formatMoney(gross, otherCurrency(cur), lang)}</span>{range ? <> · {range}</> : null}</span>;
  } else if (chosen.value) {
    parts = boardParts(cur, chosen.value, lang);
    line = <span>{Math.round((chosen.value.usd / gross.usd) * 100)}% of the worldwide total · as stated on Wikipedia</span>;
  } else {
    parts = ['', '—', '', ''];
    line = <span>Not reported yet: this film’s Wikipedia article does not state its {chosen.key === 'overseas' ? 'overseas' : chosen.label} total.</span>;
  }

  const secondsLeft = real !== null && step !== null ? Math.max(1, Math.ceil((step + STEP - real) / 1000)) : 0;
  return (
    <div className="board-readout">
      {tabs.length > 1 ? (
        <div className="tabs" role="tablist" aria-label="Market">
          {tabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={t.key === chosen.key} onClick={() => setMarket(t.key)}
              className={t.value ? undefined : 'is-empty'} title={t.value ? undefined : 'Not reported yet'}>{t.label}</button>
          ))}
        </div>
      ) : null}
      <div className="board-meta">
        <span className={running ? 'board-label is-live' : 'board-label'}>{running ? 'Running total' : worldwide ? label : chosen.note ?? chosen.label}</span>
        {running ? (
          <span className="board-refresh" title={`Live estimate as of ${timeIST(step!)} India time, between reported figures`}>
            Refreshes in <b className="m">{`${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`}</b>
          </span>
        ) : null}
      </div>
      <p className="board-figure" aria-live="off"><Figure parts={parts} /></p>
      <p className="board-line">{line}</p>
    </div>
  );
}
