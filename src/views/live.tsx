// /live/ and /hi/live/: live box office collection of every film in cinemas.
import type { Metadata } from 'next';
import { LiveBoard } from '@/components/client/LiveBoard';
import { PageShell } from '@/components/PageShell';
import { Crumbs, Html, JsonLd } from '@/components/ui';
import { BUILD_TIME, cinemaBoard, inCinemas, STATS } from '@/lib/data';
import { alternatesFor, CONTENT, localePath, type Lang } from '@/lib/i18n';
import { crumbsLd, itemListLd, pageMetadata, type Crumb } from '@/lib/seo';
import { SITE } from '@/lib/site';

const content = (lang: Lang) => CONTENT[lang].pages.live(STATS, inCinemas.length);

export function liveMetadata(lang: Lang): Metadata {
  const p = content(lang);
  return pageMetadata({
    lang, path: localePath(lang, '/live/'), title: `${p.title} | ${SITE.name}`, description: p.description,
    alternates: alternatesFor('/live/'),
  });
}

export function LivePage({ lang }: { lang: Lang }) {
  const p = content(lang);
  const crumbs: Crumb[] = [[CONTENT[lang].ui.home, localePath(lang, '/')], [p.h1, localePath(lang, '/live/')]];
  return (
    <PageShell lang={lang} nav="/live/" alternates={alternatesFor('/live/')}>
      <JsonLd data={[crumbsLd(crumbs), itemListLd(inCinemas, p.h1)]} />
      <Crumbs lang={lang} items={crumbs} />
      <div className="page-head"><h1>{p.h1}</h1><Html as="p" html={p.intro} /></div>
      <LiveBoard initial={cinemaBoard()} buildTime={BUILD_TIME} />
      <Html as="p" className="note" html={p.note} />
    </PageShell>
  );
}
