import type { ReactNode } from 'react';
import { SiteDocument, siteMetadata, siteViewport } from '@/components/SiteDocument';
import '@/styles/site.css';

// Root layout for the Hindi pages under /hi/ (<html lang="hi-IN">).
export const metadata = siteMetadata;
export const viewport = siteViewport;

export default function HindiLayout({ children }: { children: ReactNode }) {
  return <SiteDocument lang="hi">{children}</SiteDocument>;
}
