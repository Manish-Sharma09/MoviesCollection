'use client';
// The page's <main>, with its scroll animations (same markup as a plain <main>):
// - elements marked data-reveal fade up a few at a time as they scroll into view (ScrollTrigger.batch);
// - numbers marked data-countup inside them count up from 0;
// - ranking bars grow from the left, the way chart bars should enter (first 40 rows of each list).
// Everything plays once. Nothing runs when the visitor prefers reduced motion (gsap.matchMedia), and
// the stylesheet only hides elements while `motion` is set and `motion-ready` is not (see theme.ts).
import { useRef, type ReactNode } from 'react';
import { whenIntroDone } from '../intro-state';
import { EASE, gsap, MOTION_OK, motionOn, motionReady, ScrollTrigger, useGSAP } from './gsap';

const BARS_PER_LIST = 40;

export function MotionMain({ children }: { children: ReactNode }) {
  const main = useRef<HTMLElement>(null);

  useGSAP(() => {
    if (!motionOn()) {
      motionReady();
      return;
    }
    const mm = gsap.matchMedia();
    // Callbacks that run later (scroll batches, count-ups) must be wrapped by the contextSafe that
    // matchMedia hands its own callback, not useGSAP's. useGSAP's belongs to the outer context: calling it
    // in here links the two contexts both ways (a batch fires synchronously when 8 or more items are
    // already on screen), and reverting them then recurses forever ("Maximum call stack size exceeded").
    mm.add(MOTION_OK, (_context, contextSafe) => {
      if (!contextSafe) return;
      const safe = <T extends (...args: never[]) => void>(fn: T) => contextSafe(fn) as T;
      const q = gsap.utils.selector(main);

      const countUp = safe((el: HTMLElement) => {
        const end = Number(el.dataset.countup);
        if (!Number.isFinite(end)) return;
        const counter = { value: 0 };
        const show = () => { el.textContent = Math.round(counter.value).toLocaleString('en-IN'); };
        show();
        gsap.to(counter, { value: end, duration: 1.4, ease: EASE, onUpdate: show });
      });

      // Starting states are set now; the scroll triggers start once the intro overlay (if any) opens, so
      // what is on screen animates in as it is revealed rather than unseen underneath it.
      const later: (() => void)[] = [];
      whenIntroDone().then(safe(() => later.forEach((start) => start())));

      // 1. Fade up as they enter, in small staggered groups.
      const items = q('[data-reveal]') as HTMLElement[];
      if (items.length) gsap.set(items, { autoAlpha: 0, y: 24 });
      if (items.length) later.push(() => ScrollTrigger.batch(items, {
        start: 'top 92%',
        once: true,
        interval: 0.1,
        batchMax: 8,
        onEnter: safe((batch: Element[]) => {
          // clearProps hands the element back to the stylesheet (e.g. :active press feedback uses transform).
          gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.8, ease: EASE, stagger: 0.06, overwrite: true, clearProps: 'all' });
          batch.forEach((el) => el.querySelectorAll<HTMLElement>('[data-countup]').forEach(countUp));
        }),
      }));

      // 2. Ranking bars grow from the left as their rows come into view.
      for (const list of q('.ranks') as HTMLElement[]) {
        const rows = [...list.children].slice(0, BARS_PER_LIST) as HTMLElement[];
        const barOf = (row: Element) => row.querySelector('.bar i');
        const bars = rows.map(barOf).filter(Boolean);
        if (!bars.length) continue;
        gsap.set(bars, { scaleX: 0, transformOrigin: 'left center' });
        later.push(() => ScrollTrigger.batch(rows, {
          start: 'top 95%',
          once: true,
          interval: 0.1,
          onEnter: safe((batch: Element[]) => {
            gsap.to(batch.map(barOf).filter(Boolean), { scaleX: 1, duration: 1.1, ease: EASE, stagger: 0.04, clearProps: 'transform' });
          }),
        }));
      }

      // 3. Day-by-day bars on film pages (open weeks only) grow to their length (data-w) the same way.
      const dayRows = q('.week[open] .day-row') as HTMLElement[];
      const dayBar = (row: Element) => row.querySelector<HTMLElement>('.day-bar i[data-w]');
      const dayBars = dayRows.map(dayBar).filter((b): b is HTMLElement => Boolean(b));
      if (dayBars.length) {
        gsap.set(dayBars, { scaleX: 0, transformOrigin: 'left center' });
        later.push(() => ScrollTrigger.batch(dayRows, {
          start: 'top 95%',
          once: true,
          interval: 0.1,
          onEnter: safe((batch: Element[]) => {
            const bars = batch.map(dayBar).filter((b): b is HTMLElement => Boolean(b));
            gsap.to(bars, { scaleX: (_i: number, el: HTMLElement) => Number(el.dataset.w), duration: 1, ease: EASE, stagger: 0.04 });
          }),
        }));
      }
    });
    // Starting states are set (or animations are off): the stylesheet can stop hiding things.
    motionReady();
  }, { scope: main });

  return <main id="main" className="wrap" ref={main}>{children}</main>;
}
