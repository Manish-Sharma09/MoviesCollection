import { ProsePage, proseMetadata } from '@/views/site-pages';

export const metadata = proseMetadata('hi', 'privacy-policy');

export default function Page() {
  return <ProsePage lang="hi" page="privacy-policy" />;
}
