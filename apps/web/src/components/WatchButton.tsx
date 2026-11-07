'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type State = 'loading' | 'signed-out' | 'watching' | 'not-watching';

export function WatchButton({ sponsorId, slug }: { sponsorId: number; slug: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/watch?sponsorId=${sponsorId}`)
      .then((r) => r.json())
      .then((d: { signedIn: boolean; watching: boolean }) => {
        if (!cancelled) setState(!d.signedIn ? 'signed-out' : d.watching ? 'watching' : 'not-watching');
      })
      .catch(() => !cancelled && setState('signed-out'));
    return () => {
      cancelled = true;
    };
  }, [sponsorId]);

  async function toggle() {
    if (state === 'signed-out') {
      router.push(`/login?next=${encodeURIComponent(`/sponsors/${slug}`)}`);
      return;
    }
    setBusy(true);
    setError(null);
    const watching = state === 'watching';
    const res = await fetch('/api/watch', {
      method: watching ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sponsorId }),
    });
    setBusy(false);
    if (res.ok) setState(watching ? 'not-watching' : 'watching');
    else setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Something went wrong');
  }

  const watching = state === 'watching';
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-1 font-semibold">Get alerts</h2>
      <p className="mb-3 text-sm text-slate-600">We&apos;ll email you if this company is removed from the register or its rating changes.</p>
      <button
        type="button"
        onClick={toggle}
        disabled={state === 'loading' || busy}
        className={`w-full rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${
          watching ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50' : 'bg-indigo-600 text-white hover:bg-indigo-700'
        }`}
      >
        {state === 'loading' ? 'Watch this company' : watching ? '✓ Watching (click to stop)' : state === 'signed-out' ? 'Sign in to watch' : 'Watch this company'}
      </button>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
