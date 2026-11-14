'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

/** Other code (e.g. search suggestions using router.push) can start the indicator with this. */
export const NAV_START_EVENT = 'sh:navigation-start';
export const startNavigationProgress = () => window.dispatchEvent(new Event(NAV_START_EVENT));

/** Show the "Loading…" pill only if the page takes longer than this, so fast pages don't flash it. */
const PILL_DELAY_MS = 350;
/** Give up showing it after this long (e.g. a navigation that was cancelled). */
const MAX_MS = 20_000;

function isInternalNavigation(e: MouseEvent): boolean {
  // (No defaultPrevented check: Next's <Link> cancels the browser's own navigation to load the page itself.)
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const a = (e.target as Element | null)?.closest?.('a');
  if (!a || !a.href || a.target === '_blank' || a.hasAttribute('download')) return false;
  const to = new URL(a.href, location.href);
  if (to.origin !== location.origin) return false;
  // Same page (or only a #section on it): nothing to load.
  return to.pathname !== location.pathname || to.search !== location.search;
}

/**
 * Feedback while a page is loading: a thin animated bar across the top of the screen straight away, then a
 * "Loading…" pill with a spinner if it takes a moment. Starts on any click on an internal link (menus, industry and
 * city buttons, paging…) or a GET form submit, and stops when the new page's address is shown.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showPill, setShowPill] = useState(false);

  // A new address means the new page is showing.
  const at = `${pathname}?${searchParams.toString()}`;
  const [lastAt, setLastAt] = useState(at);
  if (at !== lastAt) {
    setLastAt(at);
    setLoading(false);
    setShowPill(false);
  }

  useEffect(() => {
    const start = () => setLoading(true);
    const onClick = (e: MouseEvent) => {
      if (isInternalNavigation(e)) start();
    };
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      if (!e.defaultPrevented && form && (form.method || 'get').toLowerCase() === 'get') start();
    };
    // Back/forward also loads a page.
    window.addEventListener('popstate', start);
    window.addEventListener(NAV_START_EVENT, start);
    // Capture phase: runs before Next's <Link> handles the click.
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit);
    return () => {
      window.removeEventListener('popstate', start);
      window.removeEventListener(NAV_START_EVENT, start);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit);
    };
  }, []);

  useEffect(() => {
    if (!loading) return;
    const pill = setTimeout(() => setShowPill(true), PILL_DELAY_MS);
    const giveUp = setTimeout(() => {
      setLoading(false);
      setShowPill(false);
    }, MAX_MS);
    return () => {
      clearTimeout(pill);
      clearTimeout(giveUp);
    };
  }, [loading]);

  if (!loading) return null;
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-indigo-100" role="progressbar" aria-label="Loading page">
        <div className="h-full w-1/3 animate-[navbar_1.1s_ease-in-out_infinite] rounded-r-full bg-indigo-600" />
      </div>
      {showPill && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg"
          style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Loading…
        </div>
      )}
    </>
  );
}
