'use client';
// Small interactive parts of the film page: the day of the run, Share, a horizontal shelf's arrow buttons and
// tabbed sections. Each renders the build-time state first and updates after hydration.
import { useRef, useState, type ReactNode } from 'react';
import { DAY, istMidnight } from '@/lib/live';
import { useNow } from '../hooks';

/** "Day 19": the day of the run, India time (1 = release day). */
export function RunDay({ release, initial }: { release: string; initial: number }) {
  const now = useNow();
  const day = now === null ? initial : Math.floor((now - istMidnight(release)) / DAY) + 1;
  return <>Day {Math.max(1, day)}</>;
}

/** Shares the page with the system share sheet where there is one, otherwise copies its address. */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href.split('#')[0];
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch { /* dismissed */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };
  return (
    <button type="button" className="share-button" onClick={share}>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10V2.5M5 5.5l3-3 3 3M3.5 8.5v4a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-4" /></svg>
      <span aria-live="polite">{copied ? 'Link copied' : 'Share'}</span>
    </button>
  );
}

/** A horizontal shelf with previous/next buttons (pointer devices; touch scrolls natively). */
export function Shelf({ label, children }: { label: string; children: ReactNode }) {
  const list = useRef<HTMLDivElement>(null);
  const move = (dir: number) => {
    const el = list.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };
  return (
    <div className="shelf">
      <div className="shelf-buttons">
        <button type="button" className="round-button" onClick={() => move(-1)} aria-label={`Scroll ${label} back`}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10 3-5 5 5 5" /></svg>
        </button>
        <button type="button" className="round-button" onClick={() => move(1)} aria-label={`Scroll ${label} forward`}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
        </button>
      </div>
      <div className="shelf-track" ref={list}>{children}</div>
    </div>
  );
}

/**
 * A section with a title and one row of tabs between views (e.g. Each day | Running total). Every view is
 * rendered on the server; the tabs only show one at a time, so the page reads fine before hydration.
 */
export function TabbedBlock({ id, title, labels, footer, children }: {
  id: string; title: string; labels: string[]; footer?: ReactNode; children: ReactNode[];
}) {
  const [active, setActive] = useState(0);
  return (
    <section className="block" aria-labelledby={id}>
      <div className="block-head">
        <h2 id={id}>{title}</h2>
        <div className="tabs" role="tablist" aria-label={title}>
          {labels.map((label, i) => (
            <button key={label} type="button" role="tab" id={`${id}-tab-${i}`} aria-selected={i === active} aria-controls={`${id}-view-${i}`}
              tabIndex={i === active ? 0 : -1} onClick={() => setActive(i)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                const next = (i + (e.key === 'ArrowRight' ? 1 : labels.length - 1)) % labels.length;
                setActive(next);
                document.getElementById(`${id}-tab-${next}`)?.focus();
              }}>{label}</button>
          ))}
        </div>
      </div>
      <div className="block-card">
        {children.map((view, i) => (
          <div key={i} id={`${id}-view-${i}`} role="tabpanel" aria-labelledby={`${id}-tab-${i}`} hidden={i !== active}>{view}</div>
        ))}
        {footer}
      </div>
    </section>
  );
}
