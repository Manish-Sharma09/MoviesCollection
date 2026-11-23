import { AdjustedPage, adjustedMetadata } from '@/views/charts';

export const metadata = adjustedMetadata('hi', 'india');

export default function Page() {
  return <AdjustedPage lang="hi" kind="india" />;
}
