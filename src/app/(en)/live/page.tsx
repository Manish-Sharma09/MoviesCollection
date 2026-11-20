import { LivePage, liveMetadata } from '@/views/live';

export const metadata = liveMetadata('en');

export default function Page() {
  return <LivePage lang="en" />;
}
