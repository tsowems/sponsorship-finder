'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { onOpenCookieSettings, openCookieSettings, setConsent, useConsent } from '@/lib/consent';

export function CookieBanner() {
  const consent = useConsent();
  const [reopened, setReopened] = useState(false);

  useEffect(() => onOpenCookieSettings(() => setReopened(true)), []);

  // undefined = server render / before hydration: render nothing so the static HTML stays clean.
  if (consent === undefined || (consent !== null && !reopened)) return null;

  const choose = (choice: 'all' | 'essential') => {
    setConsent(choice);
    setReopened(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 shadow-[0_-4px_20px_rgba(15,23,42,0.08)] backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-700">
          We use <strong>essential cookies</strong> to keep you signed in. We don&apos;t use advertising or tracking cookies. If we add
          analytics in future, it will only run if you choose &ldquo;Accept all&rdquo;.{' '}
          <Link href="/privacy#cookies" className="text-indigo-700 underline">Learn more</Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose('essential')}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => choose('all')}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}

export function CookieSettingsButton() {
  return (
    <button type="button" onClick={openCookieSettings} className="underline hover:text-slate-700">
      Cookie settings
    </button>
  );
}
