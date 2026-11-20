'use client';
// The home hero's featured film. The page is built with one poster and its caption (what phones,
// reduced-motion settings, data saver and browsers without WebGL 2 keep). On larger screens it then
// becomes a 3D stack of the films in cinemas (poster-stack.ts, three.js loaded on demand): the caption
// follows the film at the front, and small controls step through the films or pause the automatic moves.
import { useEffect, useRef, useState } from 'react';
import type { Currency } from '@/lib/format';
import { Money, SafeImg } from '../basics';
import { gsap } from '../motion/gsap';
import type { StackHandle } from './poster-stack';

export interface StackFilm {
  slug: string;
  title: string;
  /** Poster address ('' when the film has none: the card shows its first letter). */
  poster: string;
  gross: { usd: number; inr: number };
  native: Currency;
}

export interface StackLabels {
  featured: string;
  reported: string;
  group: string;
  previous: string;
  next: string;
  pause: string;
  play: string;
}

/** Where the 3D stack is worth it: room beside the headline, motion allowed. */
const STACK_MEDIA = '(min-width: 761px) and (prefers-reduced-motion: no-preference)';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Resolves once the page has loaded and the hero's entrance animation has finished (so nothing moves under the swap). */
async function heroSettled(link: HTMLElement) {
  if (document.readyState !== 'complete') await new Promise((r) => window.addEventListener('load', r, { once: true }));
  const until = performance.now() + 6000;
  while (performance.now() < until) {
    const style = getComputedStyle(link);
    if (!gsap.isTweening(link) && style.visibility === 'visible' && style.opacity === '1' && style.transform === 'none') break;
    await wait(150);
  }
  await new Promise((r) => (window.requestIdleCallback ? window.requestIdleCallback(r, { timeout: 1500 }) : setTimeout(r, 200)));
}

const Chevron = ({ flip = false }: { flip?: boolean }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true"><path d={flip ? 'm10 3-5 5 5 5' : 'm6 3 5 5-5 5'} /></svg>
);

export function HeroFeature({ films, start, labels }: { films: StackFilm[]; start: number; labels: StackLabels }) {
  const [index, setIndex] = useState(start);
  const [posterIndex, setPosterIndex] = useState(start);
  const [stacked, setStacked] = useState(false);
  const [paused, setPaused] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const stageRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const stackRef = useRef<StackHandle | null>(null);
  const indexRef = useRef(start);
  const pausedRef = useRef(false);

  useEffect(() => {
    const stage = stageRef.current!;
    const wrap = wrapRef.current!;
    const link = linkRef.current!;
    const anchor = anchorRef.current!;
    const hero = wrap.closest<HTMLElement>('.hero');
    const textColumn = hero?.querySelector<HTMLElement>('.hero-content');
    if (films.length < 2 || !hero || !textColumn) return;
    const media = window.matchMedia(STACK_MEDIA);
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    let alive = true;
    let starting = false;

    const stop = () => {
      stackRef.current?.destroy();
      stackRef.current = null;
      setStacked(false);
      setPosterIndex(indexRef.current); // the page's poster shows the film the stack stopped at
    };

    const begin = async () => {
      if (starting || stackRef.current || !media.matches || saveData || typeof WebGL2RenderingContext === 'undefined') return;
      starting = true;
      try {
        await heroSettled(link);
        if (!alive || !media.matches) return;
        const { createPosterStack } = await import('./poster-stack');
        if (!alive || !media.matches) return;
        const handle = await createPosterStack({
          hero, host: stage, textColumn, anchor, link, pauseWithin: [wrap, stage],
          posters: films.map((f) => ({ url: f.poster, title: f.title })),
          start: indexRef.current,
          onChange: (i, byUser) => {
            indexRef.current = i;
            setIndex(i);
            if (byUser) setAnnouncement(films[i].title);
          },
          onReady: () => {
            setPosterIndex(indexRef.current);
            setStacked(true);
          },
          onLost: stop,
        });
        if (!alive) handle.destroy();
        else {
          stackRef.current = handle;
          handle.setPlaying(!pausedRef.current);
        }
      } catch {
        // No WebGL context, or the module failed to load: the page keeps its own poster.
      } finally {
        starting = false;
      }
    };

    const onMedia = () => (media.matches ? void begin() : stop());
    media.addEventListener('change', onMedia);
    void begin();
    return () => {
      alive = false;
      media.removeEventListener('change', onMedia);
      stop();
    };
  }, [films]);

  const film = films[index];
  // While the stack shows, the page's (hidden) poster stays put rather than loading every film's image.
  const posterFilm = films[stacked ? posterIndex : index];

  const togglePause = () => {
    const next = !paused;
    pausedRef.current = next;
    setPaused(next);
    stackRef.current?.setPlaying(!next);
  };

  return (
    <>
      <div className="hero-stage" ref={stageRef} aria-hidden="true" />
      <div className="hero-feature-wrap" ref={wrapRef}>
        <a className="hero-feature" href={`/movie/${film.slug}/`} ref={linkRef}>
          <span className="poster" aria-hidden="true" ref={anchorRef}>
            <span className="poster-letter">{posterFilm.title.trim().slice(0, 1)}</span>
            {posterFilm.poster ? (
              <SafeImg key={posterFilm.slug} src={posterFilm.poster} alt="" width={342} height={513} decoding="async" fetchPriority="high" />
            ) : null}
          </span>
          <span className="hero-feature-caption">
            <small>{labels.featured}</small><strong>{film.title}</strong>
            <span title={labels.reported}><Money {...film.gross} native={film.native} /></span>
          </span>
        </a>
        {stacked ? (
          <div className="hero-stack-controls" role="group" aria-label={labels.group}>
            <button type="button" title={labels.previous} onClick={() => stackRef.current?.step(-1)}>
              <span className="sr-only">{labels.previous}</span><Chevron flip />
            </button>
            <button type="button" title={paused ? labels.play : labels.pause} aria-pressed={paused} onClick={togglePause}>
              <span className="sr-only">{labels.pause}</span>
              {paused
                ? <svg viewBox="0 0 16 16" aria-hidden="true" className="filled"><path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5Z" /></svg>
                : <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3.5v9M10.5 3.5v9" /></svg>}
            </button>
            <button type="button" title={labels.next} onClick={() => stackRef.current?.step(1)}>
              <span className="sr-only">{labels.next}</span><Chevron />
            </button>
          </div>
        ) : null}
        <p className="sr-only" aria-live="polite">{announcement}</p>
      </div>
    </>
  );
}
