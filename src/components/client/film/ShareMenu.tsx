'use client';
// Share: a small menu with the share image (film pages), WhatsApp, X, copy link and, where the device has one,
// the system share sheet. The image is drawn when the menu opens, so it is ready by the time it is tapped
// (iOS only lets a page open the share sheet straight after a tap).
import { useEffect, useRef, useState } from 'react';
import { useCurrency } from '../hooks';
import { cardFigure, renderCard, type CardData } from './share-card';

type Item = { key: string; label: string; run: () => void | Promise<void> };

const ICON = <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10V2.5M5 5.5l3-3 3 3M3.5 8.5v4a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-4" /></svg>;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** `text`: the message sent with the link; for a film, worked out from the card's figure at that moment. */
export function ShareMenu({ title, text, card }: { title: string; text?: string; card?: CardData }) {
  const mode = useCurrency();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [canFiles, setCanFiles] = useState(false);
  const [hasSheet, setHasSheet] = useState(false);
  const image = useRef<Promise<Blob> | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const cur = mode || card?.native || 'INR';

  const message = () => (card ? `${card.title} box office collection: ${cardFigure(card, cur, Date.now()).text} worldwide` : text ?? title);
  const pageUrl = () => window.location.href.split('#')[0];
  const fileName = () => `${card?.slug ?? 'box-office'}-box-office.png`;

  const say = (s: string) => {
    setStatus(s);
    setTimeout(() => setStatus(''), 2500);
  };

  const toggle = () => {
    if (open) return setOpen(false);
    setHasSheet(typeof navigator.share === 'function');
    try {
      setCanFiles(Boolean(navigator.canShare?.({ files: [new File([''], 'x.png', { type: 'image/png' })] })));
    } catch {
      setCanFiles(false);
    }
    if (card) image.current = renderCard(card, cur, Date.now());
    setOpen(true);
  };

  // Close on Escape or a press outside; focus the first item on open.
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus();
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        box.current?.querySelector<HTMLElement>('.share-button')?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items: Item[] = [];
  if (card) {
    items.push({
      key: 'image',
      label: canFiles ? 'Share image' : 'Save image',
      run: async () => {
        try {
          const blob = await (image.current ??= renderCard(card, cur, Date.now()));
          const file = new File([blob], fileName(), { type: 'image/png' });
          if (canFiles) {
            try {
              await navigator.share({ files: [file], title, text: `${message()} ${pageUrl()}` });
              return;
            } catch (e) {
              if ((e as Error).name === 'AbortError') return;
              // Not allowed (the tap was too long ago) or refused: save the picture instead.
            }
          }
          download(blob, fileName());
          say('Image saved');
        } catch {
          say('Could not make the image');
        }
      },
    });
  }
  items.push(
    { key: 'whatsapp', label: 'WhatsApp', run: () => { window.open(`https://wa.me/?text=${encodeURIComponent(`${message()} ${pageUrl()}`)}`, '_blank', 'noopener'); } },
    { key: 'x', label: 'X (Twitter)', run: () => { window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message())}&url=${encodeURIComponent(pageUrl())}`, '_blank', 'noopener'); } },
    {
      key: 'copy',
      label: 'Copy link',
      run: async () => {
        try {
          await navigator.clipboard.writeText(pageUrl());
          say('Link copied');
        } catch {
          say('Copy blocked by the browser');
        }
      },
    },
  );
  if (hasSheet) {
    items.push({ key: 'more', label: 'More…', run: async () => { try { await navigator.share({ title, text: message(), url: pageUrl() }); } catch { /* dismissed */ } } });
  }

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const list = [...(menu.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
    const i = list.indexOf(document.activeElement as HTMLElement);
    list[(i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]?.focus();
  };

  return (
    <div className="share" ref={box}>
      <button type="button" className="share-button" aria-haspopup="menu" aria-expanded={open} onClick={toggle}>
        {ICON}<span>Share</span>
      </button>
      {open ? (
        <div className="share-menu" role="menu" aria-label="Share" ref={menu} onKeyDown={onMenuKey}>
          {items.map((it) => (
            <button key={it.key} type="button" role="menuitem" className={`share-item share-${it.key}`}
              onClick={async () => { await it.run(); setOpen(false); }}>
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
      <span className="share-status" role="status" aria-live="polite">{status}</span>
    </div>
  );
}
