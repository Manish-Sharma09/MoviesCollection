import { ProsePage, proseMetadata } from '@/views/site-pages';

export const metadata = proseMetadata('en', 'about');

export default function Page() {
  return <ProsePage lang="en" page="about" />;
}
