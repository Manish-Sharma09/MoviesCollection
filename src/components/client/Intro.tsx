'use client';
// Runs the intro overlay (src/components/Intro.tsx) when the head script turned it on:
// 1. starts loading the 3D ticket (three.js) straight away, unless WebGL 2 is missing or the connection is 2G;
//    when it is ready it takes over from the flat logo in the same place;
// 2. waits for the page to finish loading, for at least MIN_MS after the visit began and, once the 3D ticket
//    is up, for at least SCENE_MIN_MS so it is seen; never past MAX_MS, and a tap, key or scroll skips;
// 3. tears the overlay open (CSS) while the ticket spins away, starts the page's entrance animations, and
//    removes everything.
import { useEffect } from 'react';
import { announceIntroDone } from './intro-state';
import type { IntroScene } from './three/intro-scene';

/** Times since the visit began (performance.now() counts from navigation start). */
const MIN_MS = 1800;
const MAX_MS = 4500;
const SCENE_MIN_MS = 1300;
/** The overlay's exit in site.css: the tear, then the halves part (keep in step with .intro-out). */
const EXIT_MS = 900;
/** When the halves start to part, the page's own entrance animations begin. */
const REVEAL_AT_MS = 250;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, ms)));

function hasWebGL2() {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

function slowConnection() {
  const c = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  return Boolean(c?.effectiveType && /2g$/.test(c.effectiveType));
}

export function IntroController() {
  useEffect(() => {
    const html = document.documentElement;
    const root = document.getElementById('intro');
    if (!root || !html.classList.contains('preload') || html.dataset.intro === 'done') return;
    const canvas = root.querySelector('canvas');
    const mark = root.querySelector<HTMLElement>('.intro-mark');
    if (!canvas || !mark) return;

    let cancelled = false;
    let leaving = false;
    let scene: IntroScene | null = null;
    let shownAt = 0;

    const sceneReady = hasWebGL2() && !slowConnection()
      ? import('./three/intro-scene')
        .then(({ createIntroScene }) => {
          if (cancelled || leaving) return;
          scene = createIntroScene(canvas, mark);
          if (scene) {
            root.classList.add('is-3d');
            shownAt = performance.now();
          }
        })
        .catch(() => undefined)
      : Promise.resolve();

    const loaded = document.readyState === 'complete'
      ? Promise.resolve()
      : new Promise<void>((r) => window.addEventListener('load', () => r(), { once: true }));

    let skip = () => {};
    const skipped = new Promise<void>((r) => { skip = r; });
    const onSkip = () => skip();
    const SKIP_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchmove'] as const;
    SKIP_EVENTS.forEach((e) => window.addEventListener(e, onSkip, { passive: true }));
    const stopListening = () => SKIP_EVENTS.forEach((e) => window.removeEventListener(e, onSkip));

    const ready = Promise.all([loaded, sceneReady]).then(() => {
      const now = performance.now();
      return wait(Math.max(MIN_MS - now, shownAt ? SCENE_MIN_MS - (now - shownAt) : 0));
    });

    Promise.race([ready, skipped, wait(MAX_MS - performance.now())]).then(async () => {
      if (cancelled || leaving) return;
      leaving = true;
      stopListening();
      root.classList.add('intro-out');
      const reveal = setTimeout(announceIntroDone, REVEAL_AT_MS);
      await Promise.all([scene?.exit(), wait(EXIT_MS)]);
      clearTimeout(reveal);
      html.classList.remove('preload');
      announceIntroDone();
      scene?.dispose();
      scene = null;
      root.classList.remove('is-3d', 'intro-out');
    });

    return () => {
      cancelled = true;
      stopListening();
      scene?.dispose();
      scene = null;
    };
  }, []);

  return null;
}
