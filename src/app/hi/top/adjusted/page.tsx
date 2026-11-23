import { AdjustedPage, adjustedMetadata } from '@/views/charts';

export const metadata = adjustedMetadata('hi', 'top');

export default function Page() {
  return <AdjustedPage lang="hi" kind="top" />;
}
