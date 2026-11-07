/** Collapse whitespace (incl. non-breaking spaces) and trim. */
export function cleanText(value: string | null | undefined): string {
  return (value ?? '').replace(/[\s ]+/g, ' ').trim();
}

/**
 * Normalise an organisation name for matching and search.
 * Mirrors how Companies House treats names as "the same": case, punctuation,
 * "&" vs "and", "Ltd" vs "Limited".
 */
export function normalizeName(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\bltd\b/g, 'limited')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeTown(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sponsorKey(name: string, town: string): string {
  return `${normalizeName(name)}|${normalizeTown(town)}`;
}

/** "Worker (A rating)" -> "A", "Worker (A (Premium))" -> "A (Premium)" */
export function parseRating(raw: string): string {
  const v = cleanText(raw);
  const m = v.match(/^Worker \((.*)\)$/i);
  const inner = m ? m[1] : v;
  const simple = inner.match(/^([AB]) rating$/i);
  if (simple) return simple[1].toUpperCase();
  const tier = inner.match(/^([AB]) \((.+)\)$/i);
  if (tier) return `${tier[1].toUpperCase()} (${tier[2]})`;
  return inner;
}

/** True when the rating means the sponsor has been downgraded (B rating). */
export function isDowngradedRating(rating: string): boolean {
  return rating.startsWith('B');
}

export function slugify(value: string, maxLength = 80): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}
