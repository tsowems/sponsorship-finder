import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { asc, desc, eq } from 'drizzle-orm';
import { getDb, savedSearches, sponsors, watches } from '@sponsors/db';
import { AddSearchForm, AlertsToggle, DeleteSearchButton, RemoveWatchButton, SignOutButton } from '@/components/AccountControls';
import { RatingBadge, StatusBadge } from '@/components/Badges';
import { isAdminUser } from '@/lib/admin';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'My alerts', robots: { index: false } };

export default function AccountPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading your alerts…</p>}>
      <Account />
    </Suspense>
  );
}

async function Account() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/account');

  const db = getDb();
  const [watched, searches] = await Promise.all([
    db
      .select({ id: sponsors.id, slug: sponsors.slug, name: sponsors.name, town: sponsors.town, status: sponsors.status, rating: sponsors.rating })
      .from(watches)
      .innerJoin(sponsors, eq(sponsors.id, watches.sponsorId))
      .where(eq(watches.userId, user.id))
      .orderBy(asc(sponsors.normalizedName)),
    db.select().from(savedSearches).where(eq(savedSearches.userId, user.id)).orderBy(desc(savedSearches.createdAt)),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My alerts</h1>
          <p className="mt-1 text-sm text-slate-600">Signed in as {user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Only rendered on the server for admins; nobody else ever sees this link. */}
          {isAdminUser(user) && (
            <Link href="/admin" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">
              Admin
            </Link>
          )}
          <SignOutButton />
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-1 font-semibold">Email alerts</h2>
        <p className="mb-3 text-sm text-slate-600">
          When the Home Office publishes a new register, we send one email listing every change to your watched companies and any new sponsors
          matching your searches. No email if nothing changed.
        </p>
        <AlertsToggle enabled={user.alertsEnabled !== false} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Companies you watch ({watched.length})</h2>
        {watched.length ? (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {watched.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/sponsors/${s.slug}`} className="font-medium text-slate-900 hover:text-indigo-700 hover:underline">{s.name}</Link>
                  <span className="ml-2 text-sm text-slate-500">{s.town}</span>
                </div>
                <div className="flex items-center gap-3">
                  {s.rating !== 'A' && <RatingBadge rating={s.rating} />}
                  <StatusBadge status={s.status} />
                  <RemoveWatchButton sponsorId={s.id} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
            You&apos;re not watching any companies yet. Open a company page and click <strong>Watch this company</strong>.{' '}
            <Link href="/sponsors" className="text-indigo-700 hover:underline">Search sponsors</Link>
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">New-sponsor alerts ({searches.length})</h2>
        <p className="text-sm text-slate-600">Get told when a newly licensed sponsor matches a name and/or town.</p>
        <AddSearchForm />
        {searches.length > 0 && (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {searches.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="text-slate-800">
                  New sponsors {s.query ? <>named <strong>“{s.query}”</strong></> : null}
                  {s.query && s.town ? ' ' : null}
                  {s.town ? <>in <strong>{s.town}</strong></> : null}
                </span>
                <DeleteSearchButton id={s.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
