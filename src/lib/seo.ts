// Page metadata (title, description, canonical, hreflang, Open Graph, Twitter) and JSON-LD helpers.
import type { Metadata } from 'next';
import { CONTENT, LANGS, type Alternates, type Lang } from './i18n';
import { SITE } from './site';

export interface PageMeta {
  lang: Lang;
  /** Path of this page, e.g. /top/ or /hi/top/. */
  path: string;
  /** The full <title>. */
  title: string;
  description: string;
  /** The same page in each language, for translated pages. */
  alternates?: Alternates;
  noindex?: boolean;
  ogType?: 'website' | 'video.movie';
}

export function pageMetadata({ lang, path, title, description, alternates, noindex = false, ogType = 'website' }: PageMeta): Metadata {
  const c = CONTENT[lang];
  const image = { url: `${SITE.url}/og-image.png`, width: 1200, height: 630, alt: c.ui.ogImageAlt(SITE.name) };
  return {
    title: { absolute: title },
    description,
    ...(noindex && { robots: { index: false } }),
    alternates: {
      canonical: `${SITE.url}${path}`,
      ...(alternates && {
        languages: {
          ...Object.fromEntries(LANGS.map((l) => [CONTENT[l].hreflang, `${SITE.url}${alternates[l]}`])),
          'x-default': `${SITE.url}${alternates.en}`,
        },
      }),
    },
    openGraph: {
      type: ogType,
      siteName: SITE.name,
      title,
      description,
      url: `${SITE.url}${path}`,
      locale: c.ogLocale,
      ...(alternates && { alternateLocale: LANGS.filter((l) => l !== lang).map((l) => CONTENT[l].ogLocale) }),
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}

export type Crumb = [name: string, path: string];

export const crumbsLd = (items: Crumb[]) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${SITE.url}${path}` })),
});

export const itemListLd = (list: { slug?: string }[], name: string) => ({
  '@context': 'https://schema.org', '@type': 'ItemList', name,
  itemListElement: list.slice(0, 50).map((f, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE.url}/movie/${f.slug}/` })),
});

/** Makes root-relative links in an HTML string absolute (FAQ answers in JSON-LD). */
export const absoluteLinks = (html: string) => html.replace(/href="\//g, `href="${SITE.url}/`);

/** FAQPage structured data for questions shown on the page (answers are HTML; Google allows links and <p>). */
export const faqLd = (items: { q: string; a: string }[]) => ({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: items.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: absoluteLinks(a) } })),
});
