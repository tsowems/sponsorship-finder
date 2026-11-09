import { fetchJson } from './http';

/** Official website (P856) of the Wikidata item with this Companies House number (P2622). */
export async function websiteByCompanyNumber(companyNumber: string): Promise<string | null> {
  const query = `SELECT ?site WHERE { ?item wdt:P2622 "${companyNumber.replace(/[^A-Z0-9]/gi, '')}" ; wdt:P856 ?site } LIMIT 1`;
  const res = await fetchJson<{ results?: { bindings?: { site?: { value: string } }[] } }>(
    `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`,
    { headers: { Accept: 'application/sparql-results+json' } },
  ).catch(() => null);
  return res?.results?.bindings?.[0]?.site?.value ?? null;
}

/**
 * Websites of UK organisations whose Wikidata label matches the name. Weaker than the company-number
 * lookup, so results are only *candidates*: the site must still pass verification.
 */
export async function websitesByName(name: string): Promise<string[]> {
  const query = `SELECT DISTINCT ?site WHERE {
    SERVICE wikibase:mwapi { bd:serviceParam wikibase:api "EntitySearch"; wikibase:endpoint "www.wikidata.org";
      mwapi:search "${name.replace(/["\\]/g, '')}"; mwapi:language "en". ?item wikibase:apiOutputItem mwapi:item. }
    ?item wdt:P17 wd:Q145 ; wdt:P856 ?site .
  } LIMIT 3`;
  const res = await fetchJson<{ results?: { bindings?: { site?: { value: string } }[] } }>(
    `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`,
    { headers: { Accept: 'application/sparql-results+json' } },
  ).catch(() => null);
  return (res?.results?.bindings ?? []).map((b) => b.site?.value).filter((v): v is string => Boolean(v));
}
