import { YearsPage, yearsMetadata } from '@/views/charts';

export const metadata = yearsMetadata('en');

export default function Page() {
  return <YearsPage lang="en" />;
}
