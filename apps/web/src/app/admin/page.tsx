import Link from 'next/link';
import { Suspense } from 'react';
import { UsersTable } from '@/components/admin/UsersTable';
import { requireAdmin } from '@/lib/admin';
import { getUserStats, listUsers, pendingSuggestions } from '@/lib/admin-data';
import { formatNumber } from '@/lib/format';

export default function AdminHome() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  await requireAdmin();
  const [stats, latest, toReview] = await Promise.all([getUserStats(), listUsers({ page: 1, limit: 10 }), pendingSuggestions()]);
  const cards = [
    { label: 'Users', value: stats.total },
    { label: 'Joined today', value: stats.today },
    { label: 'Joined in 7 days', value: stats.week },
    { label: 'Joined in 30 days', value: stats.month },
    { label: 'Signed in, last 7 days', value: stats.activeWeek },
    { label: 'Alerts on', value: stats.alertsOn },
    { label: 'Watching a company', value: stats.watchers, note: `${formatNumber(stats.watches)} watches` },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-bold tracking-[0.18em] text-slate-500 uppercase">Admin</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Overview</h1>
      </div>
      {toReview > 0 && (
        <Link href="/admin/suggestions" className="block rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900 hover:bg-amber-100">
          {formatNumber(toReview)} suggested {toReview === 1 ? 'link is' : 'links are'} waiting for review →
        </Link>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <li key={c.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{formatNumber(c.value)}</p>
            {c.note && <p className="text-xs text-slate-500">{c.note}</p>}
          </li>
        ))}
      </ul>
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Latest sign-ups</h2>
          <Link href="/admin/users" className="text-sm font-medium text-indigo-700 hover:underline">All users →</Link>
        </div>
        <UsersTable users={latest.users} empty="No one has signed up yet." />
      </section>
    </div>
  );
}
