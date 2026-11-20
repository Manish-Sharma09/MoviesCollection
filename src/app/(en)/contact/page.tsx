import { ProsePage, proseMetadata } from '@/views/site-pages';

export const metadata = proseMetadata('en', 'contact');

export default function Page() {
  return <ProsePage lang="en" page="contact" />;
}
