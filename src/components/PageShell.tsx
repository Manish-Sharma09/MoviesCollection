// Header, main and footer around every page.
import type { ReactNode } from 'react';
import { RATE } from '@/lib/data';
import { escapeHtml, formatDate } from '@/lib/format';
import { CONTENT, LANGS, localePath, otherLang, type Alternates, type Lang } from '@/lib/i18n';
import { SITE } from '@/lib/site';
import { CurrencySwitch, SearchToggle, ThemeToggle } from './client/basics';
import { MobileMenu, type MenuLink } from './client/MobileMenu';
import { MotionMain } from './client/motion/MotionMain';
import { SearchBox } from './client/SearchBox';
import { Ad, AppIcon, Html } from './ui';

const SUN = (
  <svg className="icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></svg>
);
const MOON = <svg className="icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>;

/** The header search field's id: the phone magnifier (SearchToggle) focuses it. */
const HEADER_SEARCH = 'site-search';
/** The search field in the home page's banner, which the header's magnifier jumps to. */
export const HOME_SEARCH = 'home-search';

/** Top-level sections, for aria-current in the header. */
export type NavKey = '/live/' | '/upcoming/' | '/top/' | '/india/' | '/years/' | '/guides/' | '/about/';

/** Sections that exist in English only: every language links to the English page. */
const ENGLISH_ONLY = new Set<string>(['/guides/']);

export function PageShell({ lang, nav = null, alternates = null, headerSearch = true, ads = true, children }: {
  lang: Lang;
  nav?: NavKey | null;
  /** The same page in each language; without it the language switch goes to the other home page. */
  alternates?: Alternates | null;
  /** The home page has its own big search box. */
  headerSearch?: boolean;
  /** An ad slot after the content (when ads are set up). Off for error pages, which AdSense does not allow ads on. */
  ads?: boolean;
  children: ReactNode;
}) {
  const c = CONTENT[lang];
  const ui = c.ui;
  const P = (path: string) => localePath(lang, path);
  const other = otherLang(lang);
  const homeOf = (l: Lang) => (l === 'en' ? '/' : '/hi/');
  const navLink = (href: NavKey, label: string, className?: string) => (
    <a href={ENGLISH_ONLY.has(href) ? href : P(href)} className={className} aria-current={nav === href ? 'page' : undefined}
      hrefLang={ENGLISH_ONLY.has(href) && lang !== 'en' ? 'en' : undefined}>{label}</a>
  );
  const year = new Date().getUTCFullYear();
  const sections: [NavKey, string][] = [
    ['/live/', ui.nav.liveLong], ['/upcoming/', ui.nav.upcomingLong], ['/top/', ui.nav.topLong], ['/india/', ui.nav.india],
    ['/years/', ui.nav.yearsLong], ['/guides/', ui.nav.guides], ['/about/', ui.nav.about],
  ];
  const menuLinks: MenuLink[] = sections.map(([href, label]) => ({
    href: ENGLISH_ONLY.has(href) ? href : P(href), label, current: nav === href, live: href === '/live/',
    ...(ENGLISH_ONLY.has(href) && lang !== 'en' ? { hrefLang: 'en' } : {}),
  }));
  const langLink = (
    <a className="lang-switch" href={alternates ? alternates[other] : homeOf(other)} lang={CONTENT[other].htmlLang}
      hrefLang={CONTENT[other].hreflang} title={CONTENT[other].ui.switchTitle}>{CONTENT[other].ui.langName}</a>
  );
  const settings = (
    <>
      <CurrencySwitch label={ui.currencyGroup} inRupees={ui.inRupees} inDollars={ui.inDollars} />
      {langLink}
      <ThemeToggle label={ui.lightMode}>{SUN}{MOON}</ThemeToggle>
    </>
  );

  return (
    <>
      <a className="skip" href="#main">{ui.skip}</a>
      <header className="site-header">
        <div className="wrap header-bar">
          <a className="brand" href={P('/')}><AppIcon /><span>{SITE.name}</span></a>
          <nav className="nav" aria-label={ui.navLabel}>
            {navLink('/live/', ui.nav.live, 'nav-live')}{navLink('/upcoming/', ui.nav.upcoming)}{navLink('/top/', ui.nav.top)}{navLink('/india/', ui.nav.india)}{navLink('/years/', ui.nav.years)}{navLink('/guides/', ui.nav.guides)}{navLink('/about/', ui.nav.about)}
          </nav>
          {headerSearch ? <SearchBox id={HEADER_SEARCH} label={ui.searchLabel} placeholder={ui.searchPlaceholder} /> : null}
          <div className="header-tools">
            {/* Wider screens: the home page's magnifier sits with the tools. */}
            {headerSearch ? null : <SearchToggle target={HOME_SEARCH} label={ui.searchLabel} jump tools />}
            {settings}
          </div>
          {/* Phones and tablets: just a magnifier and the menu button; sections and settings are in the menu. */}
          <div className="header-mobile">
            {headerSearch
              ? <SearchToggle target={HEADER_SEARCH} label={ui.searchLabel} />
              : <SearchToggle target={HOME_SEARCH} label={ui.searchLabel} jump />}
            <MobileMenu links={menuLinks} settings={settings} labels={ui.menu} />
          </div>
        </div>
      </header>
      <MotionMain>
        {children}
        {ads ? <Ad lang={lang} /> : null}
      </MotionMain>
      <footer className="site-footer">
        <div className="wrap">
          <div className="footer-grid">
            <div className="footer-brand">
              <a className="brand" href={P('/')}><AppIcon /><span>{SITE.name}</span></a>
              <Html as="p" html={ui.footerAbout} />
            </div>
            <nav aria-labelledby="f-charts">
              <h2 id="f-charts">{ui.footerCharts}</h2>
              <ul>
                <li><a href={P('/live/')}>{ui.nav.liveLong}</a></li>
                <li><a href={P('/upcoming/')}>{ui.nav.upcomingLong}</a></li>
                <li><a href={P('/top/')}>{ui.nav.topLong}</a></li>
                <li><a href={P('/india/')}>{ui.nav.india}</a></li>
                <li><a href={P('/language/hindi/')}>{ui.footerBollywood}</a></li>
                <li><a href={P('/language/english/')}>{ui.footerHollywood}</a></li>
                <li><a href={P('/club/100-crore/')}>{c.club['100-crore'].label}</a></li>
                <li><a href={P('/club/1000-crore/')}>{c.club['1000-crore'].label}</a></li>
                <li><a href={P('/years/')}>{ui.nav.yearsLong}</a></li>
                <li><a href={P('/explore/')}>{ui.explore}</a></li>
                <li><a href="/compare/" hrefLang={lang !== 'en' ? 'en' : undefined}>{ui.compareFilms}</a></li>
              </ul>
            </nav>
            <nav aria-labelledby="f-site">
              <h2 id="f-site">{ui.footerSite}</h2>
              <ul>
                <li><a href={P('/about/')}>{ui.aboutUs}</a></li>
                <li><a href="/guides/" hrefLang={lang !== 'en' ? 'en' : undefined}>{ui.nav.guides}</a></li>
                <li><a href={P('/contact/')}>{ui.contactUs}</a></li>
                <li><a href={P('/privacy-policy/')}>{ui.privacy}</a></li>
                <li><a href={P('/terms/')}>{ui.terms}</a></li>
                <li><a href={P('/disclaimer/')}>{ui.disclaimer}</a></li>
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
          <Html as="p" className="footer-copy" html={ui.copyright(year, escapeHtml(SITE.name))} />
        </div>
      </footer>
    </>
  );
}
