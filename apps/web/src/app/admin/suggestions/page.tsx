import Link from 'next/link';
import { Suspense } from 'react';
import { desc, asc, eq, inArray } from 'drizzle-orm';
import { getDb, linkSuggestions, sponsors, user } from '@sponsors/db';
import { requireAdmin } from '@/lib/admin';
import { approveSuggestion, rejectSuggestion } from './actions';

/** Approving re-checks the company (~5–30 s). */
export const maxDuration = 60;

export default function SuggestionsAdmin() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <Suggestions />
    </Suspense>
  );
}

const columns = {
  id: linkSuggestions.id,
  kind: linkSuggestions.kind,
  url: linkSuggestions.url,
  status: linkSuggestions.status,
  acceptedBy: linkSuggestions.acceptedBy,
  note: linkSuggestions.note,
  createdAt: linkSuggestions.createdAt,
  reviewedAt: linkSuggestions.reviewedAt,
  sponsorName: sponsors.name,
  sponsorSlug: sponsors.slug,
  sponsorTown: sponsors.town,
  email: user.email,
};

async function Suggestions() {
  await requireAdmin();
  const db = getDb();
  const base = () => db.select(columns).from(linkSuggestions).innerJoin(sponsors, eq(sponsors.id, linkSuggestions.sponsorId)).leftJoin(user, eq(user.id, linkSuggestions.userId));
  const [pending, decided] = await Promise.all([
    base().where(eq(linkSuggestions.status, 'pending')).orderBy(asc(linkSuggestions.createdAt)).limit(100),
    base().where(inArray(linkSuggestions.status, ['accepted', 'rejected'])).orderBy(desc(linkSuggestions.reviewedAt)).limit(30),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-bold tracking-[0.18em] text-slate-500 uppercase">Admin</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Suggested links</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Websites and careers pages suggested by signed-in users that our checks couldn&apos;t confirm. Open the link, make sure it belongs to the
          company, then approve or reject it. Approved links are used on every future check of that company.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Waiting for review ({pending.length})</h2>
        {pending.length ? <Rows rows={pending} actions /> : <p className="text-sm text-slate-500">Nothing to review.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent decisions</h2>
        {decided.length ? <Rows rows={decided} /> : <p className="text-sm text-slate-500">None yet.</p>}
      </section>
    </div>
  );
}

interface Row {
  id: number;
  kind: string;
  url: string;
  status: string;
  acceptedBy: string | null;
  note: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  sponsorName: string;
  sponsorSlug: string;
  sponsorTown: string | null;
  email: string | null;
}

const when = (d: Date | null) => (d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' }) : '');

function Rows({ rows, actions = false }: { rows: Row[]; actions?: boolean }) {
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-start justify-between gap-4 p-4">
          <div className="min-w-0 space-y-1 text-sm">
            <p className="font-medium text-slate-900">
              <Link href={`/sponsors/${r.sponsorSlug}`} className="hover:underline" target="_blank">{r.sponsorName}</Link>
              <span className="font-normal text-slate-500"> · {r.sponsorTown}</span>
            </p>
            <p>
              <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">{r.kind === 'website' ? 'Website' : 'Careers'}</span>
              <a href={r.url} rel="noopener noreferrer nofollow" target="_blank" className="break-all text-indigo-700 hover:underline">{r.url} ↗</a>
            </p>
            <p className="text-xs text-slate-500">
              {r.email ?? 'deleted account'} · suggested {when(r.createdAt)}
              {r.reviewedAt && !actions ? ` · ${r.status === 'accepted' ? `accepted (${r.acceptedBy})` : 'rejected'} ${when(r.reviewedAt)}` : ''}
            </p>
            {r.note && <p className="text-xs text-slate-500">{r.note}</p>}
          </div>
          <div className="flex gap-2">
            {(actions || r.status === 'rejected') && (
              <form action={approveSuggestion}>
                <input type="hidden" name="id" value={r.id} />
                <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">Approve</button>
              </form>
            )}
            {(actions || r.status === 'accepted') && (
              <form action={rejectSuggestion}>
                <input type="hidden" name="id" value={r.id} />
                <button className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  {actions ? 'Reject' : 'Remove'}
                </button>
              </form>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
