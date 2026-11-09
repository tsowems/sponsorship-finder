/**
 * Local councils (principal local authorities) on the register, grouped by nation.
 *
 * The register has no "type" field, and plenty of licensed sponsors are called "council" without being local
 * government (British Council, General Medical Council, parochial church councils…). So a sponsor counts as a
 * council only when its name has the shape of a local authority:
 *  - "London Borough of …" / "Royal Borough of …" / "City of … Council"
 *  - "… City / County / Borough / District / Metropolitan / Islands Council"
 *  - "… Council" where "…" is a known council area (Fife, Cornwall, Brent…)
 * Town, parish and community councils are left out.
 */

export const NATIONS = [
  { slug: 'england', title: 'England' },
  { slug: 'scotland', title: 'Scotland' },
  { slug: 'wales', title: 'Wales' },
  { slug: 'northern-ireland', title: 'Northern Ireland' },
] as const;
export type Nation = (typeof NATIONS)[number]['slug'];
export const findNation = (slug: string) => NATIONS.find((n) => n.slug === slug) ?? null;

// Council areas, as left after dropping "city/county/borough… council" (normalised: lower case, no punctuation).
const SCOTLAND = new Set([
  'aberdeen', 'aberdeenshire', 'angus', 'argyll and bute', 'clackmannanshire', 'dumfries and galloway', 'dundee', 'east ayrshire',
  'east dunbartonshire', 'east lothian', 'east renfrewshire', 'edinburgh', 'eilean siar', 'falkirk', 'fife', 'glasgow', 'highland',
  'inverclyde', 'midlothian', 'moray', 'north ayrshire', 'north lanarkshire', 'orkney', 'perth and kinross', 'renfrewshire',
  'scottish borders', 'shetland', 'south ayrshire', 'south lanarkshire', 'stirling', 'west dunbartonshire', 'west lothian',
]);
const WALES = new Set([
  'blaenau gwent', 'bridgend', 'caerphilly', 'cardiff', 'carmarthenshire', 'ceredigion', 'conwy', 'denbighshire', 'flintshire',
  'gwynedd', 'isle of anglesey', 'anglesey', 'merthyr tydfil', 'monmouthshire', 'neath port talbot', 'newport', 'pembrokeshire', 'powys',
  'rhondda cynon taf', 'swansea', 'torfaen', 'vale of glamorgan', 'wrexham',
]);
const NORTHERN_IRELAND = new Set([
  'antrim and newtownabbey', 'ards and north down', 'armagh banbridge and craigavon', 'armagh city banbridge and craigavon', 'belfast',
  'causeway coast and glens', 'derry and strabane', 'derry city and strabane', 'fermanagh and omagh', 'lisburn and castlereagh',
  'mid and east antrim', 'mid ulster', 'newry mourne and down',
]);
/** English councils usually called just "X Council" (unitaries, London boroughs, new councils). */
const ENGLAND_PLAIN = new Set([
  'barking and dagenham', 'barnet', 'bath and north east somerset', 'bexley', 'blackpool', 'bolton', 'bournemouth christchurch and poole',
  'bracknell forest', 'brent', 'bromley', 'buckinghamshire', 'bury', 'camden', 'central bedfordshire', 'cheshire east',
  'cheshire west and chester', 'cornwall', 'croydon', 'cumberland', 'darlington', 'dorset', 'durham', 'ealing', 'east riding of yorkshire',
  'east suffolk', 'enfield', 'gateshead', 'greenwich', 'hackney', 'halton', 'hammersmith and fulham', 'haringey', 'harrow', 'hartlepool',
  'havering', 'herefordshire', 'hillingdon', 'hounslow', 'isle of wight', 'isles of scilly', 'islington', 'kensington and chelsea',
  'kingston upon thames', 'knowsley', 'lambeth', 'lewisham', 'medway', 'merton', 'middlesbrough', 'milton keynes', 'newham',
  'north devon', 'north east lincolnshire', 'north lincolnshire', 'north northamptonshire', 'north somerset', 'north tyneside',
  'north yorkshire', 'northumberland', 'oldham', 'redbridge', 'redcar and cleveland', 'richmond upon thames', 'rochdale', 'rotherham',
  'sefton', 'shropshire', 'somerset', 'south gloucestershire', 'south tyneside', 'southwark', 'st helens', 'stockport', 'sunderland',
  'sutton', 'tameside', 'telford and wrekin', 'torbay', 'tower hamlets', 'trafford', 'walsall', 'waltham forest', 'wandsworth',
  'west northamptonshire', 'west suffolk', 'westminster', 'westmorland and furness', 'wigan', 'wiltshire', 'wirral',
]);
/** Odd official names. */
const SPECIAL: Record<string, string> = {
  'comhairle nan eilean siar': 'eilean siar',
  'rmbc council': 'rotherham',
  'city of london corporation': 'city of london',
  'the city of london corporation': 'city of london',
};

const TYPE_WORDS = '(?:city|county|borough|district|metropolitan|islands|unitary)';
/** "… [type words] council [schools|services|corporate]" */
const TYPED = new RegExp(`^(?:the )?(?:city of )?(.+?) (?:${TYPE_WORDS} )+council(?: (?:schools|services|corporate))?$`);
const PLAIN = /^(?:the )?(?:city of )?(.+?) council(?: (?:schools|services|corporate))?$/;
const BOROUGH_OF = /^(?:the )?(?:london|royal) borough of (.+)$/;

const nationOf = (place: string): Nation =>
  SCOTLAND.has(place) ? 'scotland' : WALES.has(place) ? 'wales' : NORTHERN_IRELAND.has(place) ? 'northern-ireland' : 'england';

/** The nation of a local council from its normalised name, or null if it isn't one. Exported for tests. */
export function councilNation(normalizedName: string): Nation | null {
  const n = normalizedName.trim();
  if (SPECIAL[n]) return nationOf(SPECIAL[n]);
  if (BOROUGH_OF.test(n)) return 'england';
  // "city of york council" / "city of edinburgh council" name the place, so they count as typed.
  const typed = n.match(TYPED) ?? (/^(?:the )?city of /.test(n) ? n.match(PLAIN) : null);
  if (typed) {
    const place = typed[1];
    // "Pontypridd Town Council", "… Parochial Church Council" etc. never reach here: "town"/"church" aren't type words.
    return nationOf(place);
  }
  const plain = n.match(PLAIN);
  if (plain) {
    const place = plain[1];
    if (SCOTLAND.has(place) || WALES.has(place) || NORTHERN_IRELAND.has(place) || ENGLAND_PLAIN.has(place)) return nationOf(place);
  }
  return null;
}
