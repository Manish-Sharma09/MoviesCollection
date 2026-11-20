import { NotFoundPage, notFoundMetadata } from '@/views/site-pages';

export const metadata = notFoundMetadata('en');

export default function Page() {
  return <NotFoundPage lang="en" />;
}
