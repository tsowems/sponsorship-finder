'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { authClient } from '@/lib/auth-client';

/**
 * Counts one page view per page shown (including client-side navigations). Cookieless: sends only
 * the path, the referring site and whether you're signed in. Honours "Do Not Track" / Global Privacy Control.
 */
export function PageViewTracker() {
  const path = usePathname();
  const { data, isPending } = authClient.useSession();
  const last = useRef<string | null>(null);
  const firstView = useRef(true);

  useEffect(() => {
    if (isPending || !path || last.current === path) return;
    last.current = path;
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.doNotTrack === '1' || nav.globalPrivacyControl || nav.webdriver) return;
    // Only the first page of a visit has an outside referrer; later pages are internal.
    const referrer = firstView.current ? document.referrer : '';
    firstView.current = false;
    const body = JSON.stringify({ path, referrer, signedIn: Boolean(data?.user) });
    try {
      if (!navigator.sendBeacon?.('/api/collect', new Blob([body], { type: 'application/json' }))) {
        void fetch('/api/collect', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } });
      }
    } catch {
      /* never break the page over analytics */
    }
  }, [path, isPending, data?.user]);

  return null;
}
