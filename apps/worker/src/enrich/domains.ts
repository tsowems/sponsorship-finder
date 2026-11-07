/** Words that describe the *type* of company rather than its name; dropped when guessing domains. */
const SUFFIXES = new Set([
  'limited', 'ltd', 'plc', 'llp', 'lp', 'uk', 'gb', 'group', 'holdings', 'holding', 'company', 'co', 'the', 'and',
  'services', 'service', 'international', 'enterprises', 'trading', 'cic', 'cio', 'inc', 'incorporated', 'corporation', 'corp',
]);

/** Names too generic to guess a domain for safely ("care services limited" → caresolutions.co.uk is someone else). */
const GENERIC = new Set([
  'care', 'home', 'homes', 'health', 'healthcare', 'consulting', 'consultancy', 'solutions', 'restaurant', 'foods', 'food',
  'construction', 'property', 'properties', 'tech', 'technology', 'technologies', 'digital', 'global', 'london', 'british',
  'medical', 'education', 'recruitment', 'staffing', 'trust', 'nhs', 'foundation', 'university', 'school', 'college',
]);

/** "Acme Robotics (UK) Limited t/a Acme" → ["acme", "robotics"] */
export function coreTokens(normalizedName: string): string[] {
  const name = normalizedName.split(/\b(?:t a|trading as)\b/)[0]; // "x t/a y" normalises to "x t a y"
  return name.split(' ').filter((t) => t && !SUFFIXES.has(t));
}

/**
 * Plausible domains for a company, most likely first. Every guess is verified against the
 * website's content before it's used, so false guesses only cost an HTTP request.
 */
export function candidateDomains(normalizedName: string): string[] {
  const tokens = coreTokens(normalizedName);
  if (tokens.length === 0) return [];
  const joined = tokens.join('');
  if (joined.length < 4) return [];
  if (tokens.length === 1 && GENERIC.has(tokens[0])) return [];
  if (tokens.every((t) => GENERIC.has(t))) return [];

  const bases = new Set<string>([joined]);
  if (tokens.length > 1) bases.add(tokens.join('-'));
  if (tokens.length > 2) bases.add(tokens.slice(0, 2).join(''));
  const out: string[] = [];
  for (const base of bases) for (const tld of ['co.uk', 'com', 'uk']) out.push(`${base}.${tld}`);
  out.push(`${joined}uk.com`, `${joined}group.com`);
  return [...new Set(out)].filter((d) => d.length <= 63 + 7).slice(0, 10);
}

/** The bit of a hostname that identifies the company: "www.acme-robotics.co.uk" → "acmerobotics" */
export function domainLabel(hostname: string): string {
  const parts = hostname.toLowerCase().replace(/^www\./, '').split('.');
  const sld = ['co', 'org', 'ac', 'gov', 'ltd', 'plc', 'me', 'net', 'nhs'].includes(parts.at(-2) ?? '') ? parts.at(-3) : parts.at(-2);
  return (sld ?? '').replace(/-/g, '');
}
