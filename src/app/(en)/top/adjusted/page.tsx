import { AdjustedPage, adjustedMetadata } from '@/views/charts';

export const metadata = adjustedMetadata('en', 'top');

export default function Page() {
  return <AdjustedPage lang="en" kind="top" />;
}
