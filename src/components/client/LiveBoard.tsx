'use client';
// The /live/ page: every film in cinemas with its live total, today's takings and a sparkline of its
// recent daily collection, under a summary of what all of them have collected today.
//
// The first render (static HTML) is computed at the build time it is given, so it matches on hydration;
// after that the figures follow the clock in 1-minute steps (src/lib/live.ts). While the page is open it
// re-reads /live.json, so new reported figures arrive without a reload.
import { useEffect, useState } from 'react';
import { CLIENT_TEXT } from '@/content/client-text';
import { formatFine, formatMoney, splitFigure, type Currency, type Lang } from '@/lib/format';
import { DAY, istMidnight, liveState, STEP, type LiveState } from '@/lib/live';
import type { CinemaBoard, CinemaEntry } from '@/lib/types';
import { otherCurrency, SafeImg } from './basics';
import { useCurrency, useLang, useNow } from './hooks';
import { Figure } from './Live';

const REFRESH_EVERY = 60_000;
type Text = (typeof CLIENT_TEXT)[Lang];

const ist = (ms: number, lang: Lang, opts: Intl.DateTimeFormatOptions) =>
  new Date(ms).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { ...opts, timeZone: 'Asia/Kolkata' });
const shortDate = (iso: string, lang: Lang) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
/** Day 1 is the release day (India time). */
const dayNumber = (date: string, now: number) => Math.floor((now - istMidnight(date)) / DAY) + 1;
/** Figures that matter: a change here means new reports, not just a rebuild. */
const signature = (b: CinemaBoard) => b.films.map((f) => `${f.id}:${f.gross.usd}:${f.lastReport}`).join('|');

export function LiveBoard({ initial, buildTime }: { initial: CinemaBoard; buildTime: number }) {
  const lang = useLang();
  const text = CLIENT_TEXT[lang];
  const mode = useCurrency();
  const real = useNow(); // null until hydrated; then ticks every second (for the countdown)
  const [board, setBoard] = useState(initial);
  const [arrived, setArrived] = useState(false);

  // Pick up new reported figures while the page is open: every minute, and when the tab comes back.
  useEffect(() => {
    let cancelled = false;
    let hideNote: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      try {
        const res = await fetch('/live.json', { cache: 'no-store' });
        if (!res.ok) return;
        const next = (await res.json()) as CinemaBoard;
        if (cancelled || next.generatedAt === board.generatedAt) return;
        const changed = signature(next) !== signature(board);
        setBoard(next);
        if (changed) {
          setArrived(true);
          clearTimeout(hideNote);
          hideNote = setTimeout(() => setArrived(false), 10_000);
        }
      } catch {
        // Offline or the file is mid-deploy: keep showing what we have.
      }
    };
    const timer = setInterval(refresh, REFRESH_EVERY);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      clearTimeout(hideNote);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [board]);

  const step = Math.floor((real ?? buildTime) / STEP) * STEP;
  const rows = board.films.map((f) => ({
    f,
    state: f.live ? liveState({ ...f.gross, ...f.live }, step) : null,
  }));
  const liveRows = rows.filter((r) => r.f.liveNow);
  const otherRows = rows.filter((r) => !r.f.liveNow);
  const today = rows.reduce((s, { state }) => (state ? { usd: s.usd + state.today.usd, inr: s.inr + state.today.inr } : s), { usd: 0, inr: 0 });
  const estimating = rows.filter((r) => r.state).length;
  const cur: Currency = mode || 'INR';
  const checked = board.checkedAt ? Date.parse(board.checkedAt) : null;

  return (
    <>
      {/* The same box office board as film pages: an ink marquee with flip-board digits, torn from a stub. */}
      <div className="board live-summary" role="group" aria-label={text.todayAll}>
        <div className="board-top">
          <div className="board-meta">
            <span className={today.inr > 0 ? 'board-label is-live' : 'board-label'}>{text.todayAll}</span>
            {real !== null && estimating ? <Countdown real={real} step={step} text={text} /> : null}
          </div>
          <p className="board-figure">
            {today.inr > 0 ? <Figure parts={splitFigure(cur, today.usd, today.inr, lang)} /> : <span className="m">—</span>}
          </p>
          <p className="board-line">
            {today.inr > 0 ? <span className="m">{formatFine(otherCurrency(cur), today.usd, today.inr, lang)}</span> : text.beforeShows}
            <span className="live-arrived" role="status">{arrived ? text.updatedNow : ''}</span>
          </p>
        </div>
        <div className="board-stub">
          <dl className="stub-stats">
            <div><dt>{text.inCinemas}</dt><dd className="m">{board.films.length}</dd></div>
            <div><dt>{text.liveEstimates}</dt><dd className="m">{estimating}</dd></div>
            {checked ? (
              <div>
                <dt>{text.checked}</dt>
                <dd className="m">{ist(checked, lang, { hour: 'numeric', minute: '2-digit' })}</dd>
                <dd className="stub-sub">{ist(checked, lang, { day: 'numeric', month: 'short' })}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>

      {liveRows.length ? (
        <section aria-labelledby="live-now">
          <h2 id="live-now">{text.liveNowTitle}</h2>
          <p className="section-note">{text.liveNowNote}</p>
          <CinemaList rows={liveRows} step={step} lang={lang} text={text} mode={mode} />
        </section>
      ) : null}
      {otherRows.length ? (
        <section aria-labelledby="also-in-cinemas">
          <h2 id="also-in-cinemas">{text.alsoTitle}</h2>
          <p className="section-note">{text.alsoNote}</p>
          <CinemaList rows={otherRows} step={step} lang={lang} text={text} mode={mode} />
        </section>
      ) : null}
    </>
  );
}

function Countdown({ real, step, text }: { real: number; step: number; text: Text }) {
  const secondsLeft = Math.max(1, Math.ceil((step + STEP - real) / 1000));
  return (
    <p className="board-refresh">
      {text.nextUpdate} <b>{`${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`}</b>
    </p>
  );
}

function CinemaList({ rows, step, lang, text, mode }: {
  rows: { f: CinemaEntry; state: LiveState | null }[]; step: number; lang: Lang; text: Text; mode: Currency | null;
}) {
  return (
    <div className="live-list">
      <div className="live-list-head" aria-hidden="true"><span /><span /><span>{text.trendHeader}</span><span>{text.totalHeader}</span></div>
      <ol>
        {rows.map(({ f, state }) => {
          const cur = mode || f.native;
          const meta = [f.language ? f.language[lang] : null, text.day(dayNumber(f.release, step))].filter(Boolean).join(' · ');
          return (
            <li className="live-row" key={f.id} data-reveal="">
              <span className="poster" aria-hidden="true">
                <span className="poster-letter">{f.title.trim().slice(0, 1)}</span>
                {f.poster ? <SafeImg src={f.poster} alt="" width={92} height={138} loading="lazy" decoding="async" /> : null}
              </span>
              <span className="live-info">
                <a href={`/movie/${f.slug}/`}>{f.title}</a>
                <small>{meta}</small>
              </span>
              <Trend trend={f.trend} cur={cur} lang={lang} text={text} />
              <span className="live-value">
                <span className={state ? 'v is-live' : 'v'}>
                  <span className="m">{state ? formatFine(cur, state.usd, state.inr, lang) : formatMoney(f.gross, cur, lang)}</span>
                </span>
                {state ? (
                  <small className={state.today.inr > 0 ? 'up' : undefined}>
                    {state.today.inr > 0 ? text.today(formatMoney(state.today, cur, lang)) : text.noShows}
                  </small>
                ) : f.lastReport ? <small>{text.lastReport(shortDate(f.lastReport, lang))}</small> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Collection per day for the latest reports (up to 10): one bar per report, newest on the right in the accent
 * colour, the rest in a neutral de-emphasis grey (validated: both ≥ 3:1 on the card in light and dark).
 * Bars are square at the baseline with a rounded top and a 2px gap. Each bar's exact figure is in its
 * tooltip; the film page's day-wise table has them all.
 */
function Trend({ trend, cur, lang, text }: { trend: CinemaEntry['trend']; cur: Currency; lang: Lang; text: Text }) {
  if (trend.length < 2) return <span className="trend" aria-hidden="true" />;
  // Ten fixed slots, newest on the right: bars are the same width in every row, so rows compare.
  const SLOTS = 10;
  const W = 96;
  const H = 28;
  const GAP = 2;
  const n = trend.length;
  const bw = (W - GAP * (SLOTS - 1)) / SLOTS;
  const offset = (SLOTS - n) * (bw + GAP);
  const max = Math.max(...trend.map((t) => t.usd)) || 1;
  return (
    <svg className="trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={text.trendLabel(n)}>
      {trend.map((t, i) => {
        const h = Math.max(2, (t.usd / max) * H);
        const x = offset + i * (bw + GAP);
        const r = Math.min(2.5, bw / 2, h);
        const amount = formatMoney(t, cur, lang);
        return (
          <path key={`${t.from}-${t.to}`} className={i === n - 1 ? 'latest' : undefined}
            d={`M${x} ${H}V${H - h + r}a${r} ${r} 0 0 1 ${r} ${-r}h${bw - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}V${H}z`}>
            <title>{t.from === t.to ? text.trendDay(t.to, amount) : text.trendDays(t.from, t.to, amount)}</title>
          </path>
        );
      })}
    </svg>
  );
}
