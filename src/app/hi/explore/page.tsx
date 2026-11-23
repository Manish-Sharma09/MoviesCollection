import { ExplorePage, exploreMetadata } from '@/views/home';

export const metadata = exploreMetadata('hi');

export default function Page() {
  return <ExplorePage lang="hi" />;
}
