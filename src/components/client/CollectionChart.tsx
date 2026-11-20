'use client';
// The film page's collection graph: the worldwide total day by day (line), or what each day added
// (columns). One measure at a time on one axis (a Total / Per day switch), never two scales together.
// For a film in cinemas the line continues, dashed, to the live estimate now, and today's column shows the
// estimate so far, lighter, because both are estimates and not reports. Hover, tap or the arrow keys read
// any day; the day-wise table under the chart lists every figure.
import { useEffect, useId, useRef, useState } from 'react';
import { formatFine, formatMoney, type Currency } from '@/lib/format';
import { DAY, estimate, istMidnight, STALE_AFTER } from '@/lib/live';
import type { DailyRow, LiveInfo, Money as MoneyValue } from '@/lib/types';
import { useCurrency, useLang, useLiveStep } from './hooks';
import { EASE, gsap, MOTION_OK, motionOn, ScrollTrigger, useGSAP } from './motion/gsap';

type View = 'total' | 'daily';

interface Mark {
  /** Day range on the x axis, in days since release (0 = release morning). */
  x0: number;
  x1: number;
  value: number;
  money: MoneyValue;
  label: string;
  sub: string;
  estimate?: boolean;
}

const HEIGHT = 240;
const PAD = { top: 14, right: 72, bottom: 30, left: 4 };

const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

/** Round axis steps: 1, 2, 2.5 or 5 × 10ⁿ, about four gridlines. */
function niceTicks(max: number): number[] {
  if (!(max > 0)) return [0];
  const rough = max / 4;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks.at(-1)! < max) ticks.push(ticks.at(-1)! + step);
  return ticks;
}

export function CollectionChart({ days, release, native, live, gross }: {
  days: DailyRow[]; release: string; native: Currency; live?: LiveInfo; gross: MoneyValue;
}) {
  const lang = useLang();
  const mode = useCurrency();
  const cur = mode || native;
  const step = useLiveStep(); // null while hydrating: the static chart shows reported figures only
  const [view, setView] = useState<View>('total');
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const v = (m: MoneyValue) => (cur === 'INR' ? m.inr : m.usd);
  const start = istMidnight(release);
  const dateOf = (day: number) => shortDate(start + (day - 1) * DAY);

  // ---- reported figures ----
  // A report published in the morning covers the day before (see scripts/merge.mjs): for a film in cinemas
  // the latest report is plotted at the day it covers, so the live estimate continues from the right place.
  const coveredDay = live ? Math.round((istMidnight(live.coveredThrough) - start) / DAY) + 1 : null;
  let points = days.map((d) => ({ day: d.day, total: d.total, latest: false }));
  const lastRow = points.at(-1);
  if (lastRow && coveredDay && coveredDay < lastRow.day) {
    points = [...points.filter((p) => p.day < coveredDay), { day: coveredDay, total: lastRow.total, latest: true }];
  }
  const reported: Mark[] = points.map((p) => ({
    x0: p.day - 1, x1: p.day, value: v(p.total), money: p.total,
    label: p.latest ? 'Latest report' : `Day ${p.day}`,
    sub: p.latest ? `covers to ${dateOf(p.day)}` : dateOf(p.day),
  }));
  const perDay: Mark[] = [];
  points.forEach((p, i) => {
    const prev = points[i - 1];
    const from = (prev?.day ?? 0) + 1;
    const span = Math.max(1, p.day - from + 1);
    const added = { usd: p.total.usd - (prev?.total.usd ?? 0), inr: p.total.inr - (prev?.total.inr ?? 0) };
    if (added.inr <= 0) return;
    const each = { usd: added.usd / span, inr: added.inr / span };
    for (let day = from; day <= p.day; day++) {
      perDay.push({
        x0: day - 1, x1: day, value: v(each), money: each,
        label: span > 1 ? `Days ${from}–${p.day}` : `Day ${day}`,
        sub: span > 1 ? 'average a day (one report covered these days)' : dateOf(day),
      });
    }
  });

  // ---- live estimate since the last report ----
  let liveEnd: Mark | null = null;
  const estimatedDays: Mark[] = [];
  if (live && step !== null) {
    const reportEnd = istMidnight(live.coveredThrough) + DAY;
    if (step >= reportEnd && step - reportEnd <= STALE_AFTER) {
      const at = (t: number) => ({
        usd: estimate({ base: live.base.usd, coveredThrough: live.coveredThrough }, t).total,
        inr: estimate({ base: live.base.inr, coveredThrough: live.coveredThrough }, t).total,
      });
      const nowX = (step - start) / DAY;
      const total = at(step);
      const money = { usd: gross.usd + total.usd, inr: gross.inr + total.inr };
      liveEnd = { x0: nowX, x1: nowX, value: v(money), money, label: 'Now', sub: 'live estimate', estimate: true };
      for (let t = reportEnd; t < step; t += DAY) {
        const day = Math.round((t - start) / DAY) + 1;
        const before = at(t);
        const after = at(Math.min(t + DAY, step));
        const added = { usd: after.usd - before.usd, inr: after.inr - before.inr };
        if (added.inr <= 0) continue;
        const today = t + DAY > step;
        estimatedDays.push({
          x0: day - 1, x1: day, value: v(added), money: added, label: today ? 'Today so far' : `Day ${day}`,
          sub: `${dateOf(day)} · estimate`, estimate: true,
        });
      }
    }
  }

  // The estimate appears a moment after hydration (it needs the clock): re-arm the entrance when it does,
  // so the dashed segment fades in after the line instead of showing up before it.
  const estimateShown = view === 'total' ? Boolean(liveEnd) : estimatedDays.length > 0;

  // Entrance: the line draws itself in (then the area and dots fade in); per-day columns grow up from the
  // baseline. Plays when the chart scrolls into view, and again when switching between the two views.
  useGSAP(() => {
    if (!motionOn() || !box.current) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      const q = gsap.utils.selector(box);
      const line = q('.chart-line:not(.chart-estimate)');
      const tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      if (view === 'total') {
        tl.from(line, { drawSVG: 0, duration: 1.4, ease: 'power2.inOut' })
          .from(q('.chart-area'), { autoAlpha: 0, duration: 0.8 }, 0.5)
          .from(q('.chart-estimate, .chart-dot'), { autoAlpha: 0, duration: 0.4 }, '>-0.3')
          // Drop the drawing styles so later redraws (resize, ₹/$ switch) never cut the line short.
          .set(line, { clearProps: 'strokeDasharray,strokeDashoffset' });
      } else {
        tl.from(q('.chart-bar'), { scaleY: 0, transformOrigin: '50% 100%', duration: 0.8, stagger: { amount: 0.45 } });
      }
      ScrollTrigger.create({ trigger: box.current, start: 'top 85%', once: true, onEnter: () => { tl.play(); } });
    });
  }, { scope: box, dependencies: [view, estimateShown], revertOnUpdate: true });

  // ---- scales ----
  const marks = view === 'total' ? [...reported, ...(liveEnd ? [liveEnd] : [])] : [...perDay, ...estimatedDays];
  const lastDay = Math.max(days.at(-1)?.day ?? 1, liveEnd ? Math.ceil(liveEnd.x1) : 0, ...estimatedDays.map((m) => m.x1));
  const ticks = niceTicks(Math.max(...marks.map((m) => m.value), 0));
  const yMax = ticks.at(-1) || 1;
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (d: number) => PAD.left + (d / lastDay) * plotW;
  const y = (value: number) => PAD.top + plotH - (value / yMax) * plotH;
  const slot = plotW / lastDay;
  const every = [1, 2, 5, 7, 10, 14, 21, 28, 30].find((k) => Math.ceil(lastDay / k) <= Math.max(3, Math.floor(plotW / 90))) ?? 30;
  const xTicks: number[] = [];
  for (let d = 1; d <= lastDay; d += every) xTicks.push(d); // Day 1, then even steps (1, 8, 15… for weeks)
  const axisLabel = (value: number) => formatMoney({ usd: value, inr: value }, cur, lang);

  // ---- hover / focus ----
  const hoverAt = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || !marks.length) return;
    const px = clientX - rect.left;
    let best = 0;
    marks.forEach((m, i) => {
      const cx = view === 'total' ? x(m.x1) : x((m.x0 + m.x1) / 2);
      const bx = view === 'total' ? x(marks[best].x1) : x((marks[best].x0 + marks[best].x1) / 2);
      if (Math.abs(cx - px) < Math.abs(bx - px)) best = i;
    });
    setActive(best);
  };
  const current = active !== null && active < marks.length ? marks[active] : null;
  const readout = (m: Mark) =>
    view === 'total' ? formatFine(cur, m.money.usd, m.money.inr, lang) : formatMoney(m.money, cur, lang);

  // ---- marks ----
  const line = reported.map((m, i) => `${i ? 'L' : 'M'}${x(m.x1).toFixed(1)} ${y(m.value).toFixed(1)}`).join('');
  const linePath = reported.length ? `M${x(0)} ${y(0)}${line.replace(/^M/, 'L')}` : '';
  const area = reported.length ? `${linePath}L${x(reported.at(-1)!.x1)} ${y(0)}Z` : '';
  const last = reported.at(-1);
  const barW = Math.max(1, Math.min(24, slot - 2));
  const bar = (m: Mark) => {
    const cx = x((m.x0 + m.x1) / 2);
    const h = Math.max(m.value > 0 ? 1.5 : 0, y(0) - y(m.value));
    const r = Math.min(4, barW / 2, h);
    const x0 = cx - barW / 2;
    const top = y(0) - h;
    return `M${x0} ${y(0)}V${top + r}a${r} ${r} 0 0 1 ${r} ${-r}h${barW - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}V${y(0)}z`;
  };
  const tipX = current ? (view === 'total' ? x(current.x1) : x((current.x0 + current.x1) / 2)) : 0;
  const tipY = current ? y(current.value) : 0;

  return (
    <figure className="chart-card" aria-labelledby={titleId} data-reveal="">
      <div className="chart-head">
        <figcaption id={titleId}>{view === 'total' ? 'Worldwide total, day by day' : 'Collection each day'}</figcaption>
        <div className="segmented" role="group" aria-label="Show" data-index={view === 'total' ? 0 : 1}>
          <button type="button" aria-pressed={view === 'total'} onClick={() => { setView('total'); setActive(null); }}>Total</button>
          <button type="button" aria-pressed={view === 'daily'} onClick={() => { setView('daily'); setActive(null); }}>Per day</button>
        </div>
      </div>
      <div
        ref={box}
        className="chart"
        tabIndex={0}
        aria-label={`${view === 'total' ? 'Worldwide total by day' : 'Collection each day'}. Use the left and right arrow keys to read each day.`}
        onPointerMove={(e) => hoverAt(e.clientX)}
        onPointerDown={(e) => hoverAt(e.clientX)}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActive(null); }}
        onFocus={() => setActive((a) => a ?? marks.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            setActive((a) => Math.max(0, Math.min(marks.length - 1, (a ?? marks.length) + (e.key === 'ArrowLeft' ? -1 : 1))));
          } else if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault();
            setActive(e.key === 'Home' ? 0 : marks.length - 1);
          } else if (e.key === 'Escape') setActive(null);
        }}
      >
        <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} aria-hidden="true">
          {ticks.map((t) => (
            <g key={t} className="chart-grid">
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} />
              <text x={PAD.left + plotW + 8} y={y(t)} dy="0.32em">{t === 0 ? '0' : axisLabel(t)}</text>
            </g>
          ))}
          {xTicks.map((d) => (
            <text key={d} className="chart-x" x={view === 'total' ? x(d) : x(d - 0.5)} y={HEIGHT - 8} textAnchor="middle">{`Day ${d}`}</text>
          ))}
          {view === 'total' ? (
            <>
              <path className="chart-area" d={area} />
              <path className="chart-line" d={linePath} />
              {liveEnd && last ? (
                <path className="chart-line chart-estimate" d={`M${x(last.x1)} ${y(last.value)}L${x(liveEnd.x1)} ${y(liveEnd.value)}`} />
              ) : null}
              {last ? <circle className="chart-dot" cx={x(last.x1)} cy={y(last.value)} r={4} /> : null}
              {liveEnd ? <circle className="chart-dot chart-dot-estimate" cx={x(liveEnd.x1)} cy={y(liveEnd.value)} r={4} /> : null}
            </>
          ) : (
            marks.map((m, i) => (
              <path key={`${m.x0}-${m.estimate ? 'e' : 'r'}`} d={bar(m)}
                className={`chart-bar${m.estimate ? ' chart-bar-estimate' : ''}${i === active ? ' is-active' : ''}`} />
            ))
          )}
          {current ? (
            <>
              <line className="chart-crosshair" x1={tipX} x2={tipX} y1={PAD.top} y2={y(0)} />
              {view === 'total' ? <circle className="chart-dot chart-dot-active" cx={tipX} cy={tipY} r={5} /> : null}
            </>
          ) : null}
        </svg>
        {current ? (
          <div className="chart-tip" style={{ left: Math.min(Math.max(tipX, 70), width - 70), top: Math.max(tipY, 40) }}>
            <strong>{readout(current)}</strong>
            <span>{current.label} · {current.sub}</span>
          </div>
        ) : null}
        <p className="sr-only" aria-live="polite">{current ? `${current.label}, ${current.sub}: ${readout(current)}` : ''}</p>
      </div>
      {(view === 'total' && liveEnd) || (view === 'daily' && estimatedDays.length) ? (
        <p className="chart-key">
          {view === 'total' ? (
            <><span className="key-line" aria-hidden="true" />Reported <span className="key-line key-dashed" aria-hidden="true" />Live estimate since the last report</>
          ) : (
            <><span className="key-box" aria-hidden="true" />Reported <span className="key-box key-light" aria-hidden="true" />Estimate since the last report</>
          )}
        </p>
      ) : null}
    </figure>
  );
}
