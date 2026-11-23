// Reads the "Highest-grossing films" table from Wikipedia's "List of highest-grossing films", as the
// rendered HTML the MediaWiki parse API returns. The rendered table is used rather than the wikitext
// because editors compute some totals with templates ({{formatnum:{{#expr:…}}}}) and add footnote
// markers to cells; in the HTML every cell is already a plain figure.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return n === 160 ? ' ' : String.fromCodePoint(n);
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** Cell text without footnote markers (<sup>…</sup>) or tags. */
const cellText = (html) => decodeEntities(html.replace(/<sup\b[\s\S]*?<\/sup>/gi, '').replace(/<[^>]+>/g, '')).trim();

/**
 * Rows of the first table whose caption starts with "Highest-grossing films", in table order:
 * { rank, title, article, year, usd }. `article` is the linked Wikipedia article (redirects included).
 */
export function parseGrossingTable(html) {
  const tables = html.split(/<table\b/i).slice(1);
  const table = tables.find((t) => /<caption>\s*Highest-grossing films\s*(?:<|$)/i.test(t.slice(0, t.indexOf('</caption>') + 1)));
  if (!table) throw new Error('No "Highest-grossing films" table on the page.');
  const body = table.slice(0, table.search(/<\/table>/i));

  const rows = [];
  for (const tr of body.split(/<tr\b[^>]*>/i).slice(1)) {
    const cells = [...tr.matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => m[2]);
    if (cells.length < 5 || !/<td\b/i.test(tr)) continue; // header row: only <th> cells
    const [rankCell, , titleCell, grossCell, yearCell] = cells;
    const link = titleCell.match(/<a\b[^>]*href="\/wiki\/[^"]+"[^>]*title="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const rank = parseInt(cellText(rankCell), 10);
    const usd = Number(cellText(grossCell).match(/\$\s*([\d,]+)/)?.[1].replace(/,/g, ''));
    const year = Number(cellText(yearCell).match(/\b(?:18|19|20)\d{2}\b/)?.[0]);
    if (!link || !Number.isFinite(rank) || !Number.isSafeInteger(usd) || !year) {
      throw new Error(`Unreadable row in the highest-grossing table: ${cellText(tr).replace(/\s+/g, ' ').slice(0, 120)}`);
    }
    rows.push({ rank, title: cellText(link[2]), article: decodeEntities(link[1]), year, usd });
  }
  return rows;
}
