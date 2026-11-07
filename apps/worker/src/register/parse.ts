import { parse } from 'csv-parse/sync';
import { cleanText } from '@sponsors/db/normalize';

export interface RegisterRow {
  name: string;
  town: string;
  county: string;
  typeRating: string;
  route: string;
}

const COLUMNS = {
  name: 'Organisation Name',
  town: 'Town/City',
  county: 'County',
  typeRating: 'Type & Rating',
  route: 'Route',
} as const;

export const SKILLED_WORKER_ROUTE = 'Skilled Worker';

/** Parse the UKVI register CSV. Throws if the column layout changes, so we never import garbage. */
export function parseRegister(csvText: string): RegisterRow[] {
  const records = parse(csvText, {
    columns: (header: string[]) => header.map((h) => cleanText(h)),
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  if (records.length === 0) throw new Error('Register CSV is empty');
  const missing = Object.values(COLUMNS).filter((c) => !(c in records[0]));
  if (missing.length) throw new Error(`Register CSV is missing expected columns: ${missing.join(', ')}`);

  return records.map((r) => ({
    name: cleanText(r[COLUMNS.name]),
    town: cleanText(r[COLUMNS.town]),
    county: cleanText(r[COLUMNS.county]),
    typeRating: cleanText(r[COLUMNS.typeRating]),
    route: cleanText(r[COLUMNS.route]),
  }));
}
