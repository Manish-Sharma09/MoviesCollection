// English only: see src/lib/i18n.ts.
import { PersonPage, personMetadata, personParams } from '@/views/film';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return personParams();
}

export async function generateMetadata({ params }: Props) {
  return personMetadata((await params).slug);
}

export default async function Page({ params }: Props) {
  return <PersonPage slug={(await params).slug} />;
}
