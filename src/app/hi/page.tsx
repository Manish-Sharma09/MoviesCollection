import { HomePage, homeMetadata } from '@/views/home';

export const metadata = homeMetadata('hi');

export default function Page() {
  return <HomePage lang="hi" />;
}
