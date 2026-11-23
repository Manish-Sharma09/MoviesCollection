// English only, like film pages: see src/content/guides.ts.
import { GuidesIndexPage, guidesIndexMetadata } from '@/views/guides';

export const metadata = guidesIndexMetadata();

export default function Page() {
  return <GuidesIndexPage />;
}
