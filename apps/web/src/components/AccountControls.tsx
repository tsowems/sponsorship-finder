'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { authClient } from '@/lib/auth-client';

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Request failed');
}

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      setError(null);
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    });
  return { pending, error, run };
}

export function RemoveWatchButton({ sponsorId }: { sponsorId: number }) {
  const { pending, run } = useAction();
  return (
    <button type="button" disabled={pending} onClick={() => run(() => send('/api/watch', 'DELETE', { sponsorId }))} className="text-sm text-slate-500 hover:text-red-700 disabled:opacity-50">
      {pending ? 'Removing…' : 'Stop watching'}
    </button>
  );
}

export function DeleteSearchButton({ id }: { id: number }) {
  const { pending, run } = useAction();
  return (
    <button type="button" disabled={pending} onClick={() => run(() => send('/api/saved-searches', 'DELETE', { id }))} className="text-sm text-slate-500 hover:text-red-700 disabled:opacity-50">
      {pending ? 'Deleting…' : 'Delete'}
    </button>
  );
}

export function AddSearchForm() {
  const { pending, error, run } = useAction();
  const [q, setQ] = useState('');
  const [town, setTown] = useState('');
  const input = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm';
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await send('/api/saved-searches', 'POST', { q, town });
          setQ('');
          setTown('');
        });
      }}
      className="space-y-2"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name contains, e.g. software" className={input} aria-label="Name contains" />
        <input value={town} onChange={(e) => setTown(e.target.value)} placeholder="Town, e.g. Manchester" className={`${input} sm:max-w-48`} aria-label="Town" />
        <button type="submit" disabled={pending || (!q.trim() && !town.trim())} className="h-10 shrink-0 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          Add alert
        </button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </form>
  );
}

export function AlertsToggle({ enabled }: { enabled: boolean }) {
  const { pending, error, run } = useAction();
  return (
    <div>
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={enabled}
          disabled={pending}
          onChange={(e) => run(() => send('/api/account/alerts', 'POST', { enabled: e.target.checked }))}
          className="h-4 w-4 accent-indigo-600"
        />
        <span className="text-sm text-slate-800">Send me alert emails</span>
      </label>
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut();
        router.push('/');
        router.refresh();
      }}
      className="text-sm text-slate-600 hover:text-slate-900"
    >
      Sign out
    </button>
  );
}
