import type { AlertItem, SavedSearchGroup } from '@sponsors/email';

export interface WatchedChange {
  userId: string;
  name: string;
  town: string;
  slug: string;
  type: 'added' | 'removed' | 'readded' | 'rating_changed';
  oldValue: string | null;
  newValue: string | null;
}

export interface SearchMatch {
  userId: string;
  searchId: number;
  query: string | null;
  town: string | null;
  name: string;
  sponsorTown: string;
  slug: string;
}

export interface UserAlert {
  userId: string;
  watched: AlertItem[];
  searches: SavedSearchGroup[];
  itemCount: number;
}

export const MAX_ITEMS_PER_SEARCH = 15;

export function describeChange(c: Pick<WatchedChange, 'type' | 'oldValue' | 'newValue'>): Pick<AlertItem, 'change' | 'tone'> {
  switch (c.type) {
    case 'removed':
      return { change: 'Removed from the register', tone: 'bad' };
    case 'readded':
      return { change: 'Back on the register', tone: 'good' };
    case 'added':
      return { change: 'New sponsor', tone: 'good' };
    case 'rating_changed':
      return c.newValue?.startsWith('B')
        ? { change: `Downgraded to ${c.newValue} rating (was ${c.oldValue})`, tone: 'warn' }
        : { change: `Rating changed from ${c.oldValue} to ${c.newValue}`, tone: 'neutral' };
  }
}

/** Group raw rows into one alert per user. Pure, so it is unit tested. */
export function buildUserAlerts(watchedRows: WatchedChange[], searchRows: SearchMatch[], siteUrl: string): UserAlert[] {
  const byUser = new Map<string, UserAlert>();
  const get = (userId: string) => {
    let a = byUser.get(userId);
    if (!a) byUser.set(userId, (a = { userId, watched: [], searches: [], itemCount: 0 }));
    return a;
  };
  const sponsorUrl = (slug: string) => `${siteUrl}/sponsors/${slug}`;

  for (const r of watchedRows) {
    const a = get(r.userId);
    a.watched.push({ name: r.name, town: r.town, url: sponsorUrl(r.slug), ...describeChange(r) });
    a.itemCount++;
  }

  const searchGroups = new Map<string, { userId: string; search: SearchMatch; items: AlertItem[]; seen: Set<string> }>();
  for (const r of searchRows) {
    const key = `${r.userId}:${r.searchId}`;
    let g = searchGroups.get(key);
    if (!g) searchGroups.set(key, (g = { userId: r.userId, search: r, items: [], seen: new Set() }));
    if (g.seen.has(r.slug)) continue;
    g.seen.add(r.slug);
    g.items.push({ name: r.name, town: r.sponsorTown, url: sponsorUrl(r.slug), change: 'New sponsor', tone: 'good' });
  }
  for (const g of searchGroups.values()) {
    const a = get(g.userId);
    const { query, town } = g.search;
    const label = [query && `“${query}”`, town && `in ${town}`].filter(Boolean).join(' ');
    const qs = new URLSearchParams({ ...(query ? { q: query } : {}), ...(town ? { town } : {}) });
    a.searches.push({
      label,
      items: g.items.slice(0, MAX_ITEMS_PER_SEARCH),
      moreCount: Math.max(0, g.items.length - MAX_ITEMS_PER_SEARCH),
      moreUrl: `${siteUrl}/sponsors?${qs}`,
    });
    a.itemCount += g.items.length;
  }

  for (const a of byUser.values()) a.watched.sort((x, y) => x.name.localeCompare(y.name));
  return [...byUser.values()].filter((a) => a.itemCount > 0);
}
