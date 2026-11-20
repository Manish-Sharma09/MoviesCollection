// English only: see src/lib/i18n.ts.
import { MoviePage, movieMetadata, movieParams } from '@/views/film';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return movieParams();
}

export async function generateMetadata({ params }: Props) {
  return movieMetadata((await params).slug);
}

export default async function Page({ params }: Props) {
  return <MoviePage slug={(await params).slug} />;
}
