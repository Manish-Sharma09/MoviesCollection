'use client';
// The compare tool (/compare/): any two films side by side. The chosen films live in the address
// (?a=slug&b=slug), so a comparison can be shared. Each film's figures come from its own page (the JSON in
// script#film-facts), so no extra file per film is needed: the site stays under the host's file limit.
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { formatDate, formatMoney, type Currency } from '@/lib/format';
import type { Series } from '@/lib/film-stats';
import { liveState } from '@/lib/live';
import type { FilmFacts, Money } from '@/lib/types';
import type { Pair } from '@/lib/insights';
import { SafeImg } from '../basics';
import { HeadToHead } from '../film/HeadToHead';
import { ShareMenu } from '../film/ShareMenu';
import { PairCards } from './PairCards';
import { useCurrency, useLiveStep } from '../hooks';
import { loadIndex, search, type Item } from '../SearchBox';

// ---------- the address as a store: ?a=…&b=… ----------

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  window.addEventListener('popstate', l);
  return () => {
    listeners.delete(l);
    window.removeEventListener('popstate', l);
  };
};
function setPicks(a: string | null, b: string | null) {
  const q = new URLSearchParams();
  if (a) q.set('a', a);
  if (b) q.set('b', b);
  const qs = q.toString();
  history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}`);
  listeners.forEach((l) => l());
}
const usePicks = (): [string | null, string | null] => {
  const qs = useSyncExternalStore(subscribe, () => location.search, () => '');
  const q = new URLSearchParams(qs);
  return [q.get('a'), q.get('b')];
};

// ---------- reading a film's figures from its page ----------

const factsCache = new Map<string, Promise<FilmFacts>>();
function loadFacts(slug: string): Promise<FilmFacts> {
  if (!factsCache.has(slug)) {
    factsCache.set(slug, fetch(`/movie/${encodeURIComponent(slug)}/`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((html) => {
        const el = new DOMParser().parseFromString(html, 'text/html').getElementById('film-facts');
        if (!el?.textContent) throw new Error('No figures on that page');
        return JSON.parse(el.textContent) as FilmFacts;
      })
      .catch((e) => {
        factsCache.delete(slug);
        throw e;
      }));
  }
  return factsCache.get(slug)!;
}

type Loaded = FilmFacts | 'loading' | 'error';
function useFacts(slug: string | null): Loaded | null {
  const [state, setState] = useState<Record<string, Loaded>>({});
  useEffect(() => {
    if (!slug || state[slug]) return;
    let live = true;
    loadFacts(slug).then(
      (f) => { if (live) setState((s) => ({ ...s, [slug]: f })); },
      () => { if (live) setState((s) => ({ ...s, [slug]: 'error' })); },
    );
    return () => { live = false; };
  }, [slug, state]);
  return slug ? state[slug] ?? 'loading' : null;
}

// ---------- picking a film ----------

function FilmPicker({ label, onPick, autoFocus = false }: { label: string; onPick: (slug: string) => void; autoFocus?: boolean }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Item[]>([]);
  const [active, setActive] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => { if (autoFocus) input.current?.focus({ preventScroll: true }); }, [autoFocus]);

  const onInput = async (value: string) => {
    setQuery(value);
    if (!value.trim()) return setResults([]);
    try {
      const items = await loadIndex((n) => `${n} films`);
      if (input.current?.value !== value) return;
      setResults(search(items.filter((it) => !it.person), value, 8));
      setActive(0);
      setError('');
    } catch {
      setError('Search is temporarily unavailable. Try again.');
    }
  };
  const choose = (it: Item | undefined) => {
    if (!it) return;
    onPick(it.href.replace(/^\/movie\/|\/$/g, ''));
  };
  const open = Boolean(query.trim());

  return (
    <div className="cmp-picker">
      <label className="cmp-picker-label" htmlFor={id}>{label}</label>
      <input
        ref={input} id={id} type="search" placeholder="Type a film’s name" autoComplete="off" enterKeyHint="go"
        role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${id}-${active}` : undefined}
        value={query}
        onFocus={() => { loadIndex((n) => `${n} films`).catch(() => {}); }}
        onChange={(e) => onInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); }
          else if (e.key === 'Escape') setQuery('');
        }}
      />
      <ul id={`${id}-list`} className="search-results cmp-results" role="listbox" hidden={!open} onPointerDown={(e) => e.preventDefault()}>
        {results.length ? results.map((r, i) => (
          <li key={r.href} id={`${id}-${i}`} role="option" aria-selected={i === active}>
            <button type="button" tabIndex={-1} onClick={() => choose(r)}>
              <span>{r.label} <small>{r.sub}</small></span>
              <small className="m">{r.usd !== undefined ? formatMoney({ usd: r.usd, inr: r.inr! }, r.native!) : null}</small>
            </button>
          </li>
        )) : open ? <li className="empty">{error || 'No film by that name yet. Try a shorter spelling.'}</li> : null}
      </ul>
    </div>
  );
}

// ---------- the two slots ----------

function Slot({ which, slug, facts, onPick, onClear, autoFocus }: {
  which: 'A' | 'B'; slug: string | null; facts: Loaded | null; onPick: (s: string) => void; onClear: () => void; autoFocus: boolean;
}) {
  const label = which === 'A' ? 'First film' : 'Second film';
  if (!slug || facts === 'error') {
    return (
      <div className={`cmp-slot is-empty slot-${which.toLowerCase()}`}>
        {facts === 'error' ? <p className="cmp-error">Could not load that film. Pick another.</p> : null}
        <FilmPicker label={label} onPick={onPick} autoFocus={autoFocus} />
      </div>
    );
  }
  if (!facts || facts === 'loading') {
    return <div className={`cmp-slot is-loading slot-${which.toLowerCase()}`} aria-busy="true"><span className="cmp-skel" /><span className="sr-only">Loading…</span></div>;
  }
  return (
    <div className={`cmp-slot slot-${which.toLowerCase()}`}>
      <span className="poster" aria-hidden="true">
        <span className="poster-letter">{facts.title.trim().slice(0, 1)}</span>
        {facts.poster ? <SafeImg src={facts.poster} alt="" width={120} height={180} decoding="async" /> : null}
      </span>
      <span className="cmp-slot-text">
        <a className="cmp-title" href={`/movie/${facts.slug}/`}>{facts.title}</a>
        <small>{[facts.year, facts.language].filter(Boolean).join(' · ')}</small>
      </span>
      <button type="button" className="cmp-change" onClick={onClear}>Change<span className="sr-only"> {label.toLowerCase()}</span></button>
    </div>
  );
}

// ---------- the comparison ----------

type Row = { label: string; a: ReactNode; b: ReactNode; win?: 0 | 1 | null };

/** Which side wins a row: higher (or lower) number, or none when either is missing or they are equal. */
const winner = (a: number | null | undefined, b: number | null | undefined, lower = false): 0 | 1 | null => {
  if (a == null || b == null || a === b) return null;
  return (lower ? a < b : a > b) ? 0 : 1;
};

function Tug({ a, b, label, va, vb, cur }: { a: FilmFacts; b: FilmFacts; label: string; va: Money; vb: Money; cur: Currency }) {
  const x = cur === 'INR' ? va.inr : va.usd;
  const y = cur === 'INR' ? vb.inr : vb.usd;
  const share = x + y > 0 ? x / (x + y) : 0.5;
  const lead = x === y ? null : x > y ? a : b;
  const diff = Math.abs(x - y);
  const pct = Math.min(x, y) > 0 ? Math.round((Math.max(x, y) / Math.min(x, y) - 1) * 100) : null;
  return (
    <div className="cmp-tug">
      <p className="cmp-tug-label">{label}</p>
      <p className="cmp-tug-head">
        {lead ? <><b>{lead.title}</b> leads by <b className="m">{formatMoney({ usd: diff, inr: diff }, cur)}</b>{pct !== null ? <> ({pct.toLocaleString('en-IN')}% more)</> : null}</> : 'Level'}
      </p>
      <div className="cmp-tug-bar" aria-hidden="true">
        <i className="tug-a" style={{ flexGrow: share }} />
        <i className="tug-b" style={{ flexGrow: 1 - share }} />
      </div>
      <p className="cmp-tug-values">
        <span className="m">{formatMoney(va, cur)}</span>
        <span className="m">{formatMoney(vb, cur)}</span>
      </p>
    </div>
  );
}

function Result({ a, b }: { a: FilmFacts; b: FilmFacts }) {
  const mode = useCurrency();
  const step = useLiveStep();
  const cur: Currency = mode || (a.native === 'INR' || b.native === 'INR' ? 'INR' : 'USD');
  const fmt = (m: Money | null) => (m ? <span className="m">{formatMoney(m, cur)}</span> : <span className="cmp-none">—</span>);
  const num = (m: Money | null) => (m ? (cur === 'INR' ? m.inr : m.usd) : null);
  // Films in cinemas: the running total, with the live estimate since the last report.
  const now = (f: FilmFacts): { money: Money; live: boolean } => {
    const s = f.live && f.showing && step !== null ? liveState({ ...f.gross, ...f.live }, step) : null;
    return s ? { money: { usd: s.usd, inr: s.inr }, live: true } : { money: f.gross, live: false };
  };
  const na = now(a);
  const nb = now(b);
  const times = (f: FilmFacts, g: Money) => (f.budget && f.budget.usd > 0 ? g.usd / f.budget.usd : null);
  const ta = times(a, na.money);
  const tb = times(b, nb.money);
  const adjYear = a.adjustedYear ?? b.adjustedYear;
  // Today's money follows the running total too: the film's price factor applied to its current figure.
  const adjNow = (f: FilmFacts, g: Money): Money | null =>
    f.adjusted && f.gross.usd > 0 ? { usd: (g.usd * f.adjusted.usd) / f.gross.usd, inr: (g.inr * f.adjusted.inr) / f.gross.inr } : null;
  const aa = adjNow(a, na.money);
  const ab = adjNow(b, nb.money);

  const rows: Row[] = [
    {
      label: 'Worldwide gross',
      a: <>{fmt(na.money)}{na.live ? <span className="cmp-live">live</span> : null}</>,
      b: <>{fmt(nb.money)}{nb.live ? <span className="cmp-live">live</span> : null}</>,
      win: winner(num(na.money), num(nb.money)),
    },
  ];
  if (aa || ab) rows.push({ label: `In ${adjYear} prices`, a: fmt(aa), b: fmt(ab), win: winner(num(aa), num(ab)) });
  if (a.indiaNet || b.indiaNet) rows.push({ label: 'India net', a: fmt(a.indiaNet), b: fmt(b.indiaNet), win: winner(num(a.indiaNet), num(b.indiaNet)) });
  if (a.overseas || b.overseas) rows.push({ label: 'Overseas', a: fmt(a.overseas), b: fmt(b.overseas), win: winner(num(a.overseas), num(b.overseas)) });
  if (a.budget || b.budget) {
    rows.push({ label: 'Budget', a: fmt(a.budget), b: fmt(b.budget) });
    rows.push({
      label: 'Gross ÷ budget',
      a: ta ? <span className="m">{ta >= 10 ? Math.round(ta) : ta.toFixed(1)}×</span> : <span className="cmp-none">—</span>,
      b: tb ? <span className="m">{tb >= 10 ? Math.round(tb) : tb.toFixed(1)}×</span> : <span className="cmp-none">—</span>,
      win: winner(ta, tb),
    });
  }
  if (a.opening || b.opening) rows.push({ label: 'Opening day', a: fmt(a.opening), b: fmt(b.opening), win: winner(num(a.opening), num(b.opening)) });
  if (a.biggestDay || b.biggestDay) rows.push({ label: 'Biggest day', a: fmt(a.biggestDay), b: fmt(b.biggestDay), win: winner(num(a.biggestDay), num(b.biggestDay)) });
  rows.push({
    label: 'Rank in its year',
    a: a.yearRank ? <span className="m">#{a.yearRank} <small>of {a.yearCount} in {a.year}</small></span> : <span className="cmp-none">—</span>,
    b: b.yearRank ? <span className="m">#{b.yearRank} <small>of {b.yearCount} in {b.year}</small></span> : <span className="cmp-none">—</span>,
  });
  if (a.chartRank || b.chartRank) {
    rows.push({
      label: 'All-time chart',
      a: a.chartRank ? <span className="m">#{a.chartRank}</span> : <span className="cmp-none">—</span>,
      b: b.chartRank ? <span className="m">#{b.chartRank}</span> : <span className="cmp-none">—</span>,
      win: winner(a.chartRank, b.chartRank, true),
    });
  }
  rows.push(
    { label: 'Released', a: formatDate(a.date) ?? '—', b: formatDate(b.date) ?? '—' },
    { label: 'Language', a: a.language ?? '—', b: b.language ?? '—' },
    { label: 'Director', a: a.director ?? '—', b: b.director ?? '—' },
    { label: 'Starring', a: a.stars.join(', ') || '—', b: b.stars.join(', ') || '—' },
  );

  const series: Series[] | null = a.days.length >= 3 && b.days.length >= 3 ? [
    { title: a.title, slug: a.slug, self: true, points: a.days },
    { title: b.title, slug: b.slug, self: false, points: b.days.filter((d) => d[0] <= a.days.at(-1)![0] + 14) },
  ] : null;

  return (
    <div className="cmp-result">
      <div className="block-head">
        <h2 id="cmp-result">{a.title} vs {b.title}</h2>
        <ShareMenu title={`${a.title} vs ${b.title} box office`} text={`${a.title} vs ${b.title}: box office compared`} />
      </div>
      <div className="block-card">
        <Tug a={a} b={b} label="Worldwide gross" va={na.money} vb={nb.money} cur={cur} />
        {aa && ab ? <Tug a={a} b={b} label={`Adjusted for inflation, in ${adjYear} prices`} va={aa} vb={ab} cur={cur} /> : null}
        <table className="cmp-table">
          <caption className="sr-only">{a.title} and {b.title} compared. The higher figure in each row is marked.</caption>
          <thead>
            <tr>
              <td />
              <th scope="col"><span className="cmp-key key-a" aria-hidden="true" />{a.title}</th>
              <th scope="col"><span className="cmp-key key-b" aria-hidden="true" />{b.title}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                {[r.a, r.b].map((cell, i) => (
                  <td key={i} className={r.win === i ? 'is-win' : undefined}>
                    {cell}{r.win === i ? <span className="sr-only"> (higher)</span> : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {series ? (
        <section className="block" aria-labelledby="cmp-race">
          <div className="block-head"><h2 id="cmp-race">Race by day of release</h2></div>
          <div className="block-card"><HeadToHead series={series} native={cur} /></div>
        </section>
      ) : null}
      <p className="note">
        Reported worldwide figures from each film’s Wikipedia article; live totals are estimates between reports.
        {adjYear ? <> “In {adjYear} prices” raises each gross by consumer prices since its release year (World Bank data): <a href="/top/adjusted/">see the adjusted chart</a>.</> : null}
      </p>
    </div>
  );
}

// ---------- the tool ----------

export function CompareTool({ pairs }: { pairs: Pair[] }) {
  const [a, b] = usePicks();
  const fa = useFacts(a);
  const fb = useFacts(b);
  const ready = fa && fb && typeof fa === 'object' && typeof fb === 'object';

  useEffect(() => {
    if (ready) document.title = `${fa.title} vs ${fb.title} box office comparison`;
  }, [ready, fa, fb]);

  const goPair = (e: React.MouseEvent<HTMLAnchorElement>, p: Pair) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    setPicks(p.a.slug, p.b.slug);
    document.getElementById('compare-tool')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <div className="cmp" id="compare-tool">
        <div className="cmp-slots">
          <Slot which="A" slug={a} facts={fa} onPick={(s) => setPicks(s, b)} onClear={() => setPicks(null, b)} autoFocus={false} />
          <button type="button" className="cmp-vs" onClick={() => setPicks(b, a)} disabled={!a && !b} title="Swap the two films">
            <span aria-hidden="true">vs</span><span className="sr-only">Swap the two films</span>
          </button>
          <Slot which="B" slug={b} facts={fb} onPick={(s) => setPicks(a, s)} onClear={() => setPicks(a, null)} autoFocus={Boolean(a && !b)} />
        </div>
        {ready ? <Result a={fa} b={fb} /> : (
          <p className="cmp-hint">{a || b ? 'Now pick the other film.' : 'Pick two films, or start from a match-up below.'}</p>
        )}
      </div>

      {pairs.length ? (
        <section className="block" aria-labelledby="pairs">
          <div className="block-head"><h2 id="pairs">Popular match-ups</h2></div>
          <PairCards pairs={pairs} onPick={goPair} />
        </section>
      ) : null}
    </>
  );
}
