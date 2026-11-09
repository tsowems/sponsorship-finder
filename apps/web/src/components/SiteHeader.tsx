'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { UserMenu } from './UserMenu';

interface NavItem {
  href: string;
  label: string;
  short?: string;
}

const FIND: NavItem & { menu: { href: string; label: string; hint: string }[]; also: string[] } = {
  href: '/browse',
  label: 'Find sponsors',
  short: 'Sponsors',
  menu: [
    { href: '/browse', label: 'By city', hint: 'Cities and towns, and A–Z' },
    { href: '/industries', label: 'By industry', hint: 'Care, NHS, IT, education and more' },
    { href: '/councils', label: 'Councils', hint: 'England, Scotland and Wales' },
  ],
  also: ['/industries', '/councils'],
};

const NAV: (NavItem | typeof FIND)[] = [
  { href: '/sponsors', label: 'Search' },
  FIND,
  { href: '/changes', label: 'Latest changes', short: 'Changes' },
  { href: '/about', label: 'About the data', short: 'About' },
];

const isUnder = (path: string, href: string) => path === href || path.startsWith(`${href}/`);
const linkClass = (active: boolean) =>
  `rounded-xl px-2 py-2 transition-colors sm:px-3 ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`;

function Label({ n }: { n: NavItem }) {
  return n.short ? (
    <>
      <span className="sm:hidden">{n.short}</span>
      <span className="hidden sm:inline">{n.label}</span>
    </>
  ) : (
    n.label
  );
}

/** "Find sponsors ▾": opens on click/tap; closes on choosing an item, clicking elsewhere or Escape. */
function FindMenu({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const active = [FIND.href, ...FIND.also].some((h) => isUnder(path, h));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1 ${linkClass(active || open)}`}
      >
        <Label n={FIND} />
        <svg viewBox="0 0 20 20" className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06Z" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute left-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10">
          {FIND.menu.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              role="menuitem"
              prefetch={false}
              onClick={() => setOpen(false)}
              aria-current={isUnder(path, m.href) ? 'page' : undefined}
              className={`block rounded-xl px-3 py-2.5 hover:bg-indigo-50 ${isUnder(path, m.href) ? 'bg-indigo-50' : ''}`}
            >
              <span className={`block ${isUnder(path, m.href) ? 'text-indigo-700' : 'text-slate-900'}`}>{m.label}</span>
              <span className="block text-xs font-normal text-slate-500">{m.hint}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function SiteHeader({ siteName }: { siteName: string }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${siteName} home`}>
          <BrandMark />
          <span className="text-lg font-bold tracking-tight text-slate-900">{siteName}</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-0.5 text-sm font-semibold sm:gap-1">
          {NAV.map((n) => {
            if (n === FIND) return <FindMenu key={n.href} path={path} />;
            const active = isUnder(path, n.href);
            return (
              <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined} className={linkClass(active)}>
                <Label n={n} />
              </Link>
            );
          })}
          <span className="sm:ml-1">
            <UserMenu />
          </span>
        </nav>
      </div>
    </header>
  );
}

/** Rounded violet tile with a magnifier-over-badge glyph. */
export function BrandMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-sm shadow-indigo-600/30 ${className}`}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="10.5" cy="10.5" r="6" />
        <path d="m15 15 5 5" />
        <path d="m8 10.6 1.8 1.8 3.2-3.4" />
      </svg>
    </span>
  );
}
