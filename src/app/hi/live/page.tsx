import { LivePage, liveMetadata } from '@/views/live';

export const metadata = liveMetadata('hi');

export default function Page() {
  return <LivePage lang="hi" />;
}
