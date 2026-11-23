// English only, like film pages: see src/content/guides.ts.
import { GuidePage, guideMetadata, guideParams } from '@/views/guides';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return guideParams();
}

export async function generateMetadata({ params }: Props) {
  return guideMetadata((await params).slug);
}

export default async function Page({ params }: Props) {
  return <GuidePage slug={(await params).slug} />;
}
