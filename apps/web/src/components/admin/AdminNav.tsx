'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Add new admin sections here. */
const ITEMS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <p className="mb-2 px-3 text-[0.65rem] font-bold tracking-[0.18em] text-slate-500 uppercase">Admin</p>
      <nav className="flex gap-1 overflow-x-auto lg:flex-col">
        {ITEMS.map((i) => {
          const active = i.href === '/admin' ? path === '/admin' : path.startsWith(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active ? 'page' : undefined}
              className={`rounded-xl px-3 py-2.5 text-sm font-semibold whitespace-nowrap ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              {i.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
