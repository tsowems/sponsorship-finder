import Link from 'next/link';
import { Suspense } from 'react';
import { UsersTable } from '@/components/admin/UsersTable';
import { buildHref, Pagination } from '@/components/Pagination';
import { requireAdmin } from '@/lib/admin';
import { listUsers, USERS_PAGE_SIZE, type UserSort } from '@/lib/admin-data';
import { firstParam, formatNumber, pageParam } from '@/lib/format';

type Search = Promise<Record<string, string | string[] | undefined>>;

export default function AdminUsersPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading users…</p>}>
      <Users searchParams={searchParams} />
    </Suspense>
  );
}

async function Users({ searchParams }: { searchParams: Search }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = firstParam(sp.q)?.trim().slice(0, 100) || undefined;
  const sort: UserSort = firstParam(sp.sort) === 'signin' ? 'signin' : 'joined';
  const page = pageParam(sp.page, 10_000);
  const { users, total } = await listUsers({ q, page, sort });
  const totalPages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
  const tab = (s: UserSort, label: string) => (
    <Link
      href={buildHref('/admin/users', { q, sort: s === 'joined' ? undefined : s })}
      aria-current={sort === s ? 'page' : undefined}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${sort === s ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-slate-500 uppercase">Admin</p>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Users <span className="ml-1 rounded-lg bg-indigo-50 px-2 py-0.5 align-middle text-base font-bold text-indigo-700">{formatNumber(total)}</span>
          </h1>
        </div>
        <form action="/admin/users" className="flex gap-2">
          {sort !== 'joined' && <input type="hidden" name="sort" value={sort} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search email or name"
            className="h-10 w-64 max-w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
          />
          <button className="h-10 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700">Search</button>
        </form>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        Sort by {tab('joined', 'Newest members')} {tab('signin', 'Last signed in')}
      </div>
      <UsersTable users={users} empty={q ? `No users match “${q}”.` : 'No one has signed up yet.'} />
      <Pagination page={page} totalPages={totalPages} href={(p) => buildHref('/admin/users', { q, sort: sort === 'joined' ? undefined : sort, page: p })} />
      <p className="text-xs text-slate-500">
        Times are UK time. “Last signed in” is recorded on every sign-in since this page was added; for earlier sign-ins it shows the latest session we still had, or “–”.
      </p>
    </div>
  );
}
