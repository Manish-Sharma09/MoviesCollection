// The <html> document shared by the two root layouts: src/app/(en)/layout.tsx and src/app/hi/layout.tsx.
// Text uses the platform's system font (see site.css), so no web fonts are downloaded.
//
// Google tags (only when GA_ID or ADSENSE_CLIENT is set): Consent Mode defaults come first, so visitors in
// the EEA, the UK and Switzerland get no ad or analytics cookies until they agree in Google's consent
// message (set up in AdSense under Privacy & messaging); everyone else starts with consent granted.
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { CONTENT, type Lang } from '@/lib/i18n';
import { ADSENSE_CLIENT, GA_ID, SITE } from '@/lib/site';
import { THEME_COLORS, THEME_SCRIPT } from '@/lib/theme';
import { LangProvider, PressFeedback } from './client/basics';
import { Intro } from './Intro';

export const siteMetadata: Metadata = {
  metadataBase: new URL(SITE.url),
  icons: {
    icon: [{ url: '/favicon.ico', sizes: '32x32' }, { url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: '/apple-touch-icon.png',
  },
  // AdSense site verification.
  ...(ADSENSE_CLIENT && { other: { 'google-adsense-account': ADSENSE_CLIENT } }),
};

/** The European Economic Area, the United Kingdom and Switzerland: consent is asked before ad or analytics cookies. */
const CONSENT_REGIONS = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT', 'LV', 'LI', 'LT', 'LU',
  'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'CH',
];
const CONSENT_SCRIPT = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}`
  + `gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',region:${JSON.stringify(CONSENT_REGIONS)},wait_for_update:500});`
  + `gtag('consent','default',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'});`;

/**
 * The AdSense tag, added by the same inline script right after the consent defaults. A <script async> element
 * would be hoisted by React above every other head tag, ahead of the defaults. (Site verification uses the
 * google-adsense-account meta tag.)
 */
const adsenseLoader = (client: string) =>
  `var s=document.createElement('script');s.async=true;s.crossOrigin='anonymous';`
  + `s.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}';document.head.appendChild(s);`;

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
      {GA_ID || ADSENSE_CLIENT ? (
        // In an App Router root layout <head> is the supported way to place tags first (next/head is Pages Router only).
        // eslint-disable-next-line @next/next/no-head-element
        <head>
          <script dangerouslySetInnerHTML={{ __html: CONSENT_SCRIPT + (ADSENSE_CLIENT ? adsenseLoader(ADSENSE_CLIENT) : '') }} />
        </head>
      ) : null}
      <body>
        {/* Runs before the page paints, so a saved theme never flashes the other one. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* First visit of a session only (the script above decides); hidden otherwise. */}
        <Intro />
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
