import { Html } from '@/components/ui';
import { chart, MOJO_URL, worldwide } from '@/lib/data';
import { formatCount } from '@/lib/format';
import { CONTENT, type Lang } from '@/lib/i18n';

export const worldwideTop = (n: number) => worldwide.slice(0, n);

/** "Worldwide lifetime grosses for the top 200 films from Box Office Mojo, as of …" */
export function worldwideNoteHtml(lang: Lang) {
  const asOf = new Date(chart.asOf).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
  });
  return CONTENT[lang].worldwideNoteHtml(formatCount(worldwide.length), asOf, `<a href="${MOJO_URL}">Box Office Mojo</a>`);
}

export function WorldwideNote({ lang, className }: { lang: Lang; className?: string }) {
  return <Html as="p" className={className} html={worldwideNoteHtml(lang)} />;
}
