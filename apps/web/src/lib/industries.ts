import { cacheLife, cacheTag } from 'next/cache';
import { and, asc, count, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { careRegistrations, getDb, sponsors } from '@sponsors/db';
import { browsePage, getTowns, type Cursor, type TownCount } from './browse';

/**
 * Industry pages. A licensed sponsor belongs to an industry when either:
 *  - its Companies House industry (SIC) code is in the industry's sections (collected when we look a company up), or
 *  - its name clearly says so ("… Care Home", "… Solicitors", "… Restaurant").
 * Names are matched on whole words of the normalised name (lower case, no punctuation).
 * A company can appear in more than one industry.
 */
export interface Industry {
  slug: string;
  title: string;
  /** Short phrase used in sentences: "sponsors in {phrase}". */
  phrase: string;
  intro: string;
  /** SIC code prefixes (2–5 digits). */
  sic: string[];
  /** Whole words/phrases in the normalised name. */
  words: string[];
  /** Whole words/phrases that rule a name out ("domiciliary" opticians, a schools charity called "home support"). */
  exclude?: string[];
  /**
   * Home care: also include sponsors the care regulators list as home-care providers (CQC "Homecare agencies",
   * Care Inspectorate "Care at Home"), and drop name matches the regulators list only as something else (care homes).
   */
  careRegister?: 'home_care';
}

export const INDUSTRIES: Industry[] = [
  {
    slug: 'care-homes-and-social-care', title: 'Care homes and social care', phrase: 'care and social care',
    intro: 'Care homes, nursing homes, home care and supported living providers licensed to sponsor Skilled Worker visas, including care workers and senior care workers where the role is eligible.',
    sic: ['87', '88'],
    words: ['care home', 'care homes', 'nursing home', 'nursing homes', 'home care', 'homecare', 'domiciliary', 'care services', 'residential care', 'supported living', 'care agency', 'healthcare services', 'care group', 'care solutions'],
  },
  {
    slug: 'home-care-domiciliary', title: 'Home care (domiciliary)', phrase: 'home care',
    intro: 'Home care and domiciliary care agencies licensed to sponsor Skilled Worker visas. Carers visit clients in their own homes, so many of these roles ask for a full UK driving licence and access to a car.',
    sic: ['8810'],
    words: ['domiciliary', 'home care', 'homecare', 'care at home', 'live in care', 'livein care', 'home support', 'care in the home', 'home carers', 'visiting care'],
    exclude: ['specsavers', 'opticians', 'optician', 'eyecare', 'dental', 'school home support'],
    careRegister: 'home_care',
  },
  {
    slug: 'healthcare-and-nhs', title: 'Healthcare and NHS', phrase: 'healthcare and the NHS',
    intro: 'NHS trusts, hospitals, GP practices, clinics, dental practices and pharmacies licensed to sponsor Skilled Worker visas.',
    sic: ['86'],
    words: ['nhs', 'hospital', 'hospitals', 'clinic', 'clinics', 'medical', 'dental', 'dentist', 'dentistry', 'pharmacy', 'pharmacies', 'chemist', 'surgery', 'gp', 'physiotherapy', 'health board', 'integrated care board'],
  },
  {
    slug: 'it-and-software', title: 'IT and software', phrase: 'IT and software',
    intro: 'Software, IT services, data, cloud and cyber security companies licensed to sponsor Skilled Worker visas.',
    sic: ['62', '631', '5821', '5829'],
    words: ['software', 'technologies', 'technology', 'tech', 'it solutions', 'it services', 'it consulting', 'cyber', 'cloud', 'data', 'digital', 'computing', 'ai'],
  },
  {
    slug: 'education', title: 'Education', phrase: 'education',
    intro: 'Universities, colleges, schools, academies and training providers licensed to sponsor Skilled Worker visas.',
    sic: ['85'],
    words: ['university', 'college', 'school', 'schools', 'academy', 'academies', 'education', 'educational', 'tuition', 'tutors', 'tutoring', 'nursery', 'nurseries', 'learning trust', 'multi academy trust'],
  },
  {
    slug: 'restaurants-and-hospitality', title: 'Restaurants and hospitality', phrase: 'restaurants and hospitality',
    intro: 'Restaurants, cafés, takeaways, hotels and catering businesses licensed to sponsor Skilled Worker visas, often for chefs and managers.',
    sic: ['55', '56'],
    words: ['restaurant', 'restaurants', 'cafe', 'takeaway', 'catering', 'caterers', 'grill', 'pizza', 'pizzeria', 'kitchen', 'bistro', 'tandoori', 'curry', 'kebab', 'hotel', 'hotels', 'inn', 'bar and grill', 'brasserie', 'bakery', 'patisserie'],
  },
  {
    slug: 'construction-and-engineering', title: 'Construction and engineering', phrase: 'construction and engineering',
    intro: 'Builders, contractors, engineering firms and building trades licensed to sponsor Skilled Worker visas.',
    sic: ['41', '42', '43', '711'],
    words: ['construction', 'constructions', 'builders', 'building', 'building services', 'engineering', 'engineers', 'civil', 'scaffolding', 'roofing', 'electrical', 'plumbing', 'contractors', 'groundworks', 'interiors', 'joinery'],
  },
  {
    slug: 'finance-and-accounting', title: 'Finance and accounting', phrase: 'finance and accounting',
    intro: 'Banks, investment firms, insurers, accountants and financial services companies licensed to sponsor Skilled Worker visas.',
    sic: ['64', '65', '66', '692'],
    words: ['accountants', 'accountancy', 'accounting', 'finance', 'financial', 'bank', 'banking', 'capital', 'investment', 'investments', 'asset management', 'insurance', 'wealth', 'fintech', 'payments', 'tax'],
  },
  {
    slug: 'legal-services', title: 'Legal services', phrase: 'legal services',
    intro: 'Law firms, solicitors and barristers’ chambers licensed to sponsor Skilled Worker visas.',
    sic: ['691'],
    words: ['solicitors', 'solicitor', 'law', 'legal', 'lawyers', 'barristers', 'chambers', 'llp solicitors'],
  },
  {
    slug: 'recruitment-and-staffing', title: 'Recruitment and staffing', phrase: 'recruitment and staffing',
    intro: 'Recruitment agencies and staffing companies licensed to sponsor Skilled Worker visas.',
    sic: ['78'],
    words: ['recruitment', 'recruiting', 'staffing', 'personnel', 'employment agency', 'resourcing', 'talent'],
  },
  {
    slug: 'retail-and-wholesale', title: 'Retail and wholesale', phrase: 'retail and wholesale',
    intro: 'Shops, supermarkets, wholesalers and distributors licensed to sponsor Skilled Worker visas.',
    sic: ['45', '46', '47'],
    words: ['retail', 'retailers', 'wholesale', 'wholesalers', 'supermarket', 'supermarkets', 'store', 'stores', 'cash and carry', 'mini market', 'convenience store', 'off licence'],
  },
  {
    slug: 'transport-and-logistics', title: 'Transport and logistics', phrase: 'transport and logistics',
    intro: 'Logistics, haulage, freight, courier and transport companies licensed to sponsor Skilled Worker visas.',
    sic: ['49', '50', '51', '52', '53'],
    words: ['logistics', 'transport', 'haulage', 'freight', 'courier', 'couriers', 'delivery', 'shipping', 'removals', 'aviation', 'airlines', 'airways'],
  },
  {
    slug: 'charities-and-religious-organisations', title: 'Charities and religious organisations', phrase: 'charities and religious organisations',
    intro: 'Charities, churches, mosques, temples, gurdwaras and religious organisations licensed to sponsor workers.',
    sic: ['9491', '9499', '889'],
    words: ['charity', 'charitable trust', 'church', 'churches', 'mosque', 'masjid', 'temple', 'gurdwara', 'synagogue', 'ministries', 'ministry', 'islamic centre', 'parish', 'diocese'],
  },
];

export const findIndustry = (slug: string) => INDUSTRIES.find((i) => i.slug === slug) ?? null;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Licensed sponsors in an industry (name words or SIC code). */
export function industryWhere(ind: Industry): SQL {
  const words = `\\m(${ind.words.map(escapeRe).join('|')})\\M`;
  const sic = `^(${ind.sic.join('|')})`;
  const excluded = ind.exclude?.length ? sql`${sponsors.normalizedName} !~ ${`\\m(${ind.exclude.map(escapeRe).join('|')})\\M`}` : undefined;
  const byNameOrSic = sql`(${sponsors.normalizedName} ~ ${words} or exists (
      select 1 from sponsor_profiles p where p.sponsor_id = ${sponsors.id} and p.sic_codes is not null
        and exists (select 1 from unnest(p.sic_codes) c where c ~ ${sic})))`;
  if (ind.careRegister === 'home_care') {
    const registered = sql`exists (select 1 from ${careRegistrations} r where r.sponsor_id = ${sponsors.id})`;
    const homeCare = sql`exists (select 1 from ${careRegistrations} r where r.sponsor_id = ${sponsors.id} and r.home_care)`;
    return and(eq(sponsors.status, 'active'), sql`(${homeCare} or (${byNameOrSic} and not ${registered}))`, excluded)!;
  }
  return and(eq(sponsors.status, 'active'), byNameOrSic, excluded)!;
}

/** Sponsor counts per industry (cached for everyone; refreshed after imports). */
export async function getIndustryCounts(): Promise<Record<string, number>> {
  'use cache';
  cacheLife('days');
  cacheTag('sponsors');
  const db = getDb();
  const counts = await Promise.all(INDUSTRIES.map(async (i) => [i.slug, (await db.select({ n: count() }).from(sponsors).where(industryWhere(i)))[0].n] as const));
  return Object.fromEntries(counts);
}

/** First few sponsors A–Z: the public preview shown to everyone (and search engines). */
export async function industryPreview(ind: Industry, limit = 10) {
  'use cache';
  cacheLife('days');
  cacheTag('sponsors');
  return getDb()
    .select({ id: sponsors.id, slug: sponsors.slug, name: sponsors.name, town: sponsors.town, county: sponsors.county, rating: sponsors.rating, status: sponsors.status, firstSeenAt: sponsors.firstSeenAt, removedAt: sponsors.removedAt, inBaseline: sponsors.inBaseline })
    .from(sponsors)
    .where(industryWhere(ind))
    .orderBy(asc(sponsors.normalizedName), asc(sponsors.id))
    .limit(limit);
}

/** Full A–Z list with next/previous paging (signed-in users only; not cached). */
export function browseIndustry(ind: Industry, cursor: Cursor) {
  return browsePage(industryWhere(ind), cursor);
}

export interface IndustryTown {
  slug: string;
  name: string;
  count: number;
}

/**
 * Cities and towns for one industry, biggest first, with spellings of the same place merged (same as /browse/towns).
 * One small cached result per industry.
 */
export async function getIndustryTowns(slug: string): Promise<IndustryTown[]> {
  'use cache';
  cacheLife('days');
  cacheTag('sponsors');
  const ind = findIndustry(slug);
  if (!ind) return [];
  const [rows, towns] = await Promise.all([
    getDb().select({ town: sponsors.normalizedTown, n: count() }).from(sponsors).where(industryWhere(ind)).groupBy(sponsors.normalizedTown),
    getTowns(),
  ]);
  const byVariant = new Map<string, TownCount>();
  for (const t of towns) for (const v of t.variants) byVariant.set(v, t);
  const out = new Map<string, IndustryTown>();
  for (const r of rows) {
    const t = byVariant.get(r.town);
    if (!t) continue;
    const cur = out.get(t.slug) ?? { slug: t.slug, name: t.name, count: 0 };
    cur.count += r.n;
    out.set(t.slug, cur);
  }
  return [...out.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** One industry in one place, A–Z with next/previous paging. Not cached: small, indexed by town, and one per page. */
export function browseIndustryTown(ind: Industry, town: TownCount, cursor: Cursor) {
  return browsePage(and(industryWhere(ind), inArray(sponsors.normalizedTown, town.variants))!, cursor);
}

