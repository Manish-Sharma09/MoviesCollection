import { ProsePage, proseMetadata } from '@/views/site-pages';

export const metadata = proseMetadata('hi', 'contact');

export default function Page() {
  return <ProsePage lang="hi" page="contact" />;
}
