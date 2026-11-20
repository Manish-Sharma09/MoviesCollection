'use client';
// The home page hero's entrance: the backdrop settles from a slight zoom while the headline's lines slide
// up out of their masks (SplitText, lines only, so Devanagari conjuncts are never broken apart), then the
// intro, search, buttons and the featured poster follow. Plays once, on load; nothing runs when the
// visitor prefers reduced motion. Only transforms and opacity are animated, and the backdrop (the page's
// largest image) is never hidden, so it does not delay the first paint.
import { useRef, type ReactNode } from 'react';
import { EASE, gsap, MOTION_OK, motionOn, SplitText, useGSAP } from './gsap';

export function HeroMotion({ className, children }: { className: string; children: ReactNode }) {
  const hero = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!motionOn()) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      const q = gsap.utils.selector(hero);
      const heading = q('h1')[0] as HTMLElement | undefined;
      const split = heading ? SplitText.create(heading, { type: 'lines', mask: 'lines' }) : null;
      if (heading) gsap.set(heading, { autoAlpha: 1 }); // its lines start hidden below their masks instead

      const tl = gsap.timeline({ defaults: { ease: EASE, duration: 0.9 } });
      tl.from(q('.hero-backdrop'), { scale: 1.08, duration: 2 }, 0)
        .from(q('.hero-kicker'), { autoAlpha: 0, y: 12 }, 0.1)
        .from(split?.lines ?? [], { yPercent: 110, duration: 1.05, stagger: 0.1 }, 0.15)
        .from(q('.hero-intro'), { autoAlpha: 0, y: 16 }, 0.45)
        .from(q('.search'), { autoAlpha: 0, y: 16 }, 0.55)
        .from(q('.hero-actions > *'), { autoAlpha: 0, y: 16, stagger: 0.08 }, 0.62)
        .from(q('.hero-feature'), { autoAlpha: 0, y: 28, scale: 0.96, duration: 1.1 }, 0.35);
      // Once played: back to the original markup (so the headline reflows normally on resize) and no
      // leftover inline styles (so the stylesheet's hover and press states apply).
      tl.eventCallback('onComplete', () => {
        split?.revert();
        gsap.set(q('.hero-backdrop, .hero-kicker, .hero-intro, .search, .hero-actions > *, .hero-feature'), { clearProps: 'all' });
      });
      return () => split?.revert();
    });
  }, { scope: hero });

  return <div ref={hero} className={className}>{children}</div>;
}
