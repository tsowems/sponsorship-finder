import type { Metadata } from 'next';
import Link from 'next/link';
import { Geist, Geist_Mono } from 'next/font/google';
import { UserMenu } from '@/components/UserMenu';
import { REGISTER_URL, SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} – ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description:
    'Search every UK employer licensed to sponsor Skilled Worker visas. Updated daily from the Home Office register, with new sponsors, removals and downgrades tracked.',
  openGraph: { siteName: SITE_NAME, type: 'website', locale: 'en_GB' },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en-GB" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
              {SITE_NAME}
            </Link>
            <nav className="flex items-center gap-5 text-sm font-medium text-slate-600">
              <Link href="/sponsors" className="hover:text-slate-900">Search</Link>
              <Link href="/changes" className="hover:text-slate-900">Latest changes</Link>
              <Link href="/about" className="hover:text-slate-900">About the data</Link>
              <UserMenu />
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl space-y-2 px-4 py-6 text-xs leading-relaxed text-slate-500">
            <p>
              Sponsor data from the Home Office{' '}
              <a href={REGISTER_URL} className="underline hover:text-slate-700" rel="noopener">
                Register of licensed sponsors: workers
              </a>
              , used under the{' '}
              <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" className="underline hover:text-slate-700" rel="noopener">
                Open Government Licence v3.0
              </a>
              . {SITE_NAME} is independent and not affiliated with the Home Office or UKVI.
            </p>
            <p>
              Being on the register means an employer can sponsor Skilled Worker visas. It does not mean any particular job is
              eligible or that the employer will sponsor you.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
