import { ServerErrorPage, serverErrorMetadata } from '@/views/site-pages';

export const metadata = serverErrorMetadata();

export default function Page() {
  return <ServerErrorPage />;
}
