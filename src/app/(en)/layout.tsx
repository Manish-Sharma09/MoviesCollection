import type { ReactNode } from 'react';
import { SiteDocument, siteMetadata, siteViewport } from '@/components/SiteDocument';
import '@/styles/site.css';

// Root layout for the English pages (/, /top/, /movie/…). /hi/ has its own root layout: src/app/hi/layout.tsx.
export const metadata = siteMetadata;
export const viewport = siteViewport;

export default function EnglishLayout({ children }: { children: ReactNode }) {
  return <SiteDocument lang="en">{children}</SiteDocument>;
}
