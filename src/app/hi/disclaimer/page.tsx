import { ProsePage, proseMetadata } from '@/views/site-pages';

export const metadata = proseMetadata('hi', 'disclaimer');

export default function Page() {
  return <ProsePage lang="hi" page="disclaimer" />;
}
