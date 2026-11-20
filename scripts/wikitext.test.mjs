import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanWikitext, getInfoboxField, parseMoney, parseList } from './lib/wikitext.mjs';

const money = (wikitext) => parseMoney(cleanWikitext(wikitext));

test('Indian rupee templates and crore/lakh', () => {
  assert.deepEqual(money('{{INR|35 crore}}<ref>{{cite news|title=x}}</ref>'), {
    currency: 'INR', low: 35e7, high: 35e7, approx: false,
  });
  assert.equal(money('{{estimation}} {{INR|1,050.30}} crore<ref name="bh" />').low, 1050.3e7);
  assert.equal(money('{{estimation}} {{INR|1,050.30}} crore').approx, true);
  const range = money('{{INR|1642–1800}} crore{{efn|name="pushpa2"}}');
  assert.equal(range.low, 1642e7);
  assert.equal(range.high, 1800e7);
  assert.equal(money('<!-- note -->{{INR|1042-1100 crore}}{{efn|name="kalki"}}').low, 1042e7);
  assert.equal(money('{{INR|3.5 [[crore]]}}').low, 3.5e7);
  assert.equal(money('{{INRConvert|100|c}}').low, 100e7);
  assert.equal(money('[[Indian rupee|₹]]50 lakh').low, 50e5);
  assert.equal(money('Rs. 2.5 crore').low, 2.5e7);
  assert.equal(money('₹1000+ crore').low, 1000e7);
});

test('dollars and other currencies', () => {
  assert.equal(money('$2.923 billion<ref>x</ref>').low, 2.923e9);
  assert.equal(money('{{US$|1.5 billion}}').low, 1.5e9);
  assert.equal(money('US$ 100{{nbsp}}million').low, 100e6);
  assert.equal(money('$2,923,706,026').low, 2923706026);
  assert.equal(money('$1.1 billion – $1.2 billion').high, 1.2e9);
  assert.equal(money('CN¥5.69 billion').currency, 'CNY');
  assert.equal(money('₩140 billion').currency, 'KRW');
  assert.equal(money('£10 million').currency, 'GBP');
});

test('picks the largest amount in the first currency', () => {
  const m = money('{{Plainlist|\n* $5.3 million (North America)\n* $12 million (worldwide)}}');
  assert.equal(m.low, 12e6);
  const conv = money('$100 million (₹800 crore)');
  assert.equal(conv.currency, 'USD');
  assert.equal(conv.low, 100e6);
});

test('ignores letters that only look like currency codes', () => {
  assert.equal(money('Hours 2'), null);
  assert.equal(money('unknown'), null);
});

test('reads infobox fields across nested templates', () => {
  const wt = `{{Infobox film
| name = Test
| budget = {{INR|250}} crore<ref name="b">{{Cite news |title=How much |url=x}}</ref>
| gross = {{Plainlist|
* {{INR|1,050}} crore
}}
| starring = {{Plainlist|
* [[Shah Rukh Khan]]
* [[Deepika Padukone]]
* [[John Abraham (actor)|John Abraham]]
}}
}}
Lead text.`;
  assert.equal(money(getInfoboxField(wt, 'budget')).low, 250e7);
  assert.equal(money(getInfoboxField(wt, 'gross')).low, 1050e7);
  assert.deepEqual(parseList(getInfoboxField(wt, 'starring')), [
    'Shah Rukh Khan', 'Deepika Padukone', 'John Abraham',
  ]);
  assert.equal(getInfoboxField(wt, 'missing'), null);
});
