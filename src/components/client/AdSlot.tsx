'use client';
// One Google AdSense display unit (only rendered when ADSENSE_SLOT is set; see src/lib/site.ts).
// The AdSense tag itself is loaded once per page by SiteDocument. Space is reserved in site.css so the
// page does not jump when the ad arrives, and a slot AdSense leaves unfilled collapses.
import { useEffect, useRef } from 'react';

declare global {
  interface Window { adsbygoogle?: object[] }
}

export function AdSlot({ client, slot, label }: { client: string; slot: string; label: string }) {
  const ref = useRef<HTMLModElement>(null);
  useEffect(() => {
    // AdSense marks a unit it has taken; asking twice (React runs effects twice in development) is an error.
    if (!ref.current || ref.current.dataset.adsbygoogleStatus) return;
    try {
      (window.adsbygoogle ||= []).push({});
    } catch {
      // Blocked by an ad blocker or not approved yet: the slot stays empty.
    }
  }, []);
  return (
    <aside className="ad" aria-label={label}>
      <span className="ad-label">{label}</span>
      <ins ref={ref} className="adsbygoogle" data-ad-client={client} data-ad-slot={slot}
        data-ad-format="auto" data-full-width-responsive="true" />
    </aside>
  );
}
