import { YearPage, yearMetadata, yearParams } from '@/views/charts';

type Props = { params: Promise<{ year: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return yearParams();
}

export async function generateMetadata({ params }: Props) {
  return yearMetadata('hi', (await params).year);
}

export default async function Page({ params }: Props) {
  return <YearPage lang="hi" year={(await params).year} />;
}
