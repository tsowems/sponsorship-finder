import type { Metadata } from 'next';
import Link from 'next/link';
import { Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import { CookieBanner, CookieSettingsButton } from '@/components/CookieBanner';
import { SiteHeader } from '@/components/SiteHeader';
import { IS_INDEXABLE, REGISTER_URL, SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';
import './globals.css';

const brandSans = Plus_Jakarta_Sans({ variable: '--font-brand-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} – ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description:
    'Search every UK employer licensed to sponsor Skilled Worker visas. Updated daily from the Home Office register, with new sponsors, removals and downgrades tracked.',
  openGraph: { siteName: SITE_NAME, type: 'website', locale: 'en_GB' },
  ...(IS_INDEXABLE ? {} : { robots: { index: false, follow: false } }),
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en-GB" className={`${brandSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader siteName={SITE_NAME} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-6 sm:py-10">{children}</main>
        <footer className="border-t border-slate-200 bg-white sm:mt-8">
          <div className="mx-auto max-w-6xl space-y-2 px-4 py-5 text-xs leading-relaxed text-slate-500 sm:py-6">
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
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              <Link href="/about" className="underline hover:text-slate-700">About the data</Link>
              <Link href="/privacy" className="underline hover:text-slate-700">Privacy and cookies</Link>
              <CookieSettingsButton />
            </p>
          </div>
        </footer>
        <CookieBanner />
      </body>
    </html>
  );
}
