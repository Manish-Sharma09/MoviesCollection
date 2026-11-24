import { UpcomingPage, upcomingMetadata } from '@/views/upcoming';

export const metadata = upcomingMetadata('hi');

export default function Page() {
  return <UpcomingPage lang="hi" />;
}
