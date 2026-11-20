import { ProsePage, proseMetadata } from '@/views/site-pages';

export const metadata = proseMetadata('en', 'privacy-policy');

export default function Page() {
  return <ProsePage lang="en" page="privacy-policy" />;
}
