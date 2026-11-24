import { UpcomingPage, upcomingMetadata } from '@/views/upcoming';

export const metadata = upcomingMetadata('en');

export default function Page() {
  return <UpcomingPage lang="en" />;
}
