// The <html> document shared by the two root layouts: src/app/(en)/layout.tsx and src/app/hi/layout.tsx.
// Text uses the platform's system font (see site.css), so no web fonts are downloaded.
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { CONTENT, type Lang } from '@/lib/i18n';
import { GA_ID, SITE } from '@/lib/site';
import { THEME_COLORS, THEME_SCRIPT } from '@/lib/theme';
import { LangProvider, PressFeedback } from './client/basics';

export const siteMetadata: Metadata = {
  metadataBase: new URL(SITE.url),
  icons: {
    icon: [{ url: '/favicon.ico', sizes: '32x32' }, { url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: '/apple-touch-icon.png',
  },
};

export const siteViewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLORS.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLORS.dark },
  ],
};

export function SiteDocument({ lang, children }: { lang: Lang; children: ReactNode }) {
  return (
    // data-theme is set by THEME_SCRIPT before React hydrates when the visitor chose a theme.
    <html lang={CONTENT[lang].htmlLang} suppressHydrationWarning>
      <body>
        {/* Runs before the page paints, so a saved theme never flashes the other one. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <PressFeedback />
        <LangProvider lang={lang}>{children}</LangProvider>
        {GA_ID ? (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}');`}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
