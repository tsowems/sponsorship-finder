import type { AdminUserRow } from '@/lib/admin-data';

const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' });
const dayTime = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const PROVIDER: Record<string, string> = { google: 'Google', credential: 'Password' };

export function UsersTable({ users, empty }: { users: AdminUserRow[]; empty: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[52rem] text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-4 py-3 font-semibold">User</th>
            <th className="px-4 py-3 font-semibold">Joined</th>
            <th className="px-4 py-3 font-semibold">Last signed in</th>
            <th className="px-4 py-3 font-semibold">Signs in with</th>
            <th className="px-4 py-3 text-right font-semibold">Watching</th>
            <th className="px-4 py-3 text-right font-semibold">Searches</th>
            <th className="px-4 py-3 font-semibold">Alerts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-3">
                <span className="block font-medium break-all text-slate-900">{u.email}</span>
                {u.name && u.name !== u.email && <span className="block text-xs text-slate-500">{u.name}</span>}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-slate-600">{day.format(u.createdAt)}</td>
              <td className="px-4 py-3 whitespace-nowrap text-slate-600">{u.lastSignInAt ? dayTime.format(u.lastSignInAt) : '–'}</td>
              <td className="px-4 py-3 text-slate-600">
                {[...u.providers.filter((p) => p !== 'magic-link').map((p) => PROVIDER[p] ?? p), ...(u.providers.some((p) => p !== 'magic-link') ? [] : ['Email link'])].join(', ')}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{u.watches}</td>
              <td className="px-4 py-3 text-right tabular-nums">{u.searches}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.alertsEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {u.alertsEnabled ? 'On' : 'Off'}
                </span>
              </td>
            </tr>
          ))}
          {!users.length && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-500">{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
