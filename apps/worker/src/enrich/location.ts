const UK_WORDS = /\b(united kingdom|great britain|england|scotland|wales|northern ireland|\bu\.?k\.?\b|gb|london|manchester|birmingham|leeds|glasgow|edinburgh|bristol|liverpool|sheffield|newcastle|nottingham|cardiff|belfast|cambridge|oxford|reading|brighton|leicester|coventry|southampton|milton keynes|aberdeen|york|bath|exeter|norwich|remote \(uk\)|uk remote)\b/i;
// Checked first, so "New York", "London, Ontario" or "Cambridge, MA" don't count as UK.
const NON_UK_WORDS = /\b(new york|new jersey|new england|new south wales|nova scotia|united states|usa|canada|australia|ontario)\b/i;
/** ", NY" / ", MA" / ", ON": US states and Canadian/Australian regions after a comma (case-sensitive on purpose). */
const NON_UK_REGION = /,\s*(?:A[LKZR]|C[AOT]|D[EC]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[AT]|W[AIVY]|ON|BC|QC|NSW|VIC)\b/;

/** Is this job in the UK? Country codes win; otherwise look for UK places in the location text. */
export function isUkLocation(location: string | null | undefined, countryCode?: string | null): boolean {
  if (countryCode) {
    const c = countryCode.toUpperCase();
    if (c === 'GB' || c === 'UK' || c === 'GBR') return true;
    if (c.length === 2 || c.length === 3) return false;
  }
  if (!location) return false;
  if (NON_UK_WORDS.test(location) || NON_UK_REGION.test(location)) return false;
  return UK_WORDS.test(location);
}
