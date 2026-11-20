// Header, main and footer around every page.
import type { ReactNode } from 'react';
import { RATE } from '@/lib/data';
import { escapeHtml, formatDate } from '@/lib/format';
import { CONTENT, LANGS, localePath, otherLang, type Alternates, type Lang } from '@/lib/i18n';
import { SITE } from '@/lib/site';
import { CurrencySwitch, SearchToggle, ThemeToggle } from './client/basics';
import { MotionMain } from './client/motion/MotionMain';
import { SearchBox } from './client/SearchBox';
import { AppIcon, Html } from './ui';

const SUN = (
  <svg className="icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></svg>
);
const MOON = <svg className="icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>;

/** The header search field's id: the phone magnifier (SearchToggle) focuses it. */
const HEADER_SEARCH = 'site-search';

/** Top-level sections, for aria-current in the header. */
export type NavKey = '/live/' | '/top/' | '/india/' | '/years/' | '/about/';

export function PageShell({ lang, nav = null, alternates = null, headerSearch = true, children }: {
  lang: Lang;
  nav?: NavKey | null;
  /** The same page in each language; without it the language switch goes to the other home page. */
  alternates?: Alternates | null;
  /** The home page has its own big search box. */
  headerSearch?: boolean;
  children: ReactNode;
}) {
  const c = CONTENT[lang];
  const ui = c.ui;
  const P = (path: string) => localePath(lang, path);
  const other = otherLang(lang);
  const homeOf = (l: Lang) => (l === 'en' ? '/' : '/hi/');
  const navLink = (href: NavKey, label: string, className?: string) => (
    <a href={P(href)} className={className} aria-current={nav === href ? 'page' : undefined}>{label}</a>
  );
  const year = new Date().getUTCFullYear();

  return (
    <>
      <a className="skip" href="#main">{ui.skip}</a>
      <header className="site-header">
        <div className="wrap header-bar">
          <a className="brand" href={P('/')}><AppIcon id="header" /><span>{SITE.name}</span></a>
          <nav className="nav" aria-label={ui.navLabel}>
            {/* Phones: the magnifier opens the search field in this row (hidden on wider screens). */}
            {headerSearch ? <SearchToggle target={HEADER_SEARCH} label={ui.searchLabel} /> : null}
            {navLink('/live/', ui.nav.live, 'nav-live')}{navLink('/top/', ui.nav.top)}{navLink('/india/', ui.nav.india)}{navLink('/years/', ui.nav.years)}{navLink('/about/', ui.nav.about)}
          </nav>
          {headerSearch ? <SearchBox id={HEADER_SEARCH} label={ui.searchLabel} placeholder={ui.searchPlaceholder} /> : null}
          <div className="header-tools">
            <CurrencySwitch label={ui.currencyGroup} inRupees={ui.inRupees} inDollars={ui.inDollars} />
            <a className="lang-switch" href={alternates ? alternates[other] : homeOf(other)} lang={CONTENT[other].htmlLang}
              hrefLang={CONTENT[other].hreflang} title={CONTENT[other].ui.switchTitle}>{CONTENT[other].ui.langName}</a>
            <ThemeToggle label={ui.lightMode}>{SUN}{MOON}</ThemeToggle>
          </div>
        </div>
      </header>
      <MotionMain>
        {children}
      </MotionMain>
      <footer className="site-footer">
        <div className="wrap">
          <div className="footer-grid">
            <div className="footer-brand">
              <a className="brand" href={P('/')}><AppIcon id="footer" /><span>{SITE.name}</span></a>
              <Html as="p" html={ui.footerAbout} />
            </div>
            <nav aria-labelledby="f-charts">
              <h2 id="f-charts">{ui.footerCharts}</h2>
              <ul>
                <li><a href={P('/live/')}>{ui.nav.liveLong}</a></li>
                <li><a href={P('/top/')}>{ui.nav.topLong}</a></li>
                <li><a href={P('/india/')}>{ui.nav.india}</a></li>
                <li><a href={P('/club/100-crore/')}>{c.club['100-crore'].label}</a></li>
                <li><a href={P('/club/1000-crore/')}>{c.club['1000-crore'].label}</a></li>
                <li><a href={P('/years/')}>{ui.nav.yearsLong}</a></li>
              </ul>
            </nav>
            <nav aria-labelledby="f-site">
              <h2 id="f-site">{ui.footerSite}</h2>
              <ul>
                <li><a href={P('/about/')}>{ui.aboutUs}</a></li>
                <li><a href={P('/contact/')}>{ui.contactUs}</a></li>
                <li><a href={P('/privacy-policy/')}>{ui.privacy}</a></li>
                <li><a href={P('/terms/')}>{ui.terms}</a></li>
              </ul>
            </nav>
            <nav aria-labelledby="f-lang">
              <h2 id="f-lang">{ui.footerLanguage}</h2>
              <ul>
                {LANGS.map((l) => (
                  <li key={l}>
                    <a href={alternates ? alternates[l] : homeOf(l)} lang={CONTENT[l].htmlLang} hrefLang={CONTENT[l].hreflang}
                      aria-current={l === lang ? 'true' : undefined}>{CONTENT[l].ui.langName}</a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <Html as="p" className="footer-note" html={ui.footerNote(RATE.inrPerUsd, formatDate(RATE.date, lang) ?? RATE.date)} />
          <p className="footer-note">{ui.imagesNote}</p>
          <p className="footer-note">
            <a href="https://www.themoviedb.org/" className="art-credit"><img src="/tmdb.svg" alt="TMDB" width={58} height={18} loading="lazy" /></a>
            {' · '}{ui.tmdbNote}
          </p>
          <Html as="p" className="footer-copy" html={ui.copyright(year, escapeHtml(SITE.name))} />
        </div>
      </footer>
    </>
  );
}
