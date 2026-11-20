// Page languages. English pages live at /path/, Hindi at /hi/path/. Film and people pages are
// English only: translating them would push the site past Cloudflare Pages' 20,000-file limit.
import en from '@/content/en';
import hi from '@/content/hi';
import type { Content } from '@/content/types';
import type { Lang } from './format';

export type { Lang };

export const CONTENT: Record<Lang, Content> = { en, hi };
export const LANGS = Object.keys(CONTENT) as Lang[];

export const otherLang = (lang: Lang): Lang => (lang === 'en' ? 'hi' : 'en');

/** A link to a page in the given language: /top/ or /hi/top/. */
export const localePath = (lang: Lang, path: string): string => (lang === 'en' ? path : `/${lang}${path}`);

/** The same page in every language, for hreflang links and the language switch. */
export type Alternates = Record<Lang, string>;
export const alternatesFor = (path: string): Alternates =>
  Object.fromEntries(LANGS.map((l) => [l, localePath(l, path)])) as Alternates;
