import { ClubPage, clubMetadata, clubParams } from '@/views/charts';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return clubParams();
}

export async function generateMetadata({ params }: Props) {
  return clubMetadata('hi', (await params).slug);
}

export default async function Page({ params }: Props) {
  return <ClubPage lang="hi" slug={(await params).slug} />;
}
