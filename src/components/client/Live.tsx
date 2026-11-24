'use client';
// Live estimates for films in cinemas. The static HTML shows the last reported figure; after
// hydration these components add the estimate for the time since (src/lib/live.ts), moving in
// 1-minute steps and marked with a red dot (.is-live). Outside the live window they show the
// reported figure, exactly as rendered.
import { useState, type ReactNode } from 'react';
import { CLIENT_TEXT } from '@/content/client-text';
import { formatFine, formatMoney, splitFigure, type Currency } from '@/lib/format';
import { liveState, STEP, type LiveInput } from '@/lib/live';
import type { LiveInfo, Money as MoneyValue } from '@/lib/types';
import { Money, otherCurrency } from './basics';
import { useCurrency, useLang, useLiveStep, useNow } from './hooks';

const timeIST = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

const input = (gross: MoneyValue, live: LiveInfo): LiveInput => ({ ...gross, ...live });

function useLive(gross: MoneyValue, live: LiveInfo | undefined) {
  const step = useLiveStep();
  const state = live && step !== null ? liveState(input(gross, live), step) : null;
  return { step, state };
}

/** The amount in a ranked list row (<span class="v">) for a film in cinemas. */
export function RankValue({ gross, native, exact, live }: {
  gross: MoneyValue; native: Currency; exact?: boolean; live: LiveInfo;
}) {
  const lang = useLang();
  const mode = useCurrency();
  const { step, state } = useLive(gross, live);
  if (!state || step === null) {
    return <span className="v"><Money {...gross} native={native} exact={exact} /></span>;
  }
  return (
    <span className="v is-live" title={CLIENT_TEXT[lang].liveTitle(timeIST(step))}>
      <span className="m">{formatMoney(state, mode || native, lang)}</span>
    </span>
  );
}

/** Amount, status and today's takings on a home page board card. */
export function BoardCollection({ gross, native, live, reported, estimate }: {
  gross: MoneyValue; native: Currency; live?: LiveInfo; reported: string; estimate: string;
}) {
  const lang = useLang();
  const mode = useCurrency();
  const text = CLIENT_TEXT[lang];
  const { step, state } = useLive(gross, live);
  const cur = mode || native;
  return (
    <div className="card-collection">
      {state && step !== null ? (
        <span className="board-v is-live" title={text.liveTitle(timeIST(step))}>
          <span className="m">{formatMoney(state, cur, lang)}</span>
        </span>
      ) : (
        <span className="board-v"><Money {...gross} native={native} /></span>
      )}
      <small>{state ? estimate : reported}</small>
      <small className="board-today" hidden={!state}>
        {state ? (state.today.inr > 0 ? text.today(formatMoney(state.today, cur, lang)) : text.noShows) : null}
      </small>
    </div>
  );
}

/** One character of the live figure. It rolls in when it first appears, unless it was there on load. */
function Digit({ ch, animate }: { ch: string; animate: boolean }) {
  const [roll] = useState(animate); // fixed at mount: a digit that stays never re-animates
  // Separators (, and .) are marked apart so the film page's board can put only the digits on flip tiles.
  const kind = /\d/.test(ch) ? 'digit' : 'digit sep';
  return <span className={roll ? `${kind} roll` : kind}>{ch}</span>;
}

function Digits({ text, animate }: { text: string; animate: boolean }) {
  const chars = [...text];
  // Keyed by place from the right, so a digit that keeps its value keeps its element and stays still;
  // only the digits that changed mount again and roll (like iOS numeric text transitions).
  return chars.map((ch, i) => <Digit key={`${chars.length - i}:${ch}`} ch={ch} animate={animate} />);
}

/** The headline live figure, split into currency, whole part, decimals and unit. */
export function Figure({ parts }: { parts: [string, string, string, string] }) {
  const key = parts.join('');
  const [first, setFirst] = useState<string | null>(null);
  if (first === null) setFirst(key);
  const animate = first !== null && first !== key;
  const [cur, int, dec, unit] = parts;
  return (
    <span className="m">
      <span className="sr-only">{`${cur}${int}${dec} ${unit}`}</span>
      <span aria-hidden="true">
        <span className="cur">{cur}</span>
        <span className="int"><Digits text={int} animate={animate} /></span>
        <span className="dec"><Digits text={dec} animate={animate} /></span>
        <span className="unit">{unit}</span>
      </span>
    </span>
  );
}

interface StatProps {
  gross: MoneyValue;
  native: Currency;
  label: string;
  range?: ReactNode;
}

/** The headline of a film page: label, figure, and one quiet line (the other currency, any reported range). */
export function StatMain({ gross, native, label, range }: StatProps) {
  return (
    <div className="stat-main">
      <div className="stat-top"><p className="stat-label">{label}</p></div>
      <span className="stat-figure"><Money {...gross} native={native} /></span>
      <p className="stat-line"><span className="stat-sub"><Money {...gross} native={native} alt />{range ? <> · {range}</> : null}</span></p>
    </div>
  );
}

/** A film in cinemas: the live estimate, today's takings, and a ring counting down to the next 1-minute step. */
export function LiveStatMain({ live, ...props }: StatProps & { live: LiveInfo }) {
  const { gross, native } = props;
  const lang = useLang();
  const mode = useCurrency();
  const text = CLIENT_TEXT[lang];
  const real = useNow();
  const step = real === null ? null : Math.floor(real / STEP) * STEP;
  const state = step !== null ? liveState(input(gross, live), step) : null;
  if (!state || real === null || step === null) return <StatMain {...props} />;

  const cur = mode || native;
  const alt = otherCurrency(cur);
  const secondsLeft = Math.max(1, Math.ceil((step + STEP - real) / 1000));
  const clock = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;
  const progress = (real - step) / STEP;
  const fine = (m: MoneyValue, c = cur) => formatFine(c, m.usd, m.inr, lang);
  const compact = (m: MoneyValue) => formatMoney(m, cur, lang);
  return (
    <div className="stat-main">
      <div className="stat-top">
        <p className="stat-label">{text.liveLabel}</p>
        <p className="next-update">
          <svg className="countdown-ring" viewBox="0 0 20 20" aria-hidden="true">
            <circle className="track" cx="10" cy="10" r="8" />
            {/* Keyed by step: a new step starts an empty ring instead of winding back. */}
            <circle key={step} className="fill" cx="10" cy="10" r="8" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - progress} />
          </svg>
          {text.nextUpdate} <b>{clock}</b>
        </p>
      </div>
      <span className="stat-figure is-live" title={text.liveTitle(timeIST(step))}>
        <Figure parts={splitFigure(cur, state.usd, state.inr, lang)} />
      </span>
      <p className="stat-line">
        <span className="live-today">{state.today.inr > 0 ? text.today(fine(state.today)) : text.noShows}</span>
        <span className="stat-sub"><span className="m">{fine(state, alt)}</span> · {text.lastReported(compact(gross))}</span>
      </p>
    </div>
  );
}
