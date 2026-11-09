import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminNav } from '@/components/admin/AdminNav';
import { requireAdmin } from '@/lib/admin';

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };

/** Admin shell. The check here hides even the navigation from non-admins; each page checks again before loading data. */
export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <AdminNav />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
