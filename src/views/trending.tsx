// The home page's "Trending this week" row: recent and upcoming films ranked by how many people read their
// Wikipedia page in the last 7 days (src/lib/data.ts `trending`), so a first-time visitor sees what everyone
// is talking about before the box office tables. Each card: poster (place, Day N or countdown), title, date
// and language, views. Money is left to the board below and the film's page.
import { CardDay } from '@/components/client/FilmCardLive';
import { Shelf } from '@/components/client/film/FilmBits';
import { ReleaseIn } from '@/components/client/Release';
import { Poster } from '@/components/ui';
import { BUILD_TIME, inCinemas, languageByName, releaseOf, type TrendingItem } from '@/lib/data';
import { runDay } from '@/lib/film-stats';
import { formatCompact } from '@/lib/format';
import { CONTENT, type Lang } from '@/lib/i18n';
import { releaseDate, releaseInText } from '@/lib/release';
import type { Film, UpcomingFilm } from '@/lib/types';

const isReleased = (f: Film | UpcomingFilm): f is Film => 'gross' in f;

const languageLabel = (f: Film | UpcomingFilm, lang: Lang) => {
  const l = f.languages.map((n) => languageByName.get(n)).find(Boolean);
  return l ? (lang === 'hi' ? l.hi : l.name) : f.languages[0];
};

export function TrendingShelf({ items, lang }: { items: TrendingItem[]; lang: Lang }) {
  const ui = CONTENT[lang].ui;
  return (
    <Shelf label={ui.trendingTitle}>
      <ol className="poster-row">
        {items.map(({ film: f, views }, i) => {
          const released = isReleased(f);
          const showing = released && inCinemas.includes(f);
          const start = released ? (f.daily?.length ? releaseOf(f) : f.date) : f.release;
          // A year-only catalog date (YYYY-01-01) shows as the year.
          const when = start && !(released && start.endsWith('-01-01')) ? releaseDate(start, lang, BUILD_TIME) : f.year ? String(f.year) : null;
          return (
            <li className="pc" key={f.id}>
              {/* Film pages are in English. */}
              <a className="pc-link" href={`/movie/${f.slug}/`} hrefLang={lang !== 'en' ? 'en' : undefined}>
                <span className="pc-art">
                  <Poster film={f} />
                  <span className="pc-rank">{i + 1}</span>
                  {!released ? (
                    <span className="pc-when"><ReleaseIn release={f.release} initial={releaseInText(f.release, BUILD_TIME, lang, true)} short /></span>
                  ) : showing && start ? (
                    <span className="pc-when"><span className="live-dot" aria-hidden="true" /> <CardDay release={start} initial={runDay(start, BUILD_TIME)} /></span>
                  ) : null}
                </span>
                <b className="pc-title">{f.title}</b>
                <span className="pc-meta">{[when, languageLabel(f, lang)].filter(Boolean).join(' · ')}</span>
                <span className="pc-views">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 11.5 6 7l3 3 5.5-5.5M10.5 4.5h4v4" /></svg>
                  {ui.trendingViews(formatCompact(views, lang))}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </Shelf>
  );
}
