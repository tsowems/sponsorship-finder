import type { Metadata } from 'next';
import Link from 'next/link';
import { CONTACT_EMAIL, SITE_NAME, SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy and cookies',
  description: `What personal data ${SITE_NAME} collects, why, who processes it, how long it's kept, and your rights.`,
  alternates: { canonical: '/privacy' },
};

const LAST_UPDATED = '9 November 2026';

export default function PrivacyPage() {
  const host = new URL(SITE_URL).host;
  return (
    <article className="max-w-2xl space-y-5 leading-relaxed text-slate-700 [&_h2]:mt-10 [&_h2]:scroll-mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_table]:w-full [&_table]:text-sm [&_td]:border-t [&_td]:border-slate-200 [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_th]:pb-2 [&_th]:pr-3 [&_th]:text-left [&_th]:font-semibold [&_th]:text-slate-900">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Privacy and cookies</h1>
      <p className="text-sm text-slate-500">Last updated {LAST_UPDATED}</p>

      <p>
        {SITE_NAME} ({host}) helps people find UK employers licensed to sponsor Skilled Worker visas. You can search and browse
        without an account. If you create one, we hold a small amount of personal data so we can send you the alerts you ask for. This
        page explains what, why, and your rights under UK data protection law (UK GDPR and the Data Protection Act 2018).
      </p>

      <h2 id="who">Who we are</h2>
      <p>
        {SITE_NAME} is the data controller for personal data collected through this website. Contact us about anything on this page at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-700 underline">{CONTACT_EMAIL}</a>.
      </p>

      <h2 id="what">What we collect and why</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Data</th><th>Why</th><th>Legal basis</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Email address</td>
              <td>To sign you in (sign-in links) and send the alerts you set up</td>
              <td>Contract: providing the service you asked for</td>
            </tr>
            <tr>
              <td>Name and profile picture (only if you sign in with Google)</td>
              <td>Provided by Google with your account; we don&apos;t display them publicly</td>
              <td>Contract</td>
            </tr>
            <tr>
              <td>Companies you watch and searches you save</td>
              <td>To know which changes to email you about</td>
              <td>Contract</td>
            </tr>
            <tr>
              <td>Sign-in sessions, including IP address and browser type</td>
              <td>To keep you signed in and protect accounts from misuse</td>
              <td>Legitimate interests: security</td>
            </tr>
            <tr>
              <td>
                Page visits: the page address (without search terms), the website that sent you, country, device type, whether you were
                signed in, and a visitor code that changes every day
              </td>
              <td>To count visitors and see which pages are useful. The daily code is a one-way scramble of your IP address and browser, so we
                can count you once per day but can&apos;t identify you or follow you across days. No cookies are used. Kept for about 13 months.</td>
              <td>Legitimate interests: understanding and improving the site</td>
            </tr>
            <tr>
              <td>Record of alert emails sent to you</td>
              <td>To avoid sending duplicates and to investigate delivery problems</td>
              <td>Legitimate interests: running the service reliably</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        We don&apos;t sell your data, use it for advertising, or share it with employers. The sponsor information on this site comes from
        the Home Office&apos;s public register of licensed sponsors and is about organisations, not individuals.
      </p>

      <h2 id="processors">Who processes data for us</h2>
      <p>We use these providers to run the service. They only process data on our instructions:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>Vercel</strong>: website hosting</li>
        <li><strong>Neon</strong>: database hosting (stored in London, UK)</li>
        <li><strong>Resend</strong>: sending emails</li>
        <li><strong>GitHub</strong>: runs our scheduled jobs that check the register and send alerts</li>
        <li><strong>Google</strong>: only if you choose &ldquo;Continue with Google&rdquo; to sign in</li>
      </ul>
      <p>
        Some of these providers are based in, or use servers in, the United States. Where personal data leaves the UK, it&apos;s protected by
        the safeguards UK law requires, such as the UK Extension to the EU–US Data Privacy Framework or the UK International Data
        Transfer Addendum.
      </p>

      <h2 id="retention">How long we keep it</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Account data, watches and saved searches: until you delete your account or ask us to.</li>
        <li>Sign-in sessions: they expire after 7 days of inactivity.</li>
        <li>Sign-in links: expire after 15 minutes and can only be used once.</li>
        <li>Alert email records: deleted with your account.</li>
      </ul>

      <h2 id="rights">Your rights</h2>
      <p>
        You can ask us to access, correct, delete or export your personal data, or object to or restrict how we use it. Email{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-700 underline">{CONTACT_EMAIL}</a> from the address on your account and
        we&apos;ll respond within one month. You can stop all alert emails at any time from{' '}
        <Link href="/account" className="text-indigo-700 underline">My alerts</Link> or the unsubscribe link in any alert.
      </p>
      <p>
        If you&apos;re unhappy with how we handle your data, you can complain to the Information Commissioner&apos;s Office (ICO) at{' '}
        <a href="https://ico.org.uk/make-a-complaint/" className="text-indigo-700 underline" rel="noopener">ico.org.uk</a>.
      </p>

      <h2 id="cookies">Cookies</h2>
      <p>We only use cookies and similar storage that the site needs to work:</p>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Name</th><th>Purpose</th><th>Lasts</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>__Secure-better-auth.session_token</code></td>
              <td>Keeps you signed in. Only set after you sign in</td>
              <td>7 days, renewed while you use the site</td>
            </tr>
            <tr>
              <td><code>__Secure-better-auth.session_data</code></td>
              <td>Short-lived copy of your sign-in so pages load faster. Only set after you sign in</td>
              <td>5 minutes</td>
            </tr>
            <tr>
              <td><code>cookie-consent-v1</code> (browser storage, not a cookie)</td>
              <td>Remembers your cookie choice so we don&apos;t ask again</td>
              <td>Until you clear it</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        These are strictly necessary, so they don&apos;t need consent. We don&apos;t use advertising or tracking cookies. Our visitor counting
        (see above) uses no cookies or browser storage, and is switched off if your browser sends &ldquo;Do Not Track&rdquo; or Global
        Privacy Control. If we add cookie-based analytics in future, it will only run if you choose &ldquo;Accept all&rdquo;, and we&apos;ll list it here. You can change your choice at any time
        with &ldquo;Cookie settings&rdquo; at the bottom of every page.
      </p>

      <h2 id="changes">Changes to this policy</h2>
      <p>If we change how we use personal data, we&apos;ll update this page and the date at the top.</p>
    </article>
  );
}
