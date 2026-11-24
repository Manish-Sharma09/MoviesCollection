// node --test scripts/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boxOfficeSection, marketFigures } from './lib/boxoffice-text.mjs';

const article = `Intro text.
== Release ==
It released on 5 November.
== Box office ==
=== India ===
On its opening day, the film collected {{INRConvert|54.75|c}} net in India.<ref>{{cite web|title=x}}</ref>
By the end of its run, the film had earned a net of {{INRConvert|538.03|c}} in India, equivalent to a gross of {{INR}}702 crore.
It surpassed ''Baahubali 2'''s record of {{INRConvert|510.99|c}} net in India.
=== Overseas ===
The film grossed {{US$|45 million}} overseas.
Worldwide, it grossed {{INRConvert|2024|c}}.
== Reception ==
Critics liked it, saying it earned ₹900 crore net in India.`;

test('finds the box office section and stops at the next one', () => {
  const s = boxOfficeSection(article);
  assert.ok(s.includes('Overseas'));
  assert.ok(!s.includes('Critics'));
});

test('reads India net, India gross and overseas; skips record comparisons and partial-day figures', () => {
  const f = marketFigures(boxOfficeSection(article));
  assert.equal(f.indiaNet.inr, 538.03e7);
  assert.equal(f.indiaGross.inr, 702e7);
  assert.equal(f.overseas.usd, 45e6);
});

test('reads a box office table', () => {
  const table = `== Box office ==
{| class="wikitable"
! Territory !! Gross
|-
| India (net) || ₹300 crore
|-
| India (gross) || ₹354 crore
|-
| Overseas || $20 million
|}`;
  const f = marketFigures(boxOfficeSection(table));
  assert.equal(f.indiaNet.inr, 300e7);
  assert.equal(f.indiaGross.inr, 354e7);
  assert.equal(f.overseas.usd, 20e6);
});

test('ignores amounts whose market is not stated', () => {
  const f = marketFigures('The film was made on a budget of ₹200 crore and earned ₹500 crore worldwide.');
  assert.deepEqual(f, {});
});

test('skips partial-run figures and single language versions', () => {
  const section = `== Box office ==
The film collected ₹62 crore net in India on its opening day.
In its first weekend it grossed ₹210 crore in India.
The Hindi version earned ₹300 crore net in India.
It earned a share of ₹200 crore net in India for its distributors.`;
  assert.deepEqual(marketFigures(section), {});
});

test('skips milestones passed', () => {
  assert.deepEqual(marketFigures('== Box office ==\nIt became the first film to cross ₹500 crore net in India.'), {});
});

test('skips floors ("over", "first film to") and single-language figures', () => {
  const section = `== Box office ==
It became the first Hindi film to net over ₹600 crore in India.
It ended its run with ₹212 crore net in Hindi.
The film grossed more than ₹300 crore in India.`;
  assert.deepEqual(marketFigures(section), {});
});

test('keeps a plain total next to a worldwide figure', () => {
  const f = marketFigures('== Box office ==\nWith a domestic gross of ₹318.01 crore and ₹157.61 crore from overseas, the film grossed ₹475.62 crore worldwide.');
  assert.equal(f.indiaGross.inr, 318.01e7);
  assert.equal(f.overseas.inr, 157.61e7);
});

test('reads the advance booking amount, as a floor when the article says "over"', async () => {
  const { advanceFigure } = await import('./lib/boxoffice-text.mjs');
  const text = `== Release ==
Advance booking for the film opened on 1 December.<ref>{{cite web|title=x}}</ref>
By the eve of release, the film had collected over {{INRConvert|42.5|c}} gross from advance bookings for its opening day.
On day two it had sold ₹12 crore in advance booking.
== Box office ==
The film grossed ₹150 crore worldwide on its opening day.`;
  const a = advanceFigure(text);
  assert.equal(a.inr, 42.5e7);
  assert.equal(a.approx, true);
  assert.match(a.quote, /advance bookings/);
});

test('reads presales in dollars and ignores rights deals and record comparisons', async () => {
  const { advanceFigure } = await import('./lib/boxoffice-text.mjs');
  assert.equal(advanceFigure('The film made $40 million in presales, according to Fandango.').usd, 40e6);
  assert.equal(advanceFigure('Its satellite and digital rights were sold for ₹200 crore in a pre-release deal, before advance booking began.'), null);
  assert.equal(advanceFigure("Its advance booking of ₹60 crore surpassed the previous record of ₹50 crore set by another film."), null);
  assert.equal(advanceFigure('The film grossed ₹300 crore worldwide.'), null);
  assert.equal(advanceFigure('In the United Kingdom, the film amassed $1.2 million in presales from BFI IMAX, breaking the first-day presale record set by another film ($1 million).'), null);
  assert.equal(advanceFigure('By the end of October, the film had reached $125 million in pre-sales.').usd, 125e6);
});
