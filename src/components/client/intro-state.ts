// Whether the intro overlay (src/components/Intro.tsx) is still covering the page. Entrance animations
// wait for it, so they play as the overlay opens instead of unseen underneath it.
import { INTRO_DONE_EVENT } from '@/lib/theme';

const introOver = () => {
  const html = document.documentElement;
  return !html.classList.contains('preload') || html.dataset.intro === 'done';
};

/** Resolves when the page is visible: at once when there is no intro, otherwise as the overlay starts to open. */
export function whenIntroDone(): Promise<void> {
  if (introOver()) return Promise.resolve();
  return new Promise((resolve) => window.addEventListener(INTRO_DONE_EVENT, () => resolve(), { once: true }));
}

/** Marks the intro as over and lets waiting animations start (the overlay may still be animating away). */
export function announceIntroDone() {
  const html = document.documentElement;
  if (html.dataset.intro === 'done') return;
  html.dataset.intro = 'done';
  window.dispatchEvent(new Event(INTRO_DONE_EVENT));
}
