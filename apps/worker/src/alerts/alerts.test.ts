import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildUserAlerts, describeChange, describeRoutes, MAX_ITEMS_PER_SEARCH, type SearchMatch } from './build';

const SITE = 'https://example.test';

test('groups watched changes and saved-search matches into one alert per user', () => {
  const alerts = buildUserAlerts(
    [
      { userId: 'u1', name: 'Zeta Ltd', town: 'Leeds', slug: 'zeta-leeds', type: 'removed', oldValue: null, newValue: null },
      { userId: 'u1', name: 'Alpha Ltd', town: 'York', slug: 'alpha-york', type: 'rating_changed', oldValue: 'A', newValue: 'B' },
      { userId: 'u2', name: 'Beta Ltd', town: 'Bath', slug: 'beta-bath', type: 'readded', oldValue: null, newValue: 'A' },
    ],
    [{ userId: 'u1', searchId: 7, query: 'software', town: 'Manchester', name: 'Acme Software Ltd', sponsorTown: 'Manchester', slug: 'acme' }],
    SITE,
  );
  assert.equal(alerts.length, 2);
  const u1 = alerts.find((a) => a.userId === 'u1')!;
  assert.deepEqual(u1.watched.map((w) => w.name), ['Alpha Ltd', 'Zeta Ltd']); // sorted
  assert.equal(u1.watched[0].change, 'Downgraded to B rating (was A)');
  assert.equal(u1.watched[0].tone, 'warn');
  assert.equal(u1.watched[1].change, 'Removed from the register');
  assert.equal(u1.searches[0].label, '“software” in Manchester');
  assert.equal(u1.searches[0].items[0].url, `${SITE}/sponsors/acme`);
  assert.equal(u1.itemCount, 3);
});

test('caps long saved-search lists and links to the rest', () => {
  const rows: SearchMatch[] = Array.from({ length: MAX_ITEMS_PER_SEARCH + 5 }, (_, i) => ({
    userId: 'u1', searchId: 1, query: null, town: 'London', name: `Co ${i}`, sponsorTown: 'London', slug: `co-${i}`,
  }));
  const [a] = buildUserAlerts([], rows, SITE);
  assert.equal(a.searches[0].items.length, MAX_ITEMS_PER_SEARCH);
  assert.equal(a.searches[0].moreCount, 5);
  assert.equal(a.searches[0].moreUrl, `${SITE}/sponsors?town=London`);
  assert.equal(a.searches[0].label, 'in London');
});

test('no alert for users with nothing to report', () => {
  assert.deepEqual(buildUserAlerts([], [], SITE), []);
});

test('describes location and route changes', () => {
  assert.equal(describeChange({ type: 'location_changed', oldValue: 'Leeds', newValue: 'Bradford, West Yorkshire' }).change, 'Location changed from Leeds to Bradford, West Yorkshire');
  assert.equal(
    describeRoutes('Creative Worker | Skilled Worker', 'Global Business Mobility: Senior or Specialist Worker | Skilled Worker'),
    'Visa routes changed: now also Global Business Mobility: Senior or Specialist Worker; no longer Creative Worker',
  );
});
