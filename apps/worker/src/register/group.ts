import { isDowngradedRating, normalizeName, normalizeTown, parseRating } from '@sponsors/db/normalize';
import { SKILLED_WORKER_ROUTE, type RegisterRow } from './parse';

/** A sponsor as it appears in one register file (one or more rows merged). */
export interface RegisterSponsor {
  key: string;
  name: string;
  normalizedName: string;
  town: string;
  normalizedTown: string;
  county: string | null;
  rating: string;
  ratingRaw: string;
  entryCount: number;
}

const isShouty = (s: string) => s === s.toUpperCase() && /[A-Z]/.test(s);
const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Pick one value from a group of merged rows. Must not depend on row order, otherwise a
 * reshuffled (but identical) register would look like a change.
 */
function pickName(names: string[]): string {
  return [...names].sort((a, b) => Number(isShouty(a)) - Number(isShouty(b)) || byText(a, b))[0];
}
function pickCounty(counties: string[]): string | null {
  return counties.filter(Boolean).sort(byText)[0] ?? null;
}
function pickRating(rows: { rating: string; raw: string }[]): { rating: string; raw: string } {
  // A downgrade on any merged licence is surfaced.
  return [...rows].sort((a, b) => Number(isDowngradedRating(b.rating)) - Number(isDowngradedRating(a.rating)) || byText(a.raw, b.raw))[0];
}

/** Keep Skilled Worker rows and merge rows that are the same organisation (same normalised name + town). */
export function groupSkilledWorkerSponsors(rows: RegisterRow[]): Map<string, RegisterSponsor> {
  const groups = new Map<string, { normalizedName: string; normalizedTown: string; rows: RegisterRow[] }>();
  for (const row of rows) {
    if (row.route !== SKILLED_WORKER_ROUTE || !row.name) continue;
    const normalizedName = normalizeName(row.name);
    if (!normalizedName) continue;
    const normalizedTown = normalizeTown(row.town);
    const key = `${normalizedName}|${normalizedTown}`;
    const g = groups.get(key);
    if (g) g.rows.push(row);
    else groups.set(key, { normalizedName, normalizedTown, rows: [row] });
  }

  const result = new Map<string, RegisterSponsor>();
  for (const [key, g] of groups) {
    const rating = pickRating(g.rows.map((r) => ({ rating: parseRating(r.typeRating), raw: r.typeRating })));
    result.set(key, {
      key,
      name: pickName(g.rows.map((r) => r.name)),
      normalizedName: g.normalizedName,
      town: pickName(g.rows.map((r) => r.town)),
      normalizedTown: g.normalizedTown,
      county: pickCounty(g.rows.map((r) => r.county)),
      rating: rating.rating,
      ratingRaw: rating.raw,
      entryCount: g.rows.length,
    });
  }
  return result;
}
