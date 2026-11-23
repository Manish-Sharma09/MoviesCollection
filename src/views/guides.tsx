// /guides/ and /guides/[slug]/: original explainers (English only; see src/content/guides.ts).
import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';
import { Crumbs, Html, JsonLd } from '@/components/ui';
import { GUIDES, guideBySlug, type Guide } from '@/content/guides';
import { formatDate } from '@/lib/format';
import { guideFacts } from '@/lib/guide-facts';
import { crumbsLd, pageMetadata, type Crumb } from '@/lib/seo';
import { SITE } from '@/lib/site';

const INDEX_TITLE = 'Box office guides';
const INDEX_LEAD = `Plain-English explainers on how box office numbers work: what gross, net and share mean, why sources disagree, how to read a day-wise chart, and how ${SITE.name} calculates its live estimates.`;

/** Byline name: the site owner when set (SITE_OWNER), otherwise the site's team. */
const author = () => SITE.owner || `${SITE.name} team`;

const bodyOf = (g: Guide) => g.body(guideFacts());
/** Reading time at about 220 words a minute. */
const minutesOf = (html: string) => Math.max(1, Math.round(html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length / 220));

// ---------- /guides/ ----------

export const guidesIndexMetadata = (): Metadata =>
  pageMetadata({ lang: 'en', path: '/guides/', title: `${INDEX_TITLE}: how box office collection works | ${SITE.name}`, description: INDEX_LEAD });

/** Guide cards, used on the guides index and the home page. */
export function GuideCards({ guides = GUIDES, lang }: { guides?: Guide[]; lang?: string }) {
  return (
    <ul className="guide-cards" lang={lang}>
      {guides.map((g) => (
        <li key={g.slug} data-reveal="">
          <a className="guide-card" href={`/guides/${g.slug}/`}>
            <b>{g.title}</b>
            <span>{g.description}</span>
            <small>{minutesOf(bodyOf(g))} min read</small>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function GuidesIndexPage() {
  const crumbs: Crumb[] = [['Home', '/'], ['Guides', '/guides/']];
  return (
    <PageShell lang="en" nav="/guides/">
      <JsonLd data={[
        crumbsLd(crumbs),
        {
          '@context': 'https://schema.org', '@type': 'ItemList', name: INDEX_TITLE,
          itemListElement: GUIDES.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE.url}/guides/${g.slug}/` })),
        },
      ]} />
      <Crumbs lang="en" items={crumbs} />
      <div className="page-head">
        <h1>{INDEX_TITLE}</h1>
        <p>{INDEX_LEAD}</p>
      </div>
      <GuideCards />
    </PageShell>
  );
}

// ---------- /guides/[slug]/ ----------

export const guideParams = () => GUIDES.map((g) => ({ slug: g.slug }));

function guideContent(slug: string) {
  const g = guideBySlug.get(slug);
  if (!g) throw new Error(`Unknown guide: ${slug}`);
  const crumbs: Crumb[] = [['Home', '/'], ['Guides', '/guides/'], [g.title, `/guides/${g.slug}/`]];
  return { g, crumbs };
}

export function guideMetadata(slug: string): Metadata {
  const { g } = guideContent(slug);
  return pageMetadata({ lang: 'en', path: `/guides/${g.slug}/`, title: `${g.title} | ${SITE.name}`, description: g.description });
}

export function GuidePage({ slug }: { slug: string }) {
  const { g, crumbs } = guideContent(slug);
  const body = bodyOf(g);
  const related = g.related.map((s) => guideBySlug.get(s)).filter((x): x is Guide => Boolean(x));
  const changed = g.updated !== g.published;
  return (
    <PageShell lang="en" nav="/guides/">
      <JsonLd data={[
        crumbsLd(crumbs),
        {
          '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.description,
          url: `${SITE.url}/guides/${g.slug}/`, mainEntityOfPage: `${SITE.url}/guides/${g.slug}/`,
          datePublished: g.published, dateModified: g.updated, inLanguage: 'en',
          image: `${SITE.url}/og-image.png`,
          author: SITE.owner ? { '@type': 'Person', name: SITE.owner } : { '@type': 'Organization', name: SITE.name, url: SITE.url },
          publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url, logo: { '@type': 'ImageObject', url: `${SITE.url}/icon-512.png` } },
        },
      ]} />
      <Crumbs lang="en" items={crumbs} />
      <article className="guide">
        <header className="page-head">
          <h1>{g.title}</h1>
          <p>{g.description}</p>
          <p className="guide-meta">
            By {author()} · {changed ? 'Updated' : 'Published'} <time dateTime={g.updated}>{formatDate(g.updated)}</time> · {minutesOf(body)} min read
          </p>
        </header>
        <Html className="prose" html={body} />
      </article>
      {related.length ? (
        <section aria-labelledby="related">
          <h2 id="related">Related guides</h2>
          <GuideCards guides={related} />
          <a className="more" href="/guides/">All guides</a>
        </section>
      ) : null}
    </PageShell>
  );
}
