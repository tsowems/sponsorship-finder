'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';

/**
 * Asks the server to look up a company's website and open roles as soon as someone opens its page,
 * then reloads the page data to show what was found. Shows a small "checking" line mea/** Lookup state per company for this page load: 'checking' → 'done' | 'queued'. One request per company. */
const states = new Map<number, string>();
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const setState = (sponsorId: number, state: string) => {
  states.set(sponsorId, state);
  listeners.forEach((fn) => fn());
};

function requestLookup(sponsorId: number) {
  if (states.has(sponsorId)) return;
  try {
    const key = `profile-requested:${sponsorId}`;
    if (sessionStorage.getItem(key)) return; // already asked during this visit
    sessionStorage.setItem(key, '1');
  } catch {
    /* storage blocked: just send it */
  }
  setState(sponsorId, 'checking');
  fetch('/api/profile-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sponsorId }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { status?: string } | null) => setState(sponsorId, d?.status ?? 'queued'))
    .catch(() => setState(sponsorId, 'queued'));
}

export function ProfileRequest({ sponsorId }: { sponsorId: number }) {
  const router = useRouter();
  const state = useSyncExternalStore(subscribe, () => states.get(sponsorId), () => undefined);

  useEffect(() => requestLookup(sponsorId), [sponsorId]);
  useEffect(() => {
    if (state === 'done') router.refresh();
  }, [state, router]);

  if (state !== 'checking') return null;
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-indigo-700">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" aria-hidden />
      Checking their website and open roles now. This usually takes a few seconds…
    </p>
  );
}
