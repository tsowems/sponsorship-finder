'use client';

import Link from 'next/link';
import { authClient } from '@/lib/auth-client';

/** Header sign-in state. Runs in the browser so every page can stay fully static. */
export function UserMenu() {
  const { data, isPending } = authClient.useSession();
  if (isPending) return <span className="inline-block h-5 w-16" aria-hidden />;
  return data?.user ? (
    <Link href="/account" className="hover:text-slate-900">My alerts</Link>
  ) : (
    <Link href="/login" className="rounded-md bg-slate-900 px-3 py-1 text-white hover:bg-slate-700">Sign in</Link>
  );
}
