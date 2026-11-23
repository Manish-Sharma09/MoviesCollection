'use client';
// "Head to head": a film's reported worldwide total, day by day since release, against up to three comparable
// films (src/lib/film-stats.ts picks them). Each card compares a film with this one on the last day both have
// figures for, so neither gets extra days; the chart draws
// each run as a line, this film solid and the others in distinct dash patterns (so colour is never the only cue).
// Hover, tap or the arrow keys read every film's total on any day.
import { useEffect, useRef, useState } from 'react';
import { formatMoney, type Currency } from '@/lib/format';
import type { Series } from '@/lib/film-stats';
import { niceTicks } from '../CollectionChart';
import { useCurrency, useLang } from '../hooks';
import { EASE, gsap, MOTION_OK, motionOn, ScrollTrigger, useGSAP } from '../motion/gsap';

const HEIGHT = 240;
const PAD = { top: 12, right: 72, bottom: 28, left: 4 };
const DASHES = ['', '7 5', '2 4', '12 4 2 4'];

export function HeadToHead({ series, native }: { series: Series[]; native: Currency }) {
  const lang = useLang();
  const mode = useCurrency();
  const cur = mode || native;
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useGSAP(() => {
    if (!motionOn() || !box.current) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      const q = gsap.utils.selector(box);
      const tl = gsap.timeline({ paused: true, defaults: { ease: EASE } });
      tl.from(q('.h2h-line'), { drawSVG: 0, duration: 1.3, ease: 'power2.inOut', stagger: 0.12 })
        .from(q('.h2h-area, .h2h-now'), { autoAlpha: 0, duration: 0.6 }, 0.6)
        .set(q('.h2h-line'), { clearProps: 'strokeDasharray,strokeDashoffset' });
      ScrollTrigger.create({ trigger: box.current, start: 'top 85%', once: true, onEnter: () => { tl.play(); } });
    });
  }, { scope: box });

  const v = (p: [number, number, number]) => (cur === 'INR' ? p[2] : p[1]);
  /** A run's total on a day (its latest report up to then); null before its first report or after its last. */
  const valueAt = (s: Series, day: number) => {
    if (day > s.points.at(-1)![0]) return null;
    let out: number | null = null;
    for (const p of s.points) if (p[0] <= day) out = v(p);
    return out;
  };
  const fmt = (n: number) => formatMoney({ usd: n, inr: n }, cur, lang);

  const self = series[0];
  const dayN = self.points.at(-1)![0];
  const mine = valueAt(self, dayN) ?? 0;
  const cards = series.map((s, i) => {
    const day = Math.min(dayN, s.points.at(-1)![0]);
    return { s, i, day, value: valueAt(s, day), mineThen: valueAt(self, day) ?? 0 };
  });

  const lastDay = Math.max(...series.map((s) => s.points.at(-1)![0]));
  const ticks = niceTicks(Math.max(...series.flatMap((s) => s.points.map(v)), 0));
  const yMax = ticks.at(-1) || 1;
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (d: number) => PAD.left + (d / lastDay) * plotW;
  const y = (value: number) => PAD.top + plotH - (value / yMax) * plotH;
  const path = (s: Series) => `M${x(0)} ${y(0)}${s.points.map((p) => `L${x(p[0]).toFixed(1)} ${y(v(p)).toFixed(1)}`).join('')}`;
  const every = [1, 2, 5, 7, 10, 14, 21, 28].find((k) => Math.ceil(lastDay / k) <= Math.max(3, Math.floor(plotW / 90))) ?? 28;
  const xTicks: number[] = [];
  for (let d = 1; d <= lastDay; d += every) xTicks.push(d);

  const hoverAt = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    const d = Math.round(((clientX - rect.left - PAD.left) / plotW) * lastDay);
    setActive(Math.max(1, Math.min(lastDay, d)));
  };
  const tipRows = active !== null
    ? series.map((s, i) => ({ s, i, value: valueAt(s, active) })).filter((r) => r.value !== null)
    : [];

  return (
    <div className="h2h">
      <ol className="h2h-cards">
        {cards.map(({ s, i, day, value, mineThen }) => (
          <li key={s.slug} className={s.self ? 'h2h-card is-self' : 'h2h-card'}>
            <span className="h2h-name">
              <svg className="h2h-swatch" viewBox="0 0 24 4" aria-hidden="true"><line x1="0" y1="2" x2="24" y2="2" strokeDasharray={DASHES[i]} /></svg>
              {s.self ? <span>{s.title}</span> : <a href={`/movie/${s.slug}/`}>{s.title}</a>}
            </span>
            <b className="m">{value === null ? '—' : fmt(value)}</b>
            {!s.self && value !== null ? (
              <small>{`by Day ${day} · `}{value >= mineThen ? `${fmt(value - mineThen)} ahead` : `${fmt(mineThen - value)} behind`}</small>
            ) : <small>{`by Day ${dayN}`}</small>}
          </li>
        ))}
      </ol>
      <div
        ref={box}
        className="chart h2h-chart"
        tabIndex={0}
        aria-label={`Worldwide total by day of release for ${series.map((s) => s.title).join(', ')}. Use the arrow keys to read each day.`}
        onPointerMove={(e) => hoverAt(e.clientX)}
        onPointerDown={(e) => hoverAt(e.clientX)}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActive(null); }}
        onFocus={() => setActive((a) => a ?? dayN)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            setActive((a) => Math.max(1, Math.min(lastDay, (a ?? dayN) + (e.key === 'ArrowLeft' ? -1 : 1))));
          } else if (e.key === 'Escape') setActive(null);
        }}
      >
        <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} aria-hidden="true">
          {ticks.map((t) => (
            <g key={t} className="chart-grid">
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} />
              <text x={PAD.left + plotW + 8} y={y(t)} dy="0.32em">{t === 0 ? '0' : fmt(t)}</text>
            </g>
          ))}
          {xTicks.map((d) => <text key={d} x={x(d)} y={HEIGHT - 8} textAnchor="middle">{`Day ${d}`}</text>)}
          <line className="h2h-now" x1={x(dayN)} x2={x(dayN)} y1={PAD.top} y2={y(0)} />
          <path className="h2h-area" d={`${path(self)}L${x(dayN)} ${y(0)}Z`} />
          {series.map((s, i) => i).reverse().map((i) => (
            <path key={series[i].slug} className={series[i].self ? 'h2h-line is-self' : 'h2h-line'} d={path(series[i])}
              strokeDasharray={DASHES[i] || undefined} />
          ))}
          <circle className="chart-dot h2h-dot" cx={x(dayN)} cy={y(mine)} r={4} />
          {active !== null ? <line className="chart-crosshair" x1={x(active)} x2={x(active)} y1={PAD.top} y2={y(0)} /> : null}
        </svg>
        {active !== null && tipRows.length ? (
          <div className="chart-tip h2h-tip" style={{ left: Math.min(Math.max(x(active), 96), width - 96), top: PAD.top + 8 }}>
            <span>Day {active}</span>
            {tipRows.sort((a, b) => b.value! - a.value!).map(({ s, value }) => (
              <span key={s.slug} className={s.self ? 'is-self' : undefined}><em>{s.title}</em> <strong className="m">{fmt(value!)}</strong></span>
            ))}
          </div>
        ) : null}
        <p className="sr-only" aria-live="polite">
          {active !== null ? `Day ${active}: ${tipRows.map(({ s, value }) => `${s.title} ${fmt(value!)}`).join(', ')}` : ''}
        </p>
      </div>
    </div>
  );
}
