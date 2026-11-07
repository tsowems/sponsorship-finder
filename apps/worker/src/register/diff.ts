import type { RegisterSponsor } from './group';

export interface ExistingSponsor {
  id: number;
  key: string;
  status: 'active' | 'removed';
  rating: string;
  name: string;
  town: string;
  county: string | null;
  entryCount: number;
  /** Empty = not recorded yet (sponsors imported before route tracking existed). */
  routes: string[];
}

/** An existing, still-listed sponsor whose details changed. Several kinds of change can happen at once. */
export interface SponsorUpdate {
  id: number;
  sponsor: RegisterSponsor;
  rating?: { from: string; to: string };
  location?: { from: string; to: string };
  routes?: { from: string[]; to: string[] };
  /** Set when the sponsor moved town: its identity key changes but it keeps its id, slug and watchers. */
  newKey?: string;
}

export interface RegisterDiff {
  added: RegisterSponsor[];
  readded: { id: number; sponsor: RegisterSponsor }[];
  removed: { id: number; key: string }[];
  /** Includes cosmetic-only updates (name casing, merged-row count), which create no events. */
  updated: SponsorUpdate[];
}

export const formatLocation = (town: string, county: string | null) => (county ? `${town}, ${county}` : town);
export const ROUTE_SEPARATOR = ' | ';
const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const nameOf = (key: string) => key.slice(0, key.lastIndexOf('|'));

/** Pure comparison of what we have stored against a freshly parsed register. */
export function diffRegister(existing: ExistingSponsor[], incoming: Map<string, RegisterSponsor>): RegisterDiff {
  const diff: RegisterDiff = { added: [], readded: [], removed: [], updated: [] };
  const byKey = new Map(existing.map((e) => [e.key, e]));

  const compare = (prev: ExistingSponsor, sponsor: RegisterSponsor, newKey?: string): SponsorUpdate | null => {
    const u: SponsorUpdate = { id: prev.id, sponsor, newKey };
    if (prev.rating !== sponsor.rating) u.rating = { from: prev.rating, to: sponsor.rating };
    const from = formatLocation(prev.town, prev.county);
    const to = formatLocation(sponsor.town, sponsor.county);
    if (newKey || prev.county !== sponsor.county) {
      if (from !== to) u.location = { from, to };
    }
    // Sponsors stored before route tracking have no routes: fill them in silently, no event.
    if (prev.routes.length > 0 && !sameList(prev.routes, sponsor.routes)) u.routes = { from: prev.routes, to: sponsor.routes };
    const cosmetic =
      prev.name !== sponsor.name || prev.town !== sponsor.town || prev.entryCount !== sponsor.entryCount || !sameList(prev.routes, sponsor.routes);
    return u.rating || u.location || u.routes || newKey || cosmetic ? u : null;
  };

  const added: RegisterSponsor[] = [];
  for (const sponsor of incoming.values()) {
    const prev = byKey.get(sponsor.key);
    if (!prev) added.push(sponsor);
    else if (prev.status === 'removed') diff.readded.push({ id: prev.id, sponsor });
    else {
      const u = compare(prev, sponsor);
      if (u) diff.updated.push(u);
    }
  }
  const removed = existing.filter((e) => e.status === 'active' && !incoming.has(e.key));

  // A sponsor that disappeared from one town and appeared in another under the same name, in the
  // same file, has moved (or corrected its address). Only pair when it's unambiguous: exactly one
  // removal and one addition for that name.
  const removedByName = new Map<string, ExistingSponsor[]>();
  for (const r of removed) removedByName.set(nameOf(r.key), [...(removedByName.get(nameOf(r.key)) ?? []), r]);
  const addedByName = new Map<string, RegisterSponsor[]>();
  for (const a of added) addedByName.set(a.normalizedName, [...(addedByName.get(a.normalizedName) ?? []), a]);

  const moved = new Set<string>();
  for (const [name, adds] of addedByName) {
    const rems = removedByName.get(name);
    if (adds.length !== 1 || rems?.length !== 1) continue;
    const u = compare(rems[0], adds[0], adds[0].key);
    if (u) diff.updated.push(u);
    moved.add(adds[0].key);
    moved.add(rems[0].key);
  }

  diff.added = added.filter((a) => !moved.has(a.key));
  diff.removed = removed.filter((r) => !moved.has(r.key)).map((r) => ({ id: r.id, key: r.key }));
  return diff;
}
