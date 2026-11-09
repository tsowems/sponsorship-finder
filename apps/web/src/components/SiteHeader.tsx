'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserMenu } from './UserMenu';

const NAV: { href: string; label: string; short?: string }[] = [
  { href: '/sponsors', label: 'Search' },
  { href: '/browse', label: 'Browse' },
  { href: '/changes', label: 'Latest changes', short: 'Changes' },
  { href: '/about', label: 'About the data', short: 'About' },
];

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
            const active = path === n.href || path.startsWith(`${n.href}/`);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-xl px-2 py-2 transition-colors sm:px-3 ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
              >
                {n.short ? (
                  <>
                    <span className="sm:hidden">{n.short}</span>
                    <span className="hidden sm:inline">{n.label}</span>
                  </>
                ) : (
                  n.label
                )}
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
