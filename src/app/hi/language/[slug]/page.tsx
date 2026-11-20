import { LanguagePage, languageMetadata, languageParams } from '@/views/charts';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return languageParams();
}

export async function generateMetadata({ params }: Props) {
  return languageMetadata('hi', (await params).slug);
}

export default async function Page({ params }: Props) {
  return <LanguagePage lang="hi" slug={(await params).slug} />;
}
