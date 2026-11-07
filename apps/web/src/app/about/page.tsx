import type { Metadata } from 'next';
import { REGISTER_URL, SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About the data',
  description: `Where ${SITE_NAME} gets its sponsor data, how often it updates, and what the register can and can't tell you.`,
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <article className="max-w-2xl space-y-5 leading-relaxed text-slate-700 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">About the data</h1>
      <p>
        {SITE_NAME} is built on the Home Office{' '}
        <a href={REGISTER_URL} className="text-indigo-700 underline" rel="noopener">Register of licensed sponsors: workers</a>. It lists every
        organisation licensed to sponsor workers. We show the <strong>Skilled Worker</strong> route only.
      </p>

      <h2>How often it updates</h2>
      <p>
        The Home Office usually publishes a new register every working day. We check for a new file every hour, compare it with the
        previous one and record what changed.
      </p>

      <h2>What the changes mean</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li><strong>New sponsor</strong>: the organisation appeared on the register for the first time since we started tracking.</li>
        <li>
          <strong>Removed from register</strong>: the organisation is no longer listed for the Skilled Worker route. The register doesn&apos;t
          say why: the licence may have been revoked, surrendered or allowed to expire, or the organisation may have been renamed.
        </li>
        <li>
          <strong>Downgraded to B</strong>: the Home Office has lowered the sponsor&apos;s rating, usually because of compliance concerns, and
          put it on an action plan.
        </li>
        <li><strong>Back on register</strong>: an organisation we&apos;d recorded as removed is listed again.</li>
      </ul>

      <h2>What it can&apos;t tell you</h2>
      <p>
        A sponsor licence means an employer <em>can</em> sponsor Skilled Worker visas, not that it will sponsor a particular role. The job
        also needs an eligible occupation code and must meet the salary requirements. The town shown is from the register and may not be
        where the job is based.
      </p>

      <h2>Licence</h2>
      <p>
        Contains public sector information licensed under the{' '}
        <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" className="text-indigo-700 underline" rel="noopener">
          Open Government Licence v3.0
        </a>
        . {SITE_NAME} is independent and not affiliated with the Home Office or UK Visas and Immigration.
      </p>
    </article>
  );
}
