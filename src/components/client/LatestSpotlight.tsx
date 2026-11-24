'use client';
// "In cinemas now" spotlight on the home page: a banner slider of the top films in cinemas, Indian and international.
//
// Each slide takes its accent colour from its own poster (sampled in a tiny canvas; Wikimedia serves posters
// with CORS), which tints the title, the figure box, the button and the swirl. Changing slides plays a swirl
// in the next film's colour: the old slide blurs and zooms out, a spinning vortex sweeps through, and the new
// slide settles out of a zoom-blur while its text rises line by line. Slides advance every 7 seconds; hovering,
// focusing or hiding the tab pauses them. With reduced motion there is no swirl and no autoplay.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CLIENT_TEXT } from '@/content/client-text';
import { formatMoney, type Currency } from '@/lib/format';
import { DAY, istMidnight, liveState, STEP } from '@/lib/live';
import type { LiveInfo, Money } from '@/lib/types';
import { ImdbRating } from '../ImdbRating';
import { useCurrency, useLang, useNow } from './hooks';

export interface SpotSlide {
  slug: string;
  title: string;
  poster: string;
  thumb: string;
  /** Your wide banner (public/banners/), shown sharp and full-bleed instead of the blurred poster. */
  banner: string | null;
  /** The Wikipedia poster, used if `poster` (your own high-resolution one) fails to load. */
  fallback: string;
  meta: string[];
  gross: Money;
  native: Currency;
  live: LiveInfo | null;
  release: string | null;
  showing: boolean;
  rank: number | null;
  rating: number | null;
  votes: number | null;
}

const AUTOPLAY = 7000;
const FALLBACK = 'hsl(38 92% 56%)';

/** The poster's most vivid colour, lifted to an accent that reads on the dark banner. */
function accentOf(img: HTMLImageElement): string | null {
  try {
    const c = document.createElement('canvas');
    c.width = 24;
    c.height = 36;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, 24, 36);
    const px = ctx.getImageData(0, 0, 24, 36).data;
    // Hue buckets weighted by saturation, so a big dull area does not beat a strong colour.
    const buckets = new Array(36).fill(0);
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const l = (max + min) / 2;
      const d = max - min;
      if (d < 0.12 || l < 0.12 || l > 0.92) continue;
      const s = d / (1 - Math.abs(2 * l - 1));
      let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
      buckets[Math.floor(h / 10)] += s * s;
    }
    const best = buckets.indexOf(Math.max(...buckets));
    if (buckets[best] === 0) return null;
    return `hsl(${best * 10 + 5} 85% 62%)`;
  } catch {
    return null; // a tainted canvas (no CORS): keep the default accent
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `header`: the page heading and search, shown in a row across the top of the banner. */
export function LatestSpotlight({ slides, header }: { slides: SpotSlide[]; header?: ReactNode }) {
  const lang = useLang();
  const text = CLIENT_TEXT[lang];
  const cur0 = useCurrency();
  const real = useNow();
  const [index, setIndex] = useState(0);
  const [swirl, setSwirl] = useState(0); // bumps on every change, to replay the swirl
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(false); // reduced motion
  const [accents, setAccents] = useState<Record<string, string>>({});
  // Your own images that failed to load (a file removed, a typo): those slides fall back to the Wikipedia poster.
  const [broken, setBroken] = useState<Record<string, true>>({});
  const breakImg = (url: string) => () => setBroken((b) => (b[url] ? b : { ...b, [url]: true }));
  const bannerOf = (s: SpotSlide) => (s.banner && !broken[s.banner] ? s.banner : null);
  const posterOf = (s: SpotSlide) => (broken[s.poster] ? s.fallback : s.poster);
  const root = useRef<HTMLElement>(null);

  const go = useCallback((next: number) => {
    const n = (next + slides.length) % slides.length;
    if (n === index) return;
    setIndex(n);
    setSwirl((s) => s + 1);
  }, [index, slides.length]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setStill(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Autoplay, paused while hovered or focused, while the tab is hidden, or with reduced motion.
  useEffect(() => {
    if (paused || still || slides.length < 2) return;
    const t = setTimeout(() => { if (document.visibilityState === 'visible') go(index + 1); }, AUTOPLAY);
    return () => clearTimeout(t);
  }, [index, paused, still, go, slides.length]);

  const onPoster = (slug: string) => (e: React.SyntheticEvent<HTMLImageElement>) => {
    const color = accentOf(e.currentTarget);
    if (color) setAccents((a) => (a[slug] ? a : { ...a, [slug]: color }));
  };

  if (!slides.length) return null;
  const active = slides[index];
  const accent = accents[active.slug] || FALLBACK;
  const upNext = [1, 2].map((k) => slides[(index + k) % slides.length]).filter((s) => s !== active);
  const step = real === null ? null : Math.floor(real / STEP) * STEP;
  const figure = (s: SpotSlide) => {
    const cur = cur0 || s.native;
    const state = s.live && step !== null ? liveState({ ...s.gross, ...s.live }, step) : null;
    return { cur, total: formatMoney(state ?? s.gross, cur, lang), today: state && state.today.inr > 0 ? formatMoney(state.today, cur, lang) : null };
  };
  const dayOf = (s: SpotSlide) => {
    if (!s.release || !s.showing) return null;
    const now = real ?? Date.parse(`${s.release}T12:00:00Z`);
    return Math.max(1, Math.floor((now - istMidnight(s.release)) / DAY) + 1);
  };

  return (
    <section
      ref={root}
      className={`spot${still ? ' is-still' : ''}${paused ? ' is-paused' : ''}${bannerOf(active) ? ' on-banner' : ''}`}
      style={{ '--accent-spot': accent } as CSSProperties}
      aria-roledescription="carousel"
      aria-label={text.spotKicker}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => { if (!root.current?.contains(e.relatedTarget as Node)) setPaused(false); }}
      onKeyDown={(e) => { if (e.key === 'ArrowRight') go(index + 1); if (e.key === 'ArrowLeft') go(index - 1); }}
    >
      {/* Backdrops: every slide's poster, blurred; only the active one is shown. */}
      <div className="spot-bg" aria-hidden="true">
        {slides.map((s, i) => (
          <img key={`${s.slug}:${bannerOf(s) || posterOf(s)}`} className={[i === index ? 'is-active' : '', bannerOf(s) ? 'is-banner' : ''].join(' ').trim() || undefined}
            src={bannerOf(s) || posterOf(s)} alt="" decoding="async" fetchPriority={i === 0 ? 'high' : undefined}
            loading={i === 0 ? 'eager' : 'lazy'} crossOrigin="anonymous" onLoad={onPoster(s.slug)} onError={breakImg(bannerOf(s) || posterOf(s))} />
        ))}
        <span className="spot-tint" />
        {!still && swirl ? <span key={swirl} className="spot-swirl" /> : null}
      </div>
      {header ? <div className="spot-top">{header}</div> : null}

      <div className="spot-stage">
        {slides.map((s, i) => {
          const on = i === index;
          const f = figure(s);
          const day = dayOf(s);
          const kicker = [s.rank ? text.spotRank(s.rank) : null, day ? text.day(day) : null].filter(Boolean).join(' · ');
          return (
            <article key={s.slug} className={`spot-slide${on ? ' is-active' : ''}${bannerOf(s) ? ' has-banner' : ''}`} aria-hidden={!on}
              aria-roledescription="slide" aria-label={`${i + 1} / ${slides.length}`}
              style={{ '--accent-slide': accents[s.slug] || FALLBACK } as CSSProperties}>
              <div className="spot-copy">
                <p className="spot-kicker" style={{ '--i': 0 } as CSSProperties}>
                  <span>{text.spotKicker}</span>{kicker ? <b>{kicker}</b> : null}
                </p>
                {/* Not a heading: five slide titles would come before the page's real section headings. */}
                <p className="spot-title" style={{ '--i': 1 } as CSSProperties}>
                  <a href={`/movie/${s.slug}/`} tabIndex={on ? 0 : -1}>{s.title}</a>
                </p>
                {s.meta.length || s.rating ? (
                  <p className="spot-meta" style={{ '--i': 2 } as CSSProperties}>
                    {s.rating ? <ImdbRating value={s.rating} votes={s.votes ?? undefined} /> : null}
                    <span>{s.meta.join(' · ')}</span>
                  </p>
                ) : null}
                <div className="spot-tag" style={{ '--i': 3 } as CSSProperties}>
                  <span className="spot-tag-label">{f.today ? text.today(f.today) : text.spotTotal}</span>
                  <span className="spot-tag-box">{f.total} <small>{text.spotWorldwide}</small></span>
                </div>
              </div>
              <a className="spot-art" href={`/movie/${s.slug}/`} tabIndex={-1} aria-hidden="true">
                <img src={posterOf(s)} alt="" decoding="async" loading={i === 0 ? 'eager' : 'lazy'} onError={breakImg(posterOf(s))} />
              </a>
              <a className="spot-play" href={`/movie/${s.slug}/`} tabIndex={on ? 0 : -1} aria-label={`${text.spotCta}: ${s.title}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
              </a>
            </article>
          );
        })}
      </div>

      <div className="spot-bar">
        <a className="spot-cta" href={`/movie/${active.slug}/`}>{text.spotCta}</a>
        <div className="spot-next">
          <span className="spot-next-label">{text.spotUpNext}</span>
          {upNext.map((s) => (
            <button key={s.slug} type="button" className="spot-mini" onClick={() => go(slides.indexOf(s))}>
              <img src={s.thumb} alt="" width={40} height={60} loading="lazy" decoding="async" />
              <span><b>{s.title}</b><small>{figure(s).total} {text.spotWorldwide}</small></span>
            </button>
          ))}
        </div>
        <div className="spot-count" role="tablist" aria-label={text.spotKicker}>
          {slides.map((s, i) => (
            <button key={s.slug} type="button" role="tab" aria-selected={i === index} aria-label={s.title}
              className={i === index ? 'is-active' : undefined} onClick={() => go(i)}>
              {pad(i + 1)}
              {i === index && !still ? <i key={`${index}-${swirl}`} style={{ animationDuration: `${AUTOPLAY}ms` }} /> : null}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
