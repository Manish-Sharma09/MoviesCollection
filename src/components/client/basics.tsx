'use client';
import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from 'react';
import { formatMoney, type Currency, type Lang } from '@/lib/format';
import { LangContext, setCurrency, toggleTheme, useCurrency, useLang, useLightTheme } from './hooks';

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext value={lang}>{children}</LangContext>;
}

/**
 * iOS Safari only applies :active styles once the page listens for touches. A passive no-op
 * listener turns on the press-down feedback (scale/highlight) defined in site.css.
 */
export function PressFeedback() {
  useEffect(() => {
    const noop = () => {};
    document.addEventListener('touchstart', noop, { passive: true });
    return () => document.removeEventListener('touchstart', noop);
  }, []);
  return null;
}

export const otherCurrency = (c: Currency): Currency => (c === 'INR' ? 'USD' : 'INR');

/**
 * An amount that follows the ₹/$ switch. `native` is the film's own currency (shown until the
 * visitor picks one); `alt` shows the other currency; `exact` writes dollars in full ($2,942,661,253).
 */
export function Money({ usd, inr, native = 'USD', alt = false, exact = false }: {
  usd: number; inr: number; native?: Currency; alt?: boolean; exact?: boolean;
}) {
  const lang = useLang();
  const mode = useCurrency();
  let cur = mode || native;
  if (alt) cur = otherCurrency(cur);
  return <span className="m">{exact && cur === 'USD' ? `$${usd.toLocaleString('en-US')}` : formatMoney({ usd, inr }, cur, lang)}</span>;
}

/** ₹ / $ segmented control. data-mode positions the sliding thumb (none = each film's own currency). */
export function CurrencySwitch({ label, inRupees, inDollars }: { label: string; inRupees: string; inDollars: string }) {
  const mode = useCurrency();
  // Pressing the active segment goes back to each film's own currency.
  const press = (c: Currency) => setCurrency(mode === c ? null : c);
  return (
    <div className="currency" role="group" aria-label={label} data-mode={mode ?? 'native'}>
      <button type="button" aria-pressed={mode === 'INR'} title={inRupees} onClick={() => press('INR')}>₹</button>
      <button type="button" aria-pressed={mode === 'USD'} title={inDollars} onClick={() => press('USD')}>$</button>
    </div>
  );
}

export function ThemeToggle({ label, children }: { label: string; children: ReactNode }) {
  const light = useLightTheme();
  return (
    <button type="button" className="theme-toggle" aria-pressed={light} title={label} onClick={toggleTheme}>
      <span className="sr-only">{label}</span>
      {children}
    </button>
  );
}

/**
 * Phones: the magnifier in the header focuses the (collapsed) header search field, which then expands.
 * With `jump` (the home page, whose search is in the banner) it is shown on every screen and scrolls to
 * that search field before focusing it.
 */
export function SearchToggle({ target, label, jump = false, tools = false }: { target: string; label: string; jump?: boolean; tools?: boolean }) {
  const open = () => {
    const field = document.getElementById(target);
    if (!field) return;
    if (jump) {
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      field.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
      field.focus({ preventScroll: true });
    } else field.focus();
  };
  return (
    <button type="button" className={tools ? 'search-toggle search-jump' : 'search-toggle'} aria-controls={target} title={label}
      onClick={open}>
      <span className="sr-only">{label}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
    </button>
  );
}

/** An image that hides itself when it fails to load, uncovering the title tile behind it. */
export function SafeImg(props: ImgHTMLAttributes<HTMLImageElement>) {
  const [broken, setBroken] = useState(false);
  return (
    // eslint-disable-next-line jsx-a11y/alt-text -- alt is passed through (decorative images use alt="")
    <img
      {...props}
      hidden={broken || undefined}
      onError={() => setBroken(true)}
      // The error may fire before hydration attaches onError; catch that case on mount.
      ref={(img) => { if (img && img.complete && !img.naturalWidth) setBroken(true); }}
    />
  );
}
