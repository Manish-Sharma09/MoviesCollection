import { Html } from '@/components/ui';
import { chart, CHART_URL, STATS, worldwide } from '@/lib/data';
import { formatCount } from '@/lib/format';
import { CONTENT, type Lang } from '@/lib/i18n';

export const worldwideTop = (n: number) => worldwide.slice(0, n);

/** "The top 50 are from Wikipedia's list of highest-grossing films, as of …; the rest …" */
export function worldwideNoteHtml(lang: Lang) {
  const asOf = new Date(chart.asOf).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
  });
  const link = `<a href="${CHART_URL}" rel="noopener">${CONTENT[lang].ui.chartSource}</a>`;
  return CONTENT[lang].worldwideNoteHtml(formatCount(STATS.listedCount), asOf, link);
}

export function WorldwideNote({ lang, className }: { lang: Lang; className?: string }) {
  return <Html as="p" className={className} html={worldwideNoteHtml(lang)} />;
}
