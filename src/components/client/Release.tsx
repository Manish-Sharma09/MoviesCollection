'use client';
// Upcoming films. ReleaseIn is the short "Releases in 5 days" / "Out now · Day 2" line on cards; ReleaseCountdown is
// the board of an upcoming film's page: a countdown to release (midnight India time), then from release day "in
// cinemas" with the day of the run. From release day the page checks /live.json every minute, and once the film
// has its first reported figure it reloads: the same address is then its box office page with the live counter.
import { useEffect, useState } from 'react';
import { CLIENT_TEXT } from '@/content/client-text';
import { DAY, istMidnight } from '@/lib/live';
import { dayOfRun, releaseInText } from '@/lib/release';
import { useLang, useNow } from './hooks';

/** "Releases in 5 days", "Releases tomorrow", "Out now · Day 2", following the clock after hydration. */
export function ReleaseIn({ release, initial, short = false }: { release: string; initial: string; short?: boolean }) {
  const lang = useLang();
  const now = useNow();
  return <>{now === null ? initial : releaseInText(release, now, lang, short)}</>;
}

/** Reloads the page once /live.json lists the film (its first figure is in), at most once per data update. */
function useFirstFigure(id: string, active: boolean) {
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const check = async () => {
      try {
        const res = await fetch('/live.json', { cache: 'no-store' });
        if (!res.ok) return;
        const board = await res.json() as { generatedAt: string; films: { id: string }[] };
        if (stopped || !board.films.some((f) => f.id === id)) return;
        setArrived(true);
        // A cached copy of this page could still be the countdown after reloading; never reload twice for one update.
        const key = `cb.reloaded.${id}`;
        if (sessionStorage.getItem(key) === board.generatedAt) return;
        sessionStorage.setItem(key, board.generatedAt);
        location.reload();
      } catch { /* offline, or storage blocked: the "first figures are in" link is shown instead */ }
    };
    check();
    const timer = setInterval(check, 60_000);
    const onShow = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onShow);
    return () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', onShow); };
  }, [id, active]);
  return arrived;
}

export function ReleaseCountdown({ id, release, dateLine }: { id: string; release: string; dateLine: string }) {
  const lang = useLang();
  const text = CLIENT_TEXT[lang];
  const now = useNow();
  const start = istMidnight(release);
  const out = now !== null && now >= start;
  const arrived = useFirstFigure(id, out);

  if (out) {
    return (
      <div className="board-readout">
        <div className="board-meta"><span className="board-label is-live">{text.outLabel}</span></div>
        <p className="board-figure release-day m">{text.outNow(dayOfRun(release, now))}</p>
        <p className="board-line">
          {arrived
            ? <span>{text.figuresArrived} <a href="" onClick={(e) => { e.preventDefault(); location.reload(); }}>{text.seeBoxOffice}</a></span>
            : <span>{text.outLine}</span>}
        </p>
      </div>
    );
  }

  // Before hydration (now === null) the units show dashes; the date line below is in the HTML either way.
  const left = now === null ? null : Math.max(0, start - now);
  const units = left === null ? ['–', '–', '–', '–'] : [
    String(Math.floor(left / DAY)),
    String(Math.floor((left % DAY) / 3_600_000)).padStart(2, '0'),
    String(Math.floor((left % 3_600_000) / 60_000)).padStart(2, '0'),
    String(Math.floor((left % 60_000) / 1000)).padStart(2, '0'),
  ];
  return (
    <div className="board-readout">
      <div className="board-meta"><span className="board-label">{text.countdownLabel}</span></div>
      <p className="countdown" role="timer" aria-live="off">
        {units.map((v, i) => (
          <span className="countdown-unit" key={text.countdownUnits[i]}>
            <b className="m">{v}</b><small>{text.countdownUnits[i]}</small>
          </span>
        ))}
      </p>
      <p className="board-line"><span>{dateLine}</span></p>
    </div>
  );
}
