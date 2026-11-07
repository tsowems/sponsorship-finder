'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';

function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/account';
}

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const linkError = params.get('error');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: next,
      errorCallbackURL: `/login?error=link&next=${encodeURIComponent(next)}`,
    });
    if (error) {
      setStatus('error');
      setError(error.message ?? 'Could not send the link. Please try again.');
    } else setStatus('sent');
  }

  if (status === 'sent') {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-slate-800">
        <h2 className="font-semibold">Check your email</h2>
        <p className="mt-1 text-sm">
          We sent a sign-in link to <strong>{email}</strong>. It expires in 15 minutes.
        </p>
        <button type="button" onClick={() => setStatus('idle')} className="mt-3 text-sm text-indigo-700 hover:underline">
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {linkError && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">That sign-in link has expired or was already used. Request a new one below.</p>
      )}
      {googleEnabled && (
        <>
          <button
            type="button"
            onClick={() => authClient.signIn.social({ provider: 'google', callbackURL: next })}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 hover:bg-slate-50"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Continue with Google
          </button>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
          </div>
        </>
      )}
      <form onSubmit={sendLink} className="space-y-3">
        <label className="block text-sm font-medium text-slate-700" htmlFor="email">Email address</label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
        />
        <button type="submit" disabled={status === 'sending'} className="h-11 w-full rounded-lg bg-indigo-600 font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {status === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
        </button>
        {status === 'error' && <p className="text-sm text-red-700">{error}</p>}
      </form>
      <p className="text-xs text-slate-500">
        No password needed. We only use your email to sign you in and send the alerts you ask for. See our{' '}
        <Link href="/privacy" className="underline">privacy policy</Link>.
      </p>
    </div>
  );
}
