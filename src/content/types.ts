// Shape of the text for one page language (en.ts, hi.ts). Fields whose names end in Html, and
// `intro`, `lead`, `body`, `article` and FAQ answers, contain HTML; everything else is plain text.
import type { ClubSlug, Stats } from '@/lib/types';

type Fn<A extends unknown[], R = string> = (...args: A) => R;

export interface ProsePage {
  h1: string;
  title: string;
  description: string;
  lead?: string;
  body: string;
}

export interface ListPage {
  h1: string;
  title: string;
  description: string;
  intro: string;
}

export interface Content {
  htmlLang: string;
  hreflang: string;
  ogLocale: string;

  ui: {
    langName: string;
    switchTitle: string;
    skip: string;
    navLabel: string;
    nav: { live: string; liveLong: string; top: string; topLong: string; india: string; years: string; yearsLong: string; guides: string; about: string };
    home: string;
    breadcrumb: string;
    searchLabel: string;
    searchPlaceholder: string;
    searchPlaceholderBig: string;
    currencyGroup: string;
    inRupees: string;
    inDollars: string;
    lightMode: string;
    ogImageAlt: Fn<[name: string]>;
    footerAbout: string;
    footerCharts: string;
    footerSite: string;
    footerLanguage: string;
    aboutUs: string;
    contactUs: string;
    privacy: string;
    terms: string;
    disclaimer: string;
    /** Home page section linking the guides (which are written in English). */
    guidesTitle: string;
    guidesNote: string;
    allGuides: string;
    footerNote: Fn<[rate: number, date: string]>;
    imagesNote: string;
    /** Small label above an ad slot. */
    adLabel: string;
    copyright: Fn<[year: number, name: string]>;
    boardTitle: string;
    boardNote: string;
    boardFallback: Fn<[year: number]>;
    boardFallbackNote: string;
    day: Fn<[n: number]>;
    clubsTitle: string;
    clubsNote: string;
    clubCount: Fn<[label: string]>;
    topIndia: string;
    topIndiaNote: string;
    allIndian: string;
    topWorld: string;
    topWorldNote: string;
    top500: string;
    /** Link text for Wikipedia's "List of highest-grossing films", in the chart's source line. */
    chartSource: string;
    byYear: string;
    everyYear: string;
    byLanguage: string;
    /** Film detail cards on the home page's recent-releases board. */
    card: {
      released: Fn<[date: string]>;
      budget: string;
      worldwide: string;
      indiaNet: string;
      indiaGross: string;
      overseas: string;
      northAmerica: string;
      rankToday: Fn<[n: number]>;
      indian: string;
      international: string;
      votes: Fn<[n: string]>;
    };
    /** Phone and tablet menu (the slide-in panel). */
    menu: { open: string; close: string; title: string; settings: string };
    /** Link to /explore/ from the home page and footer. */
    explore: string;
    faqTitle: string;
    filmsCount: Fn<[n: number]>;
    indianFilms: string;
    allFilms: string;
    /** Link from the reported charts to the inflation-adjusted ones, and back. */
    adjustedLink: string;
    reportedLink: string;
    /** Before a film's reported gross on the adjusted charts: "1975 · reported ₹35 cr". */
    reportedThen: string;
    /** The compare tool (English only) in the footer and on the home page. */
    compareFilms: string;
    compareTitle: string;
    compareNote: string;
    compareOpen: string;
    /** Home page: this year's Indian releases by original language. */
    raceTitle: Fn<[year: number]>;
    raceNote: string;
    raceTop: string;
  };

  club: Record<ClubSlug, { label: string; note: string }>;

  /** Home page hero and "recent releases" board. */
  hero: Fn<[s: Stats], {
    kicker: string;
    h1Html: string;
    intro: string;
    browse: string;
    /** Link to the live page from the hero and the recent-releases board. */
    live: string;
    seeAllLive: string;
    updated: string;
    featured: string;
    /** Controls of the 3D poster stack in the hero (larger screens). */
    stack: { group: string; previous: string; next: string; pause: string; play: string };
    reported: string;
    estimate: string;
    chart: string;
    filmsTracked: string;
  }>;
  /** Source line under the worldwide chart. `count`: places taken from Wikipedia's list; `link`: that list (HTML). */
  worldwideNoteHtml: Fn<[count: string, asOf: string, link: string]>;

  home: Fn<[s: Stats], { title: string; description: string; h1: string; intro: string }>;
  article: Fn<[s: Stats]>;
  faq: Fn<[s: Stats], { q: string; a: string }[]>;

  pages: {
    live: Fn<[s: Stats, n: number], ListPage & { note: string }>;
    top: Fn<[s: Stats], Omit<ListPage, 'intro'>>;
    india: Fn<[s: Stats], ListPage>;
    /** The charts in today's money (src/lib/inflation.ts); `year` is the price year. */
    topAdjusted: Fn<[s: Stats, year: number], ListPage>;
    indiaAdjusted: Fn<[s: Stats, year: number], ListPage>;
    club: Fn<[meta: { label: string; note: string }, n: number], Omit<ListPage, 'h1'>>;
    years: Fn<[s: Stats], ListPage>;
    /** /explore/: the browse-by-year/language, guides, article and FAQ sections moved off the home page. */
    explore: Fn<[s: Stats], ListPage>;
    year: Fn<[year: number, n: number, indian: number], ListPage>;
    language: Fn<[name: string, n: number], ListPage>;
    about: Fn<[s: Stats], ProsePage>;
    contact: Fn<[s: Stats], ProsePage>;
    'privacy-policy': Fn<[s: Stats], ProsePage>;
    terms: Fn<[s: Stats], ProsePage>;
    disclaimer: Fn<[s: Stats], ProsePage>;
  };

  errors: {
    notFoundTitle: string;
    notFoundH1: string;
    notFoundText: string;
    goHome: string;
    serverTitle: string;
    serverH1: string;
    serverText: string;
  };
}

export type ProseKey = 'about' | 'contact' | 'privacy-policy' | 'terms' | 'disclaimer';
