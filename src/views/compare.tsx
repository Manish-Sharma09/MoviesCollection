// /compare/: any two films side by side (English only, like film pages). The page is static; the tool reads
// the chosen films from the address and their figures from their own pages (src/components/client/compare).
import type { Metadata } from 'next';
import { CompareTool } from '@/components/client/compare/CompareTool';
import { PageShell } from '@/components/PageShell';
import { Crumbs, JsonLd } from '@/components/ui';
import { comparePairs } from '@/lib/insights';
import { CPI_YEAR } from '@/lib/inflation';
import { crumbsLd, pageMetadata, type Crumb } from '@/lib/seo';
import { SITE } from '@/lib/site';

const crumbs: Crumb[] = [['Home', '/'], ['Compare films', '/compare/']];

export const compareMetadata = (): Metadata => pageMetadata({
  lang: 'en',
  path: '/compare/',
  title: `Compare box office collection of any two films | ${SITE.name}`,
  description: 'Compare the box office of any two films side by side: worldwide gross, budget, opening day, the race by day of release and the gross in today’s money, for Bollywood, South Indian and Hollywood films.',
});

export function ComparePage() {
  const pairs = comparePairs(6);
  return (
    <PageShell lang="en">
      <JsonLd data={[crumbsLd(crumbs), {
        '@context': 'https://schema.org', '@type': 'WebApplication', name: `${SITE.name} box office compare`,
        url: `${SITE.url}/compare/`, applicationCategory: 'EntertainmentApplication', operatingSystem: 'Any',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
      }]} />
      <Crumbs lang="en" items={crumbs} />
      <div className="page-head">
        <h1>Compare box office</h1>
        <p>
          Any two films, from any year and any language, side by side: worldwide gross, budget, opening day,
          their race by day of release{CPI_YEAR ? <>, and what each one took in {CPI_YEAR} money</> : null}.
          The address keeps both films, so you can share the comparison.
        </p>
      </div>
      <CompareTool pairs={pairs} />
    </PageShell>
  );
}
