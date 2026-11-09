import type { Metadata } from 'next';
import Link from 'next/link';
import { REGISTER_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Visa sponsorship FAQ: sponsor licences, ratings and the register',
  description:
    'Plain answers about UK Skilled Worker visa sponsors: what a sponsor licence is, what A and B ratings mean, why companies leave the register, and how to use Sponsorship Hunter.',
  alternates: { canonical: '/faq' },
};

const GOV_SKILLED_WORKER = 'https://www.gov.uk/skilled-worker-visa';

interface QA {
  q: string;
  /** Plain-text answer (also used for search engines' FAQ data). */
  a: string;
  /** Optional extra content shown on the page. */
  more?: React.ReactNode;
}

const SECTIONS: { title: string; items: QA[] }[] = [
  {
    title: 'Sponsor licences',
    items: [
      {
        q: 'What is a sponsor licence?',
        a: 'UK employers need a sponsor licence from the Home Office before they can hire someone on a Skilled Worker visa. Licensed employers are listed on the Home Office’s public register of licensed sponsors, which is where our data comes from.',
      },
      {
        q: 'If a company is on the register, will it sponsor me?',
        a: 'Not necessarily. A licence means the employer is allowed to sponsor workers, not that it will sponsor any particular person or role. The job itself must also be eligible, for example the right type of occupation and pay. Check the job advert or ask the employer whether a role offers sponsorship.',
      },
      {
        q: 'What does an A rating mean?',
        a: 'An A rating is the normal rating for a licensed sponsor. It can assign certificates of sponsorship to workers it wants to hire.',
      },
      {
        q: 'What does a B rating mean?',
        a: 'A B rating means the Home Office has downgraded the sponsor, usually because it isn’t fully meeting its duties, and put it on an action plan. While B-rated, a sponsor generally can’t assign certificates of sponsorship to new workers until it is upgraded back to an A rating.',
      },
      {
        q: 'What is a certificate of sponsorship (CoS)?',
        a: 'A certificate of sponsorship is an electronic record with a reference number that a licensed employer assigns to you for a specific job. You need it to apply for a Skilled Worker visa. Only licensed sponsors can assign one.',
      },
      {
        q: 'Why was a company removed from the register?',
        a: 'The register doesn’t say why. Common reasons include the Home Office revoking the licence, the employer giving it up, the business closing, or the organisation changing its name or merging, which can look like one company being removed and another added. We show the date we first saw it missing.',
      },
      {
        q: 'Where can I check the visa rules themselves?',
        a: 'The rules for the Skilled Worker visa, including eligible jobs, salary requirements and English language requirements, are set by the Home Office and change from time to time. Always check the current rules on GOV.UK.',
        more: (
          <p>
            <a href={GOV_SKILLED_WORKER} rel="noopener" target="_blank" className="text-indigo-700 hover:underline">Skilled Worker visa on GOV.UK ↗</a>
          </p>
        ),
      },
    ],
  },
  {
    title: 'Our data',
    items: [
      {
        q: 'Where does Sponsorship Hunter’s data come from?',
        a: 'From the Home Office’s Register of licensed sponsors: workers, published on GOV.UK under the Open Government Licence. We show organisations licensed for the Skilled Worker route.',
        more: (
          <p>
            <a href={REGISTER_URL} rel="noopener" target="_blank" className="text-indigo-700 hover:underline">The register on GOV.UK ↗</a>
          </p>
        ),
      },
      {
        q: 'How up to date is it?',
        a: 'We check the register several times every weekday and once a day at weekends, and record every change we find: new sponsors, removals, rating changes and moves. Each company page shows its licence history since we started tracking.',
      },
      {
        q: 'Is Sponsorship Hunter part of the Home Office?',
        a: 'No. Sponsorship Hunter is independent and not affiliated with the Home Office or UK Visas and Immigration. We don’t process visa applications or give immigration advice.',
      },
      {
        q: 'Why is the town different from where the job is?',
        a: 'The register lists the town of each sponsor’s registered address. Many employers have offices, branches or sites elsewhere, so the job may be in a different place.',
      },
      {
        q: 'How do you find a company’s website and jobs?',
        a: 'We only show a website we can confirm belongs to the organisation: for example its Companies House number appears on the site, it’s listed in official sources such as GOV.UK’s list of councils or the NHS directory, or the site is on an official public-sector address. Jobs come from the employer’s own careers page or hiring system.',
      },
    ],
  },
  {
    title: 'Using the site',
    items: [
      {
        q: 'Do I need an account?',
        a: 'Searching the register and seeing licence history is free without an account. A free account lets you see company websites, careers pages and open roles, the full industry lists, and set up alerts.',
      },
      {
        q: 'How do alerts work?',
        a: 'Sign in, open a company page and choose “Watch this company”. We email you if it’s removed from the register or its rating changes. You can also save a search to hear about new sponsors that match it. Every email has an unsubscribe link.',
      },
      {
        q: 'Can I apply for jobs through Sponsorship Hunter?',
        a: 'No. We link to each employer’s own careers page, hiring system or job board search, and you apply with them directly.',
      },
    ],
  },
];

export default function FaqPage() {
  const all = SECTIONS.flatMap((s) => s.items);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: all.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
  };

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Frequently asked questions</h1>
        <p className="text-slate-600">
          Plain answers about UK visa sponsors and this site. For anything about your own visa, check GOV.UK or ask a qualified immigration adviser.
        </p>
      </header>
      {SECTIONS.map((s) => (
        <section key={s.title} className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">{s.title}</h2>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {s.items.map((i) => (
              <details key={i.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-medium text-slate-900">
                  {i.q}
                  <span aria-hidden className="mt-0.5 text-indigo-600 transition group-open:rotate-45">+</span>
                </summary>
                <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-600">
                  <p>{i.a}</p>
                  {i.more}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
      <p className="text-sm text-slate-600">
        Still stuck? See <Link href="/about" className="text-indigo-700 hover:underline">about the data</Link>, or{' '}
        <Link href="/sponsors" className="text-indigo-700 hover:underline">search the register</Link>.
      </p>
    </article>
  );
}
