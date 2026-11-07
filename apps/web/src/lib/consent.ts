'use client';

import { useSyncExternalStore } from 'react';

/**
 * Cookie consent, stored in localStorage (per browser).
 *  - 'essential': only cookies the site needs to work (sign-in session)
 *  - 'all':       also optional cookies (analytics etc.), none of which exist yet
 *
 * When you add analytics, only load it when `useConsent() === 'all'`.
 */
export type Consent = 'essential' | 'all';

const KEY = 'cookie-consent-v1';
const EVENT = 'cookie-consent-change';
const OPEN_EVENT = 'cookie-settings-open';

function read(): Consent | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { choice?: Consent } | null;
    return v?.choice === 'all' || v?.choice === 'essential' ? v.choice : null;
  } catch {
    return null;
  }
}

export function setConsent(choice: Consent) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ choice, at: new Date().toISOString() }));
  } catch {
    /* storage blocked: the banner will simply ask again next visit */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb); // other tabs
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

/** Current choice; `null` = not chosen yet; `undefined` = server render (unknown). */
export function useConsent(): Consent | null | undefined {
  return useSyncExternalStore(subscribe, read, () => undefined);
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onOpenCookieSettings(cb: () => void) {
  window.addEventListener(OPEN_EVENT, cb);
  return () => window.removeEventListener(OPEN_EVENT, cb);
}
