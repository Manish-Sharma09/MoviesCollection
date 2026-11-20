import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Posters come from TMDB already sized (w92/w342/w1280) and a static export has no image
      // optimizer, so plain <img> is intended.
      '@next/next/no-img-element': 'off',
      // Internal links are plain <a> on purpose: full page loads need no RSC payload files, which
      // scripts/postbuild.mjs removes to stay under Cloudflare Pages' 20,000-file limit.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'dist/**', 'build/**', '.backup/**', 'next-env.d.ts']),
]);
