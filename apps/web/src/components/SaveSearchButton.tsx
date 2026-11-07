'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';

export function SaveSearchButton({ q, town }: { q?: string; town?: string }) {
  const router = useRouter();
  const { data, isPending } = authClient.useSession();
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');

  const label = [q && `“${q}”`, town && `in ${town}`].filter(Boolean).join(' ');

  async function save() {
    if (!data?.user) {
      const here = `/sponsors?${new URLSearchParams({ ...(q ? { q } : {}), ...(town ? { town } : {}) })}`;
      router.push(`/login?next=${encodeURIComponent(here)}`);
      return;
    }
    setStatus('saving');
    const res = await fetch('/api/saved-searches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, town }),
    });
    if (res.ok) setStatus('saved');
    else {
      setStatus('error');
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Could not save');
    }
  }

  if (status === 'saved') {
    return <p className="text-sm text-emerald-700">✓ We&apos;ll email you when new sponsors match {label}.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={save}
        disabled={isPending || status === 'saving'}
        className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
      >
        🔔 Email me new sponsors matching {label}
      </button>
      {status === 'error' && <span className="text-sm text-red-700">{error}</span>}
    </div>
  );
}
