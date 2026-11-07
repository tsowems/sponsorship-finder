import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

export const metadata: Metadata = { title: 'Unsubscribe', robots: { index: false } };

type Search = Promise<Record<string, string | string[] | undefined>>;

export default function UnsubscribePage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="mx-auto max-w-md space-y-4 py-10 text-center">
      <Suspense>
        <Body searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Body({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  if (sp.done) {
    return (
      <>
        <h1 className="text-2xl font-semibold">You&apos;re unsubscribed</h1>
        <p className="text-slate-600">We won&apos;t send you any more alert emails. You can turn them back on from your account at any time.</p>
        <Link href="/account" className="text-indigo-700 hover:underline">Go to my alerts</Link>
      </>
    );
  }
  const u = typeof sp.u === 'string' ? sp.u : '';
  const t = typeof sp.t === 'string' ? sp.t : '';
  // A confirm button (rather than unsubscribing on GET) stops email link scanners unsubscribing people.
  return (
    <>
      <h1 className="text-2xl font-semibold">Unsubscribe from alerts?</h1>
      <p className="text-slate-600">You&apos;ll stop getting emails about watched companies and new sponsors.</p>
      <form method="post" action={`/api/unsubscribe?${new URLSearchParams({ u, t })}`}>
        <button type="submit" className="rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white hover:bg-slate-700">Unsubscribe</button>
      </form>
    </>
  );
}
