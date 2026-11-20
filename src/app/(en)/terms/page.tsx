import { ProsePage, proseMetadata } from '@/views/site-pages';

export const metadata = proseMetadata('en', 'terms');

export default function Page() {
  return <ProsePage lang="en" page="terms" />;
}
