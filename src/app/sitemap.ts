// sitemap.xml with hreflang alternates for the translated pages.
import type { MetadataRoute } from 'next';
import { CLUBS, films, languages, people, yearsSorted } from '@/lib/data';
import { alternatesFor, CONTENT, LANGS } from '@/lib/i18n';
import { SITE } from '@/lib/site';

export const dynamic = 'force-static';

/** Pages that exist in every language, in the order the old static build listed them. */
const translatedPaths = [
  '/', '/live/', '/about/', '/contact/', '/privacy-policy/', '/terms/', '/top/', '/india/',
  ...CLUBS.map((c) => `/club/${c.slug}/`),
  '/years/',
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
    ...films.map((f) => `/movie/${f.slug}/`),
    ...[...people.keys()].map((slug) => `/person/${slug}/`),
  ].map((path) => ({ url: `${SITE.url}${path}` }));
  return [...translated, ...englishOnly];
}
