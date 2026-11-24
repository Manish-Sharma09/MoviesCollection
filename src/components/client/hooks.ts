// Small browser stores shared by the client components (import only from client components): the ₹/$ preference, the theme and a
// one-second clock for live estimates. Each uses useSyncExternalStore with a server snapshot,
// so the static HTML (native currency, dark theme, reported figure) hydrates without a mismatch
// and switches to the visitor's settings right after.
import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Currency, Lang } from '@/lib/format';
import { STEP } from '@/lib/live';
import { THEME_COLORS, THEME_KEY } from '@/lib/theme';

type Listener = () => void;

function createStore<T>(read: () => T) {
  const listeners = new Set<Listener>();
  let value: { v: T } | null = null;
  return {
    get: () => (value ??= { v: read() }).v,
    set(v: T) {
      value = { v };
      listeners.forEach((l) => l());
    },
    refresh() {
      value = null;
      listeners.forEach((l) => l());
    },
    subscribe(l: Listener) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

const storage = {
  get(key: string) {
    try { return localStorage.getItem(key); } catch { return null; } // private mode
  },
  set(key: string, v: string | null) {
    try { if (v) localStorage.setItem(key, v); else localStorage.removeItem(key); } catch { /* private mode */ }
  },
};

// ---------- page language ----------

export const LangContext = createContext<Lang>('en');
export const useLang = () => useContext(LangContext);

// ---------- currency: null means each film's own currency ----------

const CURRENCY_KEY = 'cb.currency';
const readCurrency = (): Currency | null => {
  const v = storage.get(CURRENCY_KEY);
  return v === 'INR' || v === 'USD' ? v : null;
};
const currency = createStore(readCurrency);
const subscribeCurrency = (l: Listener) => {
  const off = currency.subscribe(l);
  const onStorage = (e: StorageEvent) => { if (e.key === CURRENCY_KEY) currency.refresh(); };
  window.addEventListener('storage', onStorage);
  return () => { off(); window.removeEventListener('storage', onStorage); };
};

export const useCurrency = () => useSyncExternalStore(subscribeCurrency, currency.get, () => null);
export function setCurrency(mode: Currency | null) {
  storage.set(CURRENCY_KEY, mode);
  currency.set(mode);
}

// ---------- theme: follows the OS until the visitor picks one (src/lib/theme.ts applies it before paint) ----------

const prefersLight = () => window.matchMedia('(prefers-color-scheme: light)');
const readLight = () => {
  const chosen = document.documentElement.dataset.theme;
  return chosen ? chosen === 'light' : prefersLight().matches;
};
const theme = createStore(readLight);
const subscribeTheme = (l: Listener) => {
  const off = theme.subscribe(l);
  const media = prefersLight();
  const onChange = () => theme.refresh();
  media.addEventListener('change', onChange);
  return () => { off(); media.removeEventListener('change', onChange); };
};

/** Whether the page is showing the light theme (by choice or by the OS); false while hydrating. */
export const useLightTheme = () => useSyncExternalStore(subscribeTheme, theme.get, () => false);

export function toggleTheme() {
  const light = !theme.get();
  const apply = () => {
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    document.querySelectorAll<HTMLMetaElement>('meta[name=theme-color]')
      .forEach((m) => { m.content = light ? THEME_COLORS.light : THEME_COLORS.dark; });
    theme.set(light);
  };
  storage.set(THEME_KEY, light ? 'light' : 'dark');
  // Cross-fade the whole page so the brightness change is eased, not a flash.
  if (document.startViewTransition) document.startViewTransition(apply);
  else apply();
}

// ---------- clock for live estimates ----------

const clock = createStore(() => Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
let subscribers = 0;
const subscribeClock = (l: Listener) => {
  const off = clock.subscribe(l);
  if (subscribers++ === 0) {
    clock.set(Date.now());
    timer = setInterval(() => clock.set(Date.now()), 1000);
  }
  return () => {
    off();
    if (--subscribers === 0) clearInterval(timer);
  };
};

/** Current time, ticking every second; null while the page hydrates. */
export const useNow = () => useSyncExternalStore(subscribeClock, clock.get, () => null);

/** Start of the current 1-minute step; only changes when a new step begins. */
export const useLiveStep = () =>
  useSyncExternalStore(subscribeClock, () => Math.floor(clock.get() / STEP) * STEP, () => null);
