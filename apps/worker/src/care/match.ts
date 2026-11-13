import { normalizeName, normalizeTown } from '@sponsors/db';

/**
 * Match licensed sponsors to providers on the care regulators' registers.
 *
 * Both registers name the *provider*: the legal organisation, which is also the name on the Home Office register.
 * Names are compared after dropping company suffixes ("Ltd", "Limited", "UK", "The") and "trading as" parts.
 * A match is accepted when:
 *  - the names agree and one of the provider's services is in the sponsor's town ('name_and_town'), or
 *  - the names agree, the sponsor's name is a registered company name (Ltd/PLC/LLP, unique at Companies House)
 *    and only one provider has that name ('company_name').
 */

export type Regulator = 'cqc' | 'care_inspectorate';

/** One registered service (location) from a register file. */
export interface ServiceRecord {
  regulator: Regulator;
  providerId: string;
  providerName: string;
  homeCare: boolean;
  /** CQC location ID (used to look up the service's rating). */
  locationId?: string;
  /** Address, town and council area of the service: used to check the sponsor's town. */
  place: string;
}

export interface Provider {
  regulator: Regulator;
  providerId: string;
  providerName: string;
  services: number;
  homeCareServices: number;
  places: string;
}

export interface CareMatch {
  regulator: Regulator;
  providerId: string;
  providerName: string;
  homeCare: boolean;
  services: number;
  homeCareServices: number;
  matchedBy: 'name_and_town' | 'company_name';
}

/** "Bright Care (UK) Ltd t/a Bluebird Care Leeds" → "bright care" */
export function providerKey(name: string): string {
  return normalizeName(name)
    .replace(/\b(t a|ta|trading as)\b.*$/, '')
    .replace(/\b(limited|plc|llp|lp|cic|the|uk|company)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The trading name after "t/a", if any: "Beam Bug Limited T/A Caremark (Chichester)" → "caremark chichester" */
export function tradingName(name: string): string | null {
  return normalizeName(name).match(/\b(?:t a|trading as)\b (.+)$/)?.[1] ?? null;
}

/** Group services by provider, then index providers by name key (a key can belong to several providers). */
export function indexProviders(services: ServiceRecord[]): Map<string, Provider[]> {
  const byId = new Map<string, Provider>();
  for (const s of services) {
    const id = `${s.regulator}:${s.providerId}`;
    const p = byId.get(id) ?? { regulator: s.regulator, providerId: s.providerId, providerName: s.providerName, services: 0, homeCareServices: 0, places: '' };
    p.services++;
    if (s.homeCare) p.homeCareServices++;
    p.places += ` ${normalizeTown(s.place)} `;
    byId.set(id, p);
  }
  const index = new Map<string, Provider[]>();
  for (const p of byId.values()) {
    const key = providerKey(p.providerName);
    if (key.length < 3) continue;
    index.set(key, [...(index.get(key) ?? []), p]);
  }
  return index;
}

/** First meaningful word of the sponsor's town ("Newcastle-under-Lyme" → "newcastle", "St. Albans" → "st albans"). */
function townWords(town: string | null): string[] {
  const t = normalizeTown(town ?? '').replace(/\b(united kingdom|england|scotland|wales|uk)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return [];
  const words = t.split(' ');
  const first = words[0] === 'st' && words[1] ? `st ${words[1]}` : words[0];
  return first.length >= 3 ? [first] : [];
}

const isCompanyName = (normalizedName: string) => /\b(limited|plc|llp)\b/.test(normalizedName);

/** Best provider for a sponsor, one per regulator. */
export function matchSponsor(sponsor: { name: string; normalizedName: string; town: string | null }, index: Map<string, Provider[]>): CareMatch[] {
  const keys = [providerKey(sponsor.name)];
  const ta = tradingName(sponsor.name);
  if (ta) keys.push(providerKey(ta));
  const candidates = [...new Set(keys.filter((k) => k.length >= 3).flatMap((k) => index.get(k) ?? []))];
  if (!candidates.length) return [];

  const town = townWords(sponsor.town);
  const inTown = (p: Provider) => town.some((w) => p.places.includes(` ${w} `));
  const out: CareMatch[] = [];
  for (const regulator of ['cqc', 'care_inspectorate'] as const) {
    const mine = candidates.filter((p) => p.regulator === regulator);
    if (!mine.length) continue;
    const local = mine.filter(inTown);
    let pick: Provider | null = null;
    let matchedBy: CareMatch['matchedBy'] = 'name_and_town';
    if (local.length) pick = local.sort((a, b) => b.homeCareServices - a.homeCareServices || b.services - a.services)[0];
    else if (mine.length === 1 && isCompanyName(sponsor.normalizedName)) {
      pick = mine[0];
      matchedBy = 'company_name';
    }
    if (pick) {
      out.push({
        regulator,
        providerId: pick.providerId,
        providerName: pick.providerName,
        homeCare: pick.homeCareServices > 0,
        services: pick.services,
        homeCareServices: pick.homeCareServices,
        matchedBy,
      });
    }
  }
  return out;
}
