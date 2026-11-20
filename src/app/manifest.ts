// Web app manifest (home-screen icon on phones).
import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';
import { THEME_COLORS } from '@/lib/theme';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.name,
    start_url: '/',
    display: 'standalone',
    // A manifest takes one colour; the installed app opens on the dark splash that matches its icon.
    background_color: THEME_COLORS.dark,
    theme_color: THEME_COLORS.dark,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
