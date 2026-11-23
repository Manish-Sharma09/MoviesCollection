'use client';
// The film page's banner: the film's own poster (the only artwork the site may use; see README), enlarged
// across the right of the board and faded into the dark. It drifts slowly (CSS), and follows the pointer:
// the banner shifts, the small poster tilts and a soft light follows the cursor. The pointer position is
// written to CSS variables on the board (--mx/--my from -1 to 1, --px/--py in %), so all motion is CSS and
// nothing re-renders. Nothing moves when the device asks for reduced motion (site.css).
import { useEffect, useRef, useState } from 'react';

/** `wide`: your own landscape banner (public/banners/), shown sharp across the board instead of the poster panel. */
export function BoardBanner({ src, wide = false, fallback = '' }: { src: string; wide?: boolean; fallback?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  // If your own banner fails to load (removed, misnamed), show the Wikipedia poster panel instead.
  const [failed, setFailed] = useState(false);
  const url = failed && fallback ? fallback : src;
  const isWide = wide && !failed;

  useEffect(() => {
    const board = ref.current?.parentElement;
    if (!board || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let frame = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = board.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        board.style.setProperty('--mx', (x * 2 - 1).toFixed(3));
        board.style.setProperty('--my', (y * 2 - 1).toFixed(3));
        board.style.setProperty('--px', `${(x * 100).toFixed(1)}%`);
        board.style.setProperty('--py', `${(y * 100).toFixed(1)}%`);
        board.classList.add('is-pointing');
      });
    };
    const leave = () => {
      cancelAnimationFrame(frame);
      board.classList.remove('is-pointing');
      for (const v of ['--mx', '--my', '--px', '--py']) board.style.removeProperty(v);
    };
    board.addEventListener('pointermove', move);
    board.addEventListener('pointerleave', leave);
    return () => {
      cancelAnimationFrame(frame);
      board.removeEventListener('pointermove', move);
      board.removeEventListener('pointerleave', leave);
    };
  }, []);

  return (
    <span className="board-glow" aria-hidden="true" ref={ref}>
      <img className={isWide ? 'board-banner is-wide' : 'board-banner'} src={url} alt="" decoding="async" fetchPriority="high"
        onError={() => { if (!failed && fallback && fallback !== src) setFailed(true); }} />
      <img className="board-backdrop" src={url} alt="" decoding="async" />
      <span className="board-light" />
    </span>
  );
}
