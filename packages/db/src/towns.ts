/**
 * The register's "town" is free text typed by each sponsor, so one place appears many ways:
 * "London", "London England", "Greater London", "Ilford London", "London EC3A 7AG", "Saint Helens"…
 * These helpers group spellings of the same place for browsing and the town filter. The raw town is never changed.
 */

/** Whole-name aliases (after cleaning). */
const ALIASES: Record<string, string> = {
  'greater london': 'london',
  'city of london': 'london',
  'central london': 'london',
  'london city': 'london',
  'greater manchester': 'manchester',
  newcastle: 'newcastle upon tyne',
  'newcastle on tyne': 'newcastle upon tyne',
  'burton upon trent': 'burton on trent',
  'stoke upon trent': 'stoke on trent',
  'kingston upon hull': 'hull',
};

/** Country words that are sometimes typed after the town ("Leeds England"). */
const COUNTRY = ['england', 'uk', 'u k', 'united kingdom', 'great britain', 'gb', 'scotland', 'wales', 'northern ireland', 'area'];

/** Counties and regions typed after the town ("Rochester Kent", "Salford Greater Manchester"). Longest first. */
const REGIONS = [
  'greater london', 'greater manchester', 'west midlands', 'east midlands', 'merseyside', 'tyne and wear', 'west yorkshire',
  'south yorkshire', 'north yorkshire', 'east yorkshire', 'east riding of yorkshire', 'county durham', 'co durham',
  'lancashire', 'middlesex', 'surrey', 'kent', 'essex', 'hertfordshire', 'herts', 'berkshire', 'cheshire', 'hampshire',
  'west sussex', 'east sussex', 'sussex', 'devon', 'cornwall', 'norfolk', 'suffolk', 'dorset', 'somerset',
  'oxfordshire', 'buckinghamshire', 'bucks', 'bedfordshire', 'beds', 'cambridgeshire', 'nottinghamshire', 'notts',
  'derbyshire', 'leicestershire', 'staffordshire', 'staffs', 'warwickshire', 'worcestershire', 'shropshire',
  'gloucestershire', 'wiltshire', 'lincolnshire', 'northamptonshire', 'cumbria', 'northumberland', 'herefordshire',
  'isle of wight', 'fife', 'lanarkshire', 'renfrewshire', 'aberdeenshire', 'county antrim', 'co antrim', 'county down',
  'co down', 'county armagh', 'county londonderry', 'county tyrone',
].sort((a, b) => b.length - a.length);

/** Big cities often typed after a district ("Ilford London", "Hall Green Birmingham"). */
const CITIES = ['london', 'manchester', 'birmingham', 'glasgow', 'leeds', 'liverpool', 'bristol', 'edinburgh', 'sheffield', 'nottingham', 'leicester', 'cardiff', 'belfast', 'newcastle upon tyne', 'coventry', 'bradford'];

const isPostcodePart = (w: string) => /^[a-z]{1,2}\d{1,2}[a-z]?$/.test(w) || /^\d[a-z]{2}$/.test(w);

/** Clean one normalised town: drop postcodes and trailing country/county words, "saint" → "st", known aliases. */
export function cleanTown(normalizedTown: string): string {
  const words = normalizedTown.split(' ').filter((w) => w && !isPostcodePart(w));
  let t = words.join(' ') || normalizedTown;
  t = t.replace(/^saint /, 'st ');
  for (let changed = true; changed; ) {
    changed = false;
    for (const suffix of [...COUNTRY, ...REGIONS]) {
      if (t.endsWith(` ${suffix}`) && t.length > suffix.length + 1) {
        t = t.slice(0, -(suffix.length + 1)).trim();
        changed = true;
        break;
      }
    }
  }
  return ALIASES[t] ?? t;
}

export interface TownGroupInput {
  normalized: string;
  /** Most common spelling for this normalised town. */
  name: string;
  count: number;
}

export interface MergedTown {
  /** Canonical normalised town, e.g. "london". */
  key: string;
  /** Spelling of the biggest variant, e.g. "London". */
  name: string;
  count: number;
  /** Every normalised town merged into this one (for queries). */
  variants: string[];
}

/**
 * Group spellings of the same place. "District City" goes to the district when that's a town in its own right
 * ("Ilford London" → Ilford), otherwise to the city ("Hall Green Birmingham" → Birmingham).
 */
export function mergeTowns(groups: TownGroupInput[], minOwnTown = 3): MergedTown[] {
  const cleaned = groups.map((g) => ({ ...g, key: cleanTown(g.normalized) }));
  const sizes = new Map<string, number>();
  for (const g of cleaned) sizes.set(g.key, (sizes.get(g.key) ?? 0) + g.count);
  for (const g of cleaned) {
    const city = CITIES.find((c) => g.key.endsWith(` ${c}`));
    if (!city) continue;
    const district = g.key.slice(0, -(city.length + 1));
    g.key = (sizes.get(district) ?? 0) >= minOwnTown ? district : city;
  }
  const merged = new Map<string, { key: string; count: number; variants: string[]; best: { name: string; count: number } }>();
  for (const g of cleaned) {
    const m = merged.get(g.key) ?? { key: g.key, count: 0, variants: [], best: { name: g.name, count: -1 } };
    m.count += g.count;
    m.variants.push(g.normalized);
    // Prefer the spelling of the variant that already *is* the canonical name, else the biggest one.
    const score = g.normalized === g.key ? g.count + 1e9 : g.count;
    if (score > m.best.count) m.best = { name: g.name, count: score };
    merged.set(g.key, m);
  }
  return [...merged.values()].map((m) => ({ key: m.key, name: m.best.name, count: m.count, variants: m.variants })).sort((a, b) => a.key.localeCompare(b.key));
}
