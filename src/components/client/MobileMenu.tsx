'use client';
// Phones and tablets: the header keeps only the brand, a magnifier and this menu button. The button slides in
// a panel from the right with the site's sections and the settings (currency, language, theme), each line
// sliding in after the one before. It closes with its ✕ button, a tap on the dimmed page, Esc, or a choice.
//
// The panel is rendered into <body> (a portal): the header's backdrop blur would otherwise make it the
// containing block for the panel's fixed position, trapping the panel inside the header bar.
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const noop = () => () => {};

export interface MenuLink { href: string; label: string; current: boolean; live?: boolean; hrefLang?: string }

export function MobileMenu({ links, settings, labels }: {
  links: MenuLink[];
  /** The currency switch, language link and theme toggle (rendered by the server). */
  settings: ReactNode;
  labels: { open: string; close: string; title: string; settings: string };
}) {
  const [open, setOpen] = useState(false);
  // False on the server and during hydration, true after: the portal needs document.body.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const button = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = 'hidden'; // the page does not scroll behind the panel
    closeButton.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    // Wider screens show the normal header again: close the panel if the window grows past the breakpoint.
    const wide = window.matchMedia('(min-width: 1241px)');
    const onWide = () => { if (wide.matches) setOpen(false); };
    wide.addEventListener('change', onWide);
    return () => {
      root.style.overflow = before;
      document.removeEventListener('keydown', onKey);
      wide.removeEventListener('change', onWide);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus({ preventScroll: true });
  };

  return (
    <>
      <button ref={button} type="button" className="menu-toggle" aria-expanded={open} aria-controls="site-menu"
        title={labels.open} onClick={() => setOpen(true)}>
        <span className="sr-only">{labels.open}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
      </button>
      {mounted ? createPortal(
        <div className={open ? 'menu-root is-open' : 'menu-root'} inert={!open}>
          <div className="menu-backdrop" onClick={close} aria-hidden="true" />
          <div id="site-menu" className="menu-panel" role="dialog" aria-modal="true" aria-label={labels.title}>
            <div className="menu-head">
              <span className="menu-title">{labels.title}</span>
              <button ref={closeButton} type="button" className="menu-close" onClick={close}>
                <span className="sr-only">{labels.close}</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <nav className="menu-links">
              {links.map((l, i) => (
                <a key={l.href} href={l.href} hrefLang={l.hrefLang} aria-current={l.current ? 'page' : undefined}
                  className={l.live ? 'is-live' : undefined} style={{ '--i': i } as CSSProperties} onClick={() => setOpen(false)}>
                  <span>{l.label}</span>
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
                </a>
              ))}
            </nav>
            <div className="menu-settings" style={{ '--i': links.length } as CSSProperties}>
              <p>{labels.settings}</p>
              <div className="menu-settings-row">{settings}</div>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
