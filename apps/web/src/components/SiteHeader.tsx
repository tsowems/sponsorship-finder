'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { UserMenu } from './UserMenu';

interface MenuItem {
  href: string;
  label: string;
  hint: string;
}

interface Menu {
  label: string;
  /** Shorter label on phones. */
  short: string;
  items: MenuItem[];
  /** Paths that count as "inside" this menu, for highlighting. */
  paths: string[];
}

/** Top menu: two dropdowns. "About the data" and the FAQ live in the footer. */
const MENUS: Menu[] = [
  {
    label: 'Find sponsors',
    short: 'Sponsors',
    items: [
      { href: '/sponsors', label: 'Search', hint: 'Find a company by name or town' },
      { href: '/browse', label: 'By city', hint: 'Cities and towns, and A–Z' },
      { href: '/industries', label: 'By industry', hint: 'Care, NHS, IT, education and more' },
      { href: '/councils', label: 'Councils', hint: 'England, Scotland and Wales' },
    ],
    paths: ['/sponsors', '/browse', '/industries', '/councils'],
  },
  {
    label: 'Licences',
    short: 'Licences',
    items: [
      { href: '/changes', label: 'Latest changes', hint: 'Every change to the register, newest first' },
      { href: '/changes?type=added', label: 'New sponsors', hint: 'Recently licensed employers' },
      { href: '/changes?type=removed', label: 'Removed sponsors', hint: 'Taken off the register' },
      { href: '/changes?type=downgraded', label: 'Downgraded to B', hint: 'Rating cut to B' },
      { href: '/faq', label: 'Licences explained', hint: 'Ratings, removals and certificates' },
    ],
    paths: ['/changes', '/faq'],
  },
];

const isUnder = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/** A dropdown: opens on click/tap; closes on choosing an item, clicking elsewhere or Escape. */
function NavMenu({ menu, path, alignEnd = false }: { menu: Menu; path: string; alignEnd?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const active = menu.paths.some((h) => isUnder(path, h));

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
        className={`inline-flex items-center gap-1 rounded-xl px-2 py-2 transition-colors sm:px-3 ${
          active || open ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <span className="sm:hidden">{menu.short}</span>
        <span className="hidden sm:inline">{menu.label}</span>
        <svg viewBox="0 0 20 20" className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06Z" />
        </svg>
      </button>
      {open && (
        <div role="menu" className={`absolute left-0 z-40 mt-2 w-64 ${alignEnd ? 'sm:right-0 sm:left-auto' : ''} overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10`}>
          {menu.items.map((m) => {
            // Only plain paths are highlighted ("/changes?type=added" shares "/changes" with "Latest changes").
            const current = !m.href.includes('?') && path === m.href;
            return (
              <Link
                key={m.href}
                href={m.href}
                role="menuitem"
                prefetch={false}
                onClick={() => setOpen(false)}
                aria-current={current ? 'page' : undefined}
                className={`block rounded-xl px-3 py-2.5 hover:bg-indigo-50 ${current ? 'bg-indigo-50' : ''}`}
              >
                <span className={`block ${current ? 'text-indigo-700' : 'text-slate-900'}`}>{m.label}</span>
                <span className="block text-xs font-normal text-slate-500">{m.hint}</span>
              </Link>
            );
          })}
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
          {MENUS.map((m, i) => (
            // The last menu opens leftwards on wider screens so it stays on screen.
            <NavMenu key={m.label} menu={m} path={path} alignEnd={i === MENUS.length - 1} />
          ))}
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
