import assert from 'node:assert/strict';
import { test } from 'node:test';
import { councilNation } from './councils';

test('councilNation recognises local councils and their nation', () => {
  const cases: [string, string | null][] = [
    ['leeds city council', 'england'],
    ['london borough of tower hamlets', 'england'],
    ['royal borough of windsor and maidenhead', 'england'],
    ['the royal borough of kensington and chelsea', 'england'],
    ['city of wolverhampton council', 'england'],
    ['birmingham city council corporate', 'england'],
    ['kent county council schools', 'england'],
    ['cornwall council', 'england'],
    ['brent council', 'england'],
    ['rmbc council', 'england'],
    ['newcastle city council', 'england'],
    ['fife council', 'scotland'],
    ['the city of edinburgh council', 'scotland'],
    ['aberdeen city council', 'scotland'],
    ['the highland council', 'scotland'],
    ['orkney islands council', 'scotland'],
    ['comhairle nan eilean siar', 'scotland'],
    ['cardiff council', 'wales'],
    ['newport city council', 'wales'],
    ['bridgend county borough council', 'wales'],
    ['vale of glamorgan council', 'wales'],
    ['belfast city council', 'northern-ireland'],
    ['british council', null],
    ['general medical council', null],
    ['engineering council', null],
    ['the british refugee council', null],
    ['pontypridd town council', null],
    ['national house building council', null],
    ['cardiff third sector council c3sc', null],
    ['glasgow university students representative council', null],
    ['the parochial church council of the ecclesiastical parish of st paul slough', null],
    ['arts council england', null],
  ];
  for (const [name, want] of cases) assert.equal(councilNation(name), want, name);
});
