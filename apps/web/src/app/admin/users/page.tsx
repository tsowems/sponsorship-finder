import { Suspense } from 'react';
import { buildHref, Pagination } from '@/components/Pagination';
import { requireAdmin } from '@/lib/admin';
import { listUsers, USERS_PAGE_SIZE } from '@/lib/admin-data';
import { firstParam, formatNumber, pageParam } from '@/lib/format';

type Search = Promise<Record<string, string | string[] | undefined>>;
const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' });
const PROVIDER: Record<string, string> = { google: 'Google', credential: 'Password' };

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
  const page = pageParam(sp.page);
  const { users, total } = await listUsers({ q, page });
  const totalPages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));

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
          <input
            name="q"
            defaultValue={q}
            placeholder="Search email or name"
            className="h-10 w-64 max-w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
          />
          <button className="h-10 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700">Search</button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">User</th>
              <th className="px-4 py-3 font-semibold">Joined</th>
              <th className="px-4 py-3 font-semibold">Signs in with</th>
              <th className="px-4 py-3 text-right font-semibold">Watching</th>
              <th className="px-4 py-3 text-right font-semibold">Searches</th>
              <th className="px-4 py-3 font-semibold">Alerts</th>
              <th className="px-4 py-3 font-semibold">Last active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <span className="block font-medium text-slate-900">{u.email}</span>
                  {u.name && u.name !== u.email && <span className="block text-xs text-slate-500">{u.name}</span>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{fmt.format(u.createdAt)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {[...u.providers.map((p) => PROVIDER[p] ?? p), ...(u.providers.length ? [] : ['Email link'])].join(', ')}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{u.watches}</td>
                <td className="px-4 py-3 text-right tabular-nums">{u.searches}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.alertsEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {u.alertsEnabled ? 'On' : 'Off'}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{u.lastActive ? fmt.format(u.lastActive) : '–'}</td>
              </tr>
            ))}
            {!users.length && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  {q ? `No users match “${q}”.` : 'No one has signed up yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} href={(p) => buildHref('/admin/users', { q, page: p })} />
    </div>
  );
}
