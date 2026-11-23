import { AdjustedPage, adjustedMetadata } from '@/views/charts';

export const metadata = adjustedMetadata('en', 'india');

export default function Page() {
  return <AdjustedPage lang="en" kind="india" />;
}
