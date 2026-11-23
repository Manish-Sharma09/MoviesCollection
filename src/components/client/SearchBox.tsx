'use client';
// Search over films and people. The index (/search.json) loads on first focus and is shared by
// every search box on the page.
import { useId, useRef, useState } from 'react';
import { CLIENT_TEXT } from '@/content/client-text';
import type { Currency } from '@/lib/format';
import { Money } from './basics';
import { useLang } from './hooks';

export interface Item {
  label: string;
  sub: string | number;
  href: string;
  key: string;
  weight: number;
  person?: boolean;
  usd?: number;
  inr?: number;
  native?: Currency;
}

type Index = {
  films: [title: string, year: number | null, slug: string, usd: number, inr: number, indian: 0 | 1][];
  people: [name: string, slug: string, count: number][];
};

const norm = (s: unknown) => String(s).normalize('NFKD').replace(/\p{Script=Inherited}/gu, '')
  .toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim();

let indexPromise: Promise<Item[]> | null = null;
/** Loads /search.json once per page (shared by every search box and the compare tool's pickers). */
export const loadIndex = (filmsLabel: (n: number) => string) =>
  (indexPromise ||= fetch('/search.json')
    .then((r) => {
      if (!r.ok) throw new Error('Search index unavailable');
      return r.json() as Promise<Index>;
    })
    .then(({ films, people }): Item[] => [
      ...people.map(([name, slug, count]) => ({
        label: name, sub: filmsLabel(count), href: `/person/${slug}/`, key: norm(name), weight: count * 1e9, person: true,
      })),
      ...films.map(([title, year, slug, usd, inr, indian]) => ({
        label: title, sub: year || '', href: `/movie/${slug}/`, key: norm(`${title} ${year || ''}`), weight: usd,
        usd, inr, native: (indian ? 'INR' : 'USD') as Currency,
      })),
    ])
    .catch((error) => {
      indexPromise = null;
      throw error;
    }));

export function search(items: Item[], query: string, limit = 10): Item[] {
  const q = norm(query);
  if (!q) return [];
  const tokens = q.split(' ');
  const out: [number, Item][] = [];
  for (const it of items) {
    if (!tokens.every((t) => it.key.includes(t))) continue;
    const score = it.key === q ? 0 : it.key.startsWith(q) ? 1 : (` ${it.key}`).includes(` ${tokens[0]}`) ? 2 : 3;
    out.push([score, it]);
  }
  out.sort((a, b) => a[0] - b[0] || b[1].weight - a[1].weight);
  return out.slice(0, limit).map((x) => x[1]);
}

/**
 * `header`: the field in the site header (collapses behind a magnifier on phones, with a Cancel button).
 * `big`: the large field on the home page and 404 pages.
 */
export function SearchBox({ variant = 'header', id: fixedId, label, placeholder }: {
  variant?: 'header' | 'big'; id?: string; label: string; placeholder: string;
}) {
  const lang = useLang();
  const text = CLIENT_TEXT[lang];
  const autoId = useId();
  const id = fixedId ?? autoId;
  const listId = `${id}-results`;
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Item[]>([]);
  const [empty, setEmpty] = useState(text.noMatch);
  const [active, setActive] = useState(-1);

  const close = () => {
    setOpen(false);
    setActive(-1);
  };
  const cancel = () => {
    setQuery('');
    close();
    input.current?.blur();
  };

  const onInput = async (value: string) => {
    setQuery(value);
    if (!value.trim()) return close();
    try {
      const items = await loadIndex(text.films);
      if (document.activeElement !== input.current || input.current?.value !== value) return;
      setResults(search(items, value));
      setEmpty(text.noMatch);
    } catch {
      if (document.activeElement !== input.current) return;
      setResults([]);
      setEmpty(text.searchUnavailable);
    }
    setActive(-1);
    setOpen(true);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      // First Escape closes the list, the next one leaves the field (and folds it away on phones).
      if (open) close();
      else input.current?.blur();
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(active + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
    else if (e.key === 'Enter') {
      const target = results[active >= 0 ? active : 0];
      if (target) { e.preventDefault(); location.href = target.href; }
    }
  };

  return (
    <div ref={box} className={`search ${variant === 'big' ? 'search-big' : 'header-search'}`} role="search">
      <div className="search-field">
        <label className="sr-only" htmlFor={id}>{label}</label>
        <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
        <input
          ref={input}
          id={id}
          type="search"
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          value={query}
          onFocus={() => { loadIndex(text.films).catch(() => {}); }}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={onKeyDown}
          // No close timer: the list keeps focus on press (below), so only a real blur closes it.
          onBlur={(e) => { if (!box.current?.contains(e.relatedTarget as Node | null)) close(); }}
        />
      </div>
      {variant === 'header' ? (
        // Phones only (site.css): leaves search mode, like the iOS search bar.
        <button type="button" className="search-cancel" onPointerDown={(e) => e.preventDefault()} onClick={cancel}>
          {text.cancel}
        </button>
      ) : null}
      {/* Pressing a result keeps focus in the field, so the list stays put until the tap completes. */}
      <ul id={listId} className="search-results" role="listbox" hidden={!open} onPointerDown={(e) => e.preventDefault()}>
        {results.length ? results.map((r, i) => (
          <li key={r.href} role="option" id={`${listId}-${i}`} aria-selected={open && i === active}>
            <a href={r.href} tabIndex={-1}>
              <span>{r.label} <small>{r.sub}</small></span>
              <small>{r.person ? null : <Money usd={r.usd!} inr={r.inr!} native={r.native} />}</small>
            </a>
          </li>
        )) : open ? <li className="empty">{empty}</li> : null}
      </ul>
    </div>
  );
}
