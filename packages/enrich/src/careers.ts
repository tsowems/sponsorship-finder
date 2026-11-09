import type { Link } from './html';

export type AtsProvider =
  | 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'recruitee' // job lists fetched
  | 'teamtailor' | 'pinpoint' | 'smartrecruiters' | 'workday' | 'bamboohr' | 'personio' | 'jobvite' | 'icims'; // link only

export interface AtsMatch {
  provider: AtsProvider;
  slug: string;
  url: string;
}

/** Providers whose public job-board APIs we read. The rest we only link to. */
export const FETCHABLE_ATS: ReadonlySet<AtsProvider> = new Set(['greenhouse', 'lever', 'ashby', 'workable', 'recruitee', 'workday']);

const ATS_PATTERNS: { provider: AtsProvider; re: RegExp; url: (slug: string, m: RegExpMatchArray) => string; slug?: (m: RegExpMatchArray) => string }[] = [
  { provider: 'greenhouse', re: /(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board(?:\/js)?\?for=)?([a-z0-9_-]+)/i, url: (s) => `https://job-boards.greenhouse.io/${s}` },
  { provider: 'lever', re: /jobs(?:\.eu)?\.lever\.co\/([a-z0-9_.-]+)/i, url: (s) => `https://jobs.lever.co/${s}` },
  { provider: 'ashby', re: /jobs\.ashbyhq\.com\/([a-z0-9_.%-]+)/i, url: (s) => `https://jobs.ashbyhq.com/${s}` },
  { provider: 'workable', re: /apply\.workable\.com\/([a-z0-9_-]+)/i, url: (s) => `https://apply.workable.com/${s}/` },
  { provider: 'recruitee', re: /\/\/([a-z0-9-]+)\.recruitee\.com/i, url: (s) => `https://${s}.recruitee.com/` },
  { provider: 'teamtailor', re: /\/\/([a-z0-9-]+)\.teamtailor\.com/i, url: (s) => `https://${s}.teamtailor.com/jobs` },
  { provider: 'pinpoint', re: /\/\/([a-z0-9-]+)\.pinpointhq\.com/i, url: (s) => `https://${s}.pinpointhq.com/` },
  { provider: 'smartrecruiters', re: /(?:careers|jobs)\.smartrecruiters\.com\/([A-Za-z0-9]+)/, url: (s) => `https://careers.smartrecruiters.com/${s}` },
  // Workday: slug = "tenant.wdN/site" (all three are needed to call its job feed)
  { provider: 'workday', re: /\/\/([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?(?!wday\/|job\/)([A-Za-z0-9_-]+)/, url: (_s, m) => `https://${m[1]}.${m[2]}.myworkdayjobs.com/${m[3]}`, slug: (m) => `${m[1]}.${m[2]}/${m[3]}` },
  { provider: 'bamboohr', re: /\/\/([a-z0-9-]+)\.bamboohr\.com\/(?:careers|jobs)/i, url: (s) => `https://${s}.bamboohr.com/careers` },
  { provider: 'personio', re: /\/\/([a-z0-9-]+)\.jobs\.personio\.(?:de|com)/i, url: (s) => `https://${s}.jobs.personio.com/` },
  { provider: 'jobvite', re: /jobs\.jobvite\.com\/([a-z0-9_-]+)/i, url: (s) => `https://jobs.jobvite.com/${s}` },
  { provider: 'icims', re: /\/\/(careers-[a-z0-9-]+)\.icims\.com/i, url: (s) => `https://${s}.icims.com/jobs` },
];

const IGNORED_SLUGS = new Set(['embed', 'v1', 'api', 'jobs', 'www', 'app', 'careers', 'static', 'assets']);

/** Find a hiring platform referenced anywhere in some HTML or URLs. Fetchable providers win. */
export function detectAts(...sources: string[]): AtsMatch | null {
  const matches: AtsMatch[] = [];
  for (const src of sources) {
    for (const p of ATS_PATTERNS) {
      const m = src.match(p.re);
      if (m && !IGNORED_SLUGS.has(m[1].toLowerCase())) matches.push({ provider: p.provider, slug: p.slug ? p.slug(m) : decodeURIComponent(m[1]), url: p.url(m[1], m) });
    }
  }
  return matches.find((m) => FETCHABLE_ATS.has(m.provider)) ?? matches[0] ?? null;
}

const CAREERS_TEXT = /\b(careers?|jobs?|vacanc(?:y|ies)|join (?:us|our team|the team)|work (?:with|for) us|working (?:here|with us|at)|recruitment|opportunities|we.re hiring|current openings)\b/i;
const CAREERS_HREF = /\/(careers?|jobs?|vacanc(?:y|ies)|join-?us|work-?with-?us|working-?(?:for|with|at)-?us|recruitments?|opportunities)(?:[/?#.]|$)/i;
const NOT_CAREERS = /job-?seekers?-?advice|blog|news|press|linkedin\.com|indeed\.|glassdoor|facebook|twitter|x\.com|instagram|youtube/i;

/** Links that look like a careers page, best first. Links into a known hiring platform rank highest. */
export function findCareersLinks(links: Link[], origin: string): string[] {
  const scored: { href: string; score: number }[] = [];
  for (const l of links) {
    if (NOT_CAREERS.test(l.href)) continue;
    let score = 0;
    if (detectAts(l.href)) score += 10;
    if (CAREERS_HREF.test(new URL(l.href).pathname)) score += 4;
    if (CAREERS_TEXT.test(l.text)) score += 3;
    if (score === 0) continue;
    if (!l.href.startsWith(origin) && score < 10) score -= 2; // off-site non-ATS links are less likely
    scored.push({ href: l.href.split('#')[0], score });
  }
  return [...new Map(scored.sort((a, b) => b.score - a.score).map((s) => [s.href, s])).keys()].slice(0, 4);
}

/** Paths to try when the homepage has no obvious careers link. */
export const COMMON_CAREERS_PATHS = ['/careers', '/jobs', '/vacancies', '/join-us', '/work-with-us', '/careers/'];

/** A page probably lists jobs or explains how to apply. */
export function looksLikeCareersPage(text: string): boolean {
  return /\b(vacanc(?:y|ies)|open (?:roles|positions)|current (?:roles|openings|opportunities)|apply now|job openings|join (?:our|the) team|careers?)\b/i.test(text);
}
