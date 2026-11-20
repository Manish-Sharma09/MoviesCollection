import { NotFoundPage, notFoundMetadata } from '@/views/site-pages';

export const metadata = notFoundMetadata('hi');

export default function Page() {
  return <NotFoundPage lang="hi" />;
}
