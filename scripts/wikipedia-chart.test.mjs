import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGrossingTable } from './lib/wikipedia-chart.mjs';

// Shaped like the parse API's HTML for "List of highest-grossing films" (November 2026): a header row,
// a plain row, a row whose rank and gross carry footnote markers and whose title sits in a sort-key span,
// and a row with an entity in its title.
const HTML = `<div class="mw-parser-output"><p>Intro</p>
<table class="wikitable sortable plainrowheaders sticky-header col4right col5center col6center">
<caption>Highest-grossing films<sup id="cite&#95;ref-12" class="reference"><a href="#cite_note-12">[12]</a></sup>
</caption>
<tbody><tr>
<th>Rank
</th>
<th>Peak
</th>
<th>Title
</th>
<th class="unsortable">Worldwide gross
</th>
<th>Year
</th>
<th class="unsortable"><abbr title="References">Ref</abbr>
</th></tr>
<tr>
<td>2
</td>
<td>1
</td>
<th scope="row"><i><a href="/wiki/Avatar_(2009_film)" title="Avatar (2009 film)">Avatar</a></i>
</th>
<td>$2,923,710,708
</td>
<td>2009
</td>
<td><sup id="cite&#95;ref-avatar&#95;15-0" class="reference"><a href="#cite_note-avatar-15">[# 3]</a></sup>
</td></tr>
<tr>
<td>43<sup class="plainlinks nourlexpansion citation" id="ref&#95;Jurassic&#95;Park"><a href="#endnote_Jurassic_Park">JP</a></sup>
</td>
<td>7
</td>
<th scope="row"><span data-sort-value="Dark Knight Rises&#160;!"><i><a href="/wiki/The_Dark_Knight_Rises" title="The Dark Knight Rises">The Dark Knight Rises</a></i></span>
</th>
<td><sup class="plainlinks nourlexpansion citation" id="ref&#95;Dark&#95;Knight&#95;Rises"><a href="#endnote_Dark_Knight_Rises">DKR</a></sup>$1,081,169,825
</td>
<td data-sort-value="2012-07">2012
</td>
<td>
</td></tr>
<tr>
<td>48
</td>
<td>3
</td>
<th scope="row"><i><a href="/wiki/Pirates_of_the_Caribbean:_Dead_Man%27s_Chest" title="Pirates of the Caribbean: Dead Man&#39;s Chest">Pirates of the Caribbean: Dead Man&#39;s Chest</a></i>
</th>
<td>$1,066,185,783
</td>
<td data-sort-value="2006-07">2006
</td>
<td>
</td></tr>
</tbody></table>
<table class="wikitable"><caption>Highest-grossing films adjusted for inflation</caption><tbody><tr><td>1</td><td>x</td><th><a href="/wiki/Gone_with_the_Wind_(film)" title="Gone with the Wind (film)">Gone with the Wind</a></th><td>$4,000,000,000</td><td>1939</td></tr></tbody></table>
</div>`;

test('reads every film row of the highest-grossing table, and only that table', () => {
  assert.deepEqual(parseGrossingTable(HTML), [
    { rank: 2, title: 'Avatar', article: 'Avatar (2009 film)', year: 2009, usd: 2923710708 },
    { rank: 43, title: 'The Dark Knight Rises', article: 'The Dark Knight Rises', year: 2012, usd: 1081169825 },
    { rank: 48, title: "Pirates of the Caribbean: Dead Man's Chest", article: "Pirates of the Caribbean: Dead Man's Chest", year: 2006, usd: 1066185783 },
  ]);
});

test('refuses a page without the table, and a row it cannot read', () => {
  assert.throws(() => parseGrossingTable('<table><caption>Something else</caption></table>'), /No "Highest-grossing films" table/);
  const broken = HTML.replace('$2,923,710,708', 'unknown');
  assert.throws(() => parseGrossingTable(broken), /Unreadable row/);
});
