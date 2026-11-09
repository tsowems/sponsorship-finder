'use client';

import Link from 'next/link';
import { authClient } from '@/lib/auth-client';

/** Header sign-in state. Runs in the browser so every page can stay fully static. */
export function UserMenu() {
  const { data, isPending } = authClient.useSession();
  if (isPending) return <span className="inline-block h-5 w-16" aria-hidden />;
  return data?.user ? (
    <Link href="/account" className="rounded-xl px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900">My alerts</Link>
  ) : (
    <Link href="/login" className="inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-white shadow-sm shadow-indigo-600/25 hover:bg-indigo-700">Sign in</Link>
  );
}
