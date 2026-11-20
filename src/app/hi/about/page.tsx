import { ProsePage, proseMetadata } from '@/views/site-pages';

export const metadata = proseMetadata('hi', 'about');

export default function Page() {
  return <ProsePage lang="hi" page="about" />;
}
