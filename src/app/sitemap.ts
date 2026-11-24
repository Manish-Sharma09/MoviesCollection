// sitemap.xml with hreflang alternates for the translated pages.
import type { MetadataRoute } from 'next';
import { GUIDES } from '@/content/guides';
import { CLUBS, films, languages, people, upcoming, yearsSorted } from '@/lib/data';
import { alternatesFor, CONTENT, LANGS } from '@/lib/i18n';
import { CPI_YEAR } from '@/lib/inflation';
import { SITE } from '@/lib/site';

export const dynamic = 'force-static';

/** Pages that exist in every language, in the order the old static build listed them. */
const translatedPaths = [
  '/', '/live/', '/upcoming/', '/about/', '/contact/', '/privacy-policy/', '/terms/', '/disclaimer/', '/top/', '/india/',
  ...(CPI_YEAR ? ['/top/adjusted/', '/india/adjusted/'] : []),
  ...CLUBS.map((c) => `/club/${c.slug}/`),
  '/years/', '/explore/',
  ...yearsSorted.map((y) => `/year/${y}/`),
  ...languages.map((l) => `/language/${l.slug}/`),
];

export default function sitemap(): MetadataRoute.Sitemap {
  const translated = translatedPaths.flatMap((path) => {
    const alternates = alternatesFor(path);
    const languages = {
      ...Object.fromEntries(LANGS.map((l) => [CONTENT[l].hreflang, `${SITE.url}${alternates[l]}`])),
      'x-default': `${SITE.url}${alternates.en}`,
    };
    return LANGS.map((l) => ({ url: `${SITE.url}${alternates[l]}`, alternates: { languages } }));
  });
  const englishOnly = [
    '/guides/', '/compare/',
    ...GUIDES.map((g) => `/guides/${g.slug}/`),
    ...films.map((f) => `/movie/${f.slug}/`),
    ...upcoming.map((f) => `/movie/${f.slug}/`),
    ...[...people.keys()].map((slug) => `/person/${slug}/`),
  ].map((path) => ({ url: `${SITE.url}${path}` }));
  return [...translated, ...englishOnly];
}
