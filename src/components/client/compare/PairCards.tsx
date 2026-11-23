// Ready-made match-ups for the compare tool: two posters and titles per card. Used by the compare tool (where a
// click fills the tool in place) and by the home page (plain links), so no 'use client' of its own.
import type { MouseEvent } from 'react';
import type { Pair } from '@/lib/insights';
import { SafeImg } from '../basics';

export function PairCards({ pairs, labels = true, onPick }: {
  pairs: Pair[]; labels?: boolean; onPick?: (e: MouseEvent<HTMLAnchorElement>, p: Pair) => void;
}) {
  return (
    <ul className="pair-grid">
      {pairs.map((p) => (
        <li key={`${p.a.slug}-${p.b.slug}`} data-reveal="">
          <a className="pair-card" href={`/compare/?a=${p.a.slug}&b=${p.b.slug}`} hrefLang="en" onClick={onPick ? (e) => onPick(e, p) : undefined}>
            {labels ? <span className="pair-label">{p.label}</span> : null}
            <span className="pair-films">
              {[p.a, p.b].map((x, i) => (
                <span key={x.slug} className="pair-film">
                  <span className="poster" aria-hidden="true">
                    <span className="poster-letter">{x.title.trim().slice(0, 1)}</span>
                    {x.poster ? <SafeImg src={x.poster} alt="" width={120} height={180} loading="lazy" decoding="async" /> : null}
                  </span>
                  <span className="pair-name">{x.title}{x.year ? <small>{x.year}</small> : null}</span>
                  {i === 0 ? <span className="pair-vs" aria-hidden="true">vs</span> : null}
                </span>
              ))}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
