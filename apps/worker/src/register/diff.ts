import type { RegisterSponsor } from './group';

export interface ExistingSponsor {
  id: number;
  key: string;
  status: 'active' | 'removed';
  rating: string;
  name: string;
  county: string | null;
  entryCount: number;
}

export interface RegisterDiff {
  added: RegisterSponsor[];
  readded: { id: number; sponsor: RegisterSponsor }[];
  removed: { id: number; key: string }[];
  ratingChanged: { id: number; from: string; to: string; sponsor: RegisterSponsor }[];
  /** Still listed but display details changed (name casing, county, merged-row count). No event. */
  detailsChanged: { id: number; sponsor: RegisterSponsor }[];
}

/** Pure comparison of what we have stored against a freshly parsed register. */
export function diffRegister(existing: ExistingSponsor[], incoming: Map<string, RegisterSponsor>): RegisterDiff {
  const diff: RegisterDiff = { added: [], readded: [], removed: [], ratingChanged: [], detailsChanged: [] };
  const byKey = new Map(existing.map((e) => [e.key, e]));

  for (const sponsor of incoming.values()) {
    const prev = byKey.get(sponsor.key);
    if (!prev) {
      diff.added.push(sponsor);
    } else if (prev.status === 'removed') {
      diff.readded.push({ id: prev.id, sponsor });
    } else if (prev.rating !== sponsor.rating) {
      diff.ratingChanged.push({ id: prev.id, from: prev.rating, to: sponsor.rating, sponsor });
    } else if (
      prev.name !== sponsor.name ||
      prev.county !== sponsor.county ||
      prev.entryCount !== sponsor.entryCount
    ) {
      diff.detailsChanged.push({ id: prev.id, sponsor });
    }
  }

  for (const prev of existing) {
    if (prev.status === 'active' && !incoming.has(prev.key)) {
      diff.removed.push({ id: prev.id, key: prev.key });
    }
  }
  return diff;
}
