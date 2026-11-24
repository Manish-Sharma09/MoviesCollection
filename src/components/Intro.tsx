// The intro overlay: the logo, the site's name and a loading line on an ink screen, shown on the first page a
// visitor opens in a browser session (the head script in src/lib/theme.ts decides, and adds `preload` to
// <html> before the first paint; without it the overlay is display: none). The flat logo animates at once;
// src/components/client/Intro.tsx then lifts it into a 3D ticket (three.js, loaded on demand) and, once the
// page has loaded, tears the overlay open along a perforation. Decorative only: hidden from screen readers.
import { SITE } from '@/lib/site';
import { IntroController } from './client/Intro';

/** "LiveGross" → Live + <b>Gross</b> (the second word in amber); other names are shown as they are. */
function Wordmark({ name }: { name: string }) {
  const parts = name.match(/^([A-Z][a-z]+)([A-Z][A-Za-z]+)$/);
  return <p className="intro-name">{parts ? <>{parts[1]}<b>{parts[2]}</b></> : name}</p>;
}

export function Intro() {
  return (
    <div className="intro" id="intro" aria-hidden="true">
      <div className="intro-half intro-top" />
      <div className="intro-half intro-bottom" />
      <i className="intro-tear" />
      <canvas className="intro-canvas" />
      <div className="intro-center">
        {/* public/favicon.svg, with the bars drawn separately so they can rise. */}
        <svg className="intro-mark" viewBox="0 0 64 64">
          <defs>
            <linearGradient id="intro-amber" x1="8" y1="0" x2="56" y2="64" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ffbf47" />
              <stop offset="1" stopColor="#ff7a1a" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="15" fill="url(#intro-amber)" />
          <path fill="#1d1d1f" d="M16 17h32a5 5 0 0 1 5 5v4a6 6 0 0 0 0 12v4a5 5 0 0 1-5 5H16a5 5 0 0 1-5-5v-4a6 6 0 0 0 0-12v-4a5 5 0 0 1 5-5Z" />
          <rect className="intro-bar" x="20" y="34" width="6" height="6" rx="1" fill="url(#intro-amber)" />
          <rect className="intro-bar" x="29" y="29" width="6" height="11" rx="1" fill="url(#intro-amber)" />
          <rect className="intro-bar" x="38" y="24" width="6" height="16" rx="1" fill="url(#intro-amber)" />
        </svg>
        <Wordmark name={SITE.name} />
        <span className="intro-progress"><i /></span>
      </div>
      <IntroController />
    </div>
  );
}
