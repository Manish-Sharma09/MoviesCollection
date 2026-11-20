# Collection Board

A free website showing the box office collection of Indian and international films: live estimates for films in cinemas, day-wise collection, worldwide gross, budget, all-time rank, year and language charts, actor/director pages and the ₹100 / ₹500 / ₹1,000 crore clubs. In English, with the main pages also in Hindi (`/hi/`).

Everything is automatic and costs nothing:

| Part | Free service |
|---|---|
| Film list, box office, budget | Wikidata (open data) + English Wikipedia infoboxes |
| Exchange rates | frankfurter.dev (European Central Bank) |
| Daily update | GitHub Actions (scheduled) |
| Hosting, email forwarding | Cloudflare Pages, Cloudflare Email Routing |

The site is built with [Next.js](https://nextjs.org/) (App Router, React, TypeScript) as a **static export**: `next build` renders every page to HTML once, and those files are uploaded. No database or server is needed, and the site is rebuilt every day.

## Run it on your computer

Needs Node.js 22.18 or newer (the data scripts import the shared TypeScript files in `src/lib/` directly).

```bash
npm install         # once
npm run fetch       # download everything (first run ~60–90 minutes, Wikipedia allows ~10 requests/minute)
npm run fetch:live  # quick refresh of films in cinemas only
npm run dev         # work on the site with hot reload at http://localhost:3000 (pages render on demand)
npm run build       # merge the data and build the whole site into out/
npm run build:site  # rebuild out/ only, when data/movies.json is already up to date
npm run fetch:art   # film posters (Wikipedia) and photos of people (Wikimedia Commons); free, no key
npm run preview     # serve out/ at http://localhost:4321, like Cloudflare Pages
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm test            # check the money parser
npm run icons       # redraw the app icons + share image after changing SITE_NAME or the logo (macOS + Chrome)
npm run deploy      # upload out/ to Cloudflare Pages by hand (needs `npx wrangler login` once)
```

## Put it online (one-time setup)

1. Create a free GitHub account and push this folder to a new **public** repository. Scheduled runs are free for public repos.
2. Create a free Cloudflare account. The workflow creates the Pages project (`collection-board`) on its first run.
3. In Cloudflare, create an API token with the **Cloudflare Pages: Edit** permission and copy your Account ID.
4. In the GitHub repo, open **Settings → Secrets and variables → Actions** and add:
   - Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
   - Optional secret `TMDB_READ_TOKEN`: not needed (posters come from Wikipedia); see "Posters and photos".
   - Variables (all optional):
     - `SITE_URL`: your address, e.g. `https://yourdomain.com` (default `https://collection-board.pages.dev`)
     - `SITE_NAME`: shown in the logo, titles and legal pages
     - `GA_ID`: Google Analytics 4 measurement ID (`G-XXXXXXX`). Without it, no analytics code is added.
     - `CONTACT_EMAIL`: shown on the contact and legal pages. Defaults to `contact@yourdomain.com` once `SITE_URL` is a custom domain.
     - `CF_PROJECT`: Pages project name (default `collection-board`)
     - `CONTACT_UA`: e.g. `CollectionBoard/1.0 (https://yourdomain.com)` so Wikipedia knows who is fetching
5. Open the **Actions** tab, choose **Update data and deploy** and press **Run workflow**. After that it runs by itself every day at 06:00 IST.

### When you add your own domain

- In Cloudflare Pages → your project → **Custom domains**, add the domain, then set `SITE_URL` to it.
- The next build writes a `_headers` rule that sends `X-Robots-Tag: noindex` for `*.pages.dev`, so Google only indexes your domain. (While `SITE_URL` is still a pages.dev address that rule is left out, otherwise the whole site would be hidden.)
- Turn on **Email Routing** for the domain in Cloudflare and forward `contact@yourdomain.com` to your Gmail.
- Add the site to Google Search Console and Bing Webmaster Tools and submit `https://yourdomain.com/sitemap.xml`.

## How the Next.js build works

- Every page is a Server Component rendered at build time from `data/movies.json`; dynamic routes (films, people, years, languages, clubs) list their pages with `generateStaticParams`.
- English pages use the root layout in `src/app/(en)/`, Hindi pages the one in `src/app/hi/` (`<html lang="hi-IN">`).
- Interactive parts are small Client Components in `src/components/client/`: the ₹/$ switch, live estimates, search and the light/dark theme. The live-estimate model and money formatting live once in `src/lib/` and are shared by the pages, the browser and `scripts/merge.mjs`.
- Links between pages are plain `<a>` tags, not `next/link`. Each click is a normal page load, so the per-page RSC payload files Next writes for client-side navigation are never requested. `scripts/postbuild.mjs` deletes them; with them the site would be ~68,000 files instead of ~13,600, and Cloudflare Pages allows 20,000. The post-build step fails the build if the count goes over.
- No web fonts: text uses the device's system font (SF Pro on Apple devices, Segoe UI on Windows, Roboto/Noto on Android, and their Devanagari faces for Hindi), so pages download no font files.
- The build ID is the git commit (`GITHUB_SHA`), so a scheduled rebuild leaves unchanged pages byte-identical and a deploy uploads only the pages whose figures changed.
- Error pages are built at `/error-404/`, `/hi/error-404/` and `/error-500/` (Next reserves `/404`) and moved into place by the post-build step.

## What the build makes

- A page for every film, actor/director (3+ films), year, language and club, plus the all-time and Indian charts.
- Hindi versions of the main pages under `/hi/`, linked with `hreflang` (en, hi, x-default) in each page and in the sitemap. Film and people pages are English only: translating them would add ~13,000 files, past Cloudflare Pages' 20,000-file limit.
- Home page guide text (~900 words) and a 14-question FAQ with `FAQPage` JSON-LD, in both languages. Club sizes, the top films and exchange rates in the text are filled in from the data on every build.
- About, contact, privacy policy and terms pages; 404 pages in both languages (Cloudflare serves `/hi/404.html` for missing `/hi/` pages) and a `500.html`.
- `sitemap.xml`, `robots.txt`, `_headers` (security headers, caching, pages.dev noindex), `manifest.webmanifest`, favicons and a 1200×630 share image.
- Structured data: `WebSite`, `FAQPage`, `Movie`, `BreadcrumbList` and `ItemList` (charts).

Text lives in `src/content/en.ts` and `src/content/hi.ts` (browser text in `src/content/client-text.ts`); styles in `src/styles/site.css`.

## Design

The interface follows Apple's design principles, from the `apple-design` skill in `.claude/skills/apple-design/` (installed with `npx skills add emilkowalski/skills --skill apple-design`):

- **Light and dark follow the device.** The header button overrides it (remembered in the browser), and the switch cross-fades instead of flashing. Colours are Apple's semantic system colours, defined once as tokens at the top of `site.css`.
- **System typography** with size-specific tracking (tight on large titles, near 0 for body text), tabular figures for money, and taller lines and no letter-spacing for Devanagari.
- **Translucent materials:** the sticky header and search popover blur the content scrolling under them; the header gains its edge shadow only once content is underneath.
- **Feedback on press:** buttons, cards, chips and list rows react on pointer-down (scale or highlight) and spring back. State changes use one critically damped spring curve (`--spring`), and nothing locks input while it moves.
- **Live figures:** the film page's live total rolls only the digits that change, and a ring next to "Next update in" counts down to the next 5-minute step.
- **Lists** are inset grouped (like Settings or Stocks), film facts are a hairline grid, and a film's ranks sit in an App Store-style info row.
- **Phones:** sections are a scrolling pill row; the magnifier turns that row into a search field with Cancel; recent releases are a horizontal shelf that snaps to each poster.
- **Accessibility settings are respected:** reduced motion (cross-fades instead of movement), reduced transparency (solid surfaces), increased contrast (stronger text and edges) and Windows high contrast.

## Worldwide lifetime chart

The all-time page and homepage display the latest valid Box Office Mojo top-200 snapshot available to the build, with its source timestamp. Matched film pages show the chart figure alongside the catalog figures.

For automatic updates, supply an HTTPS JSON feed backed by authorized Box Office Mojo data. Use the IMDb/Box Office Mojo licensed product or your existing licensed provider to prepare a feed with this shape:

```json
{"asOf":"2026-11-19T17:13:00-08:00","films":[["Example film",2026,100000000]]}
```

Include all 200 rows in published order, with one title, release year and integer worldwide USD gross per row. Use the source's timestamp, including its time zone. The single row above only illustrates the format.

Set the feed URL as the GitHub Actions secret `BOX_OFFICE_CHART_URL` and, for a bearer-authenticated feed, set `BOX_OFFICE_CHART_TOKEN`. The existing workflow checks the feed every three hours and on the daily update. For a local refresh, supply the same environment variables and run `npm run fetch:worldwide` before `npm run build`.

If the request fails, the response is invalid, or the source timestamp has not advanced, the site uses the last valid cached chart or the bundled snapshot in `data/worldwide-lifetime.json`.

## Animation

Motion uses [GSAP](https://gsap.com/) (free, including all its plugins), set up with the official GSAP skills in `.claude/skills/gsap-*` (installed with `npx skills add https://github.com/greensock/gsap-skills`). The code is in `src/components/client/motion/`:

- **Home hero** (`HeroMotion.tsx`): the headline's lines slide up out of their masks (SplitText, lines only, so Devanagari is never split into letters), then the intro, search, buttons and featured poster follow, while the backdrop settles from a slight zoom. Plays once on load.
- **While scrolling** (`MotionMain.tsx`, wraps `<main>`): anything marked `data-reveal` (film cards, club tiles, year tiles, language chips, cast photos, the collection chart, the day-wise table, Live rows, the guide and FAQ) fades up a few at a time as it comes into view (ScrollTrigger.batch, once). Numbers marked `data-countup` (the crore-club tiles) count up. Ranking bars grow from the left (first 40 rows of each list).
- **Collection chart** (`CollectionChart.tsx`): the total line draws itself in (DrawSVG), then its area and the live-estimate segment fade in; per-day columns grow up from the baseline. Replays when switching Total / Per day.

Rules it keeps: only transforms and opacity are animated; nothing animates when the device is set to reduce motion (`gsap.matchMedia`); every animation cleans up its inline styles when it finishes (so hover and press states keep working); and content is hidden before it animates only while the `motion` class is set by the inline head script, which removes it after 4 seconds if the animations have not started, so nothing can stay hidden. The page's largest image (the home backdrop) is never hidden, so animations do not delay the first paint.

### 3D poster stack (three.js)

The home hero's featured poster becomes a 3D stack of the films in cinemas, drawn with [three.js](https://threejs.org/) (free, MIT), set up following the `threejs-skills` skill in `.claude/skills/threejs-skills/` (installed with `npx skills add henryalouf/ruflow --skill threejs-skills --agent claude-code`). The code is in `src/components/client/three/`:

- **`HeroFeature.tsx`** renders the same poster and caption as before, so the built HTML, phones, and everyone else who doesn't get the 3D version see exactly what they saw before. On screens wider than 760 px, with motion allowed, WebGL 2, and no data saver, it waits until the page has loaded and the hero's entrance has finished. Then it loads three.js (a separate file, never part of the first page load) and swaps in the stack. The caption, link and ₹/$ figure follow the film at the front.
- **`poster-stack.ts`** draws the front card exactly over the page's poster, which is hidden only once that card is there, so the swap is invisible. The next films fan out behind it to the left, receding in depth. Every 5 seconds the front card swings off to the right and the next one comes forward. Drag (mouse or touch) to scrub, click a card behind to bring it forward, or click the front card to open the film. Hovering tilts the front card toward the pointer under a soft highlight, like a focused poster on Apple TV.
- **Controls** beside the figure: previous, pause/play, next. Automatic moves also wait while the pointer or keyboard focus is on the stack. Screen readers hear the new film's title when a visitor changes it (not on automatic moves).
- **Cheap to run:** unlit planes with one small shader (rounded corners, highlight, 1 px edge) and a soft shadow plane per card, at most 2× pixel density. Frames are drawn only while something moves, and none while the hero is scrolled away or the tab is hidden. If the WebGL context is lost or the window gets narrower than 761 px, the page's own poster comes back, showing the current film.
- **Posters as textures:** TMDB sends its CORS header only to requests that carry an `Origin`, and caches without varying on it, so a copy cached by the page's `<img>` fails WebGL's CORS check. The stack fetches each poster in CORS mode and, if the cached copy is refused, fetches it again past the cache. Wikimedia always sends the header.

## Posters and photos

Everything here is free and needs no key.

**Film posters** come from each film's English Wikipedia article: the image in its infobox, read through the free MediaWiki API (`scripts/fetch-posters.mjs`, cache `data/raw/posters.json`). Posters are copyrighted; Wikipedia shows them at low resolution to identify the film, and the site uses them the same way (small, next to the film's figures), as the footer says. They are re-read monthly, and every 2 days for films released in the last 90 days. The 67 posters and backdrops bundled in `data/featured-art.json` (from TMDB) are used where they exist, and the home page banner uses their backdrops. A film with neither shows a title tile.

**Photos of actors and directors** come from Wikimedia Commons, through Wikidata (`scripts/fetch-people.mjs`, cache `data/raw/people.json`). Each film's own cast and director entries on Wikidata say exactly who is meant, so people who share a name are not mixed up. People with their own page are also looked up by name, and accepted only if the match is a person with a film occupation. Commons photos are freely licensed, and every one is credited with its photographer and licence: under the photo on person pages, and under "Photo credits" in a film's cast. People without a photo show their initials. A run only re-checks what is more than ~45 days old (3 days for films in cinemas); the first run reads the cast of every film and takes about 40 minutes.

*Optional:* `scripts/fetch-artwork.mjs` can also fetch TMDB posters, backdrops and cast photos if a `TMDB_READ_TOKEN` is set (in `.env.local` or as a GitHub secret). TMDB's API is free only for non-commercial sites, so it is off by default.

## Live collection

**The Live page** (`/live/`, Hindi `/hi/live/`, first item in the menu) shows every film in cinemas at once: films released in the last 60 days, plus older ones that still had a reported figure in the last two weeks. At the top is what all of them have collected today, counted up live. Below, each film shows its running total, today's takings and a small chart of its daily collection over the latest reports. A report that covers several days is drawn as the average per day, not one tall bar, and each bar has a tooltip with the exact figure. Films with a running estimate are listed first; the rest show their last reported total. While the page is open it re-reads `/live.json` every 5 minutes (and when you come back to the tab), so new figures from the 3-hourly update appear without a reload.

Films released in the last 90 days also get two things on their own pages:

- **Day by day**: the film's Wikipedia edit history is read to get the reported total at the end of each day (India time). Days without a new report are skipped.
- **Collection graph** (above the day-wise table): the worldwide total day by day, or what each day added (a Total / Per day switch; one measure at a time, never two scales on one chart). For a film in cinemas the line continues, dashed, to the live estimate now, and today's column shows the estimate so far, lighter. Hover, tap or use the arrow keys to read any day; the chart follows the ₹ / $ switch.
- **Live estimate**: between reports, the browser (`src/components/client/Live.tsx`, model in `src/lib/live.ts`) estimates the running total from the last three days' earnings. It adjusts for the weekday, eases off about 6% a day, and spreads each day across show times. It moves in 5-minute steps, is marked with a red dot and labelled as an estimate, and stops if no report has arrived for four days.

On GitHub, `npm run fetch:live` runs every 3 hours and only re-reads films in cinemas. The full update runs once a day.

## How the numbers are chosen

- Worldwide gross comes from the film's Wikipedia infobox, and from Wikidata only when Wikipedia has none. Wikidata's figures for Indian films are often outdated, in dollars, or mistyped.
- Title, country and language also come from Wikipedia first, because Wikidata items are sometimes vandalised.
- **Vandalism guard**: an Indian film claiming ₹500 crore or more, or any film claiming $1.2 billion or more, must be linked from Wikipedia's highest-grossing list pages (`scripts/fetch-lists.mjs`). If not, the figure is rejected (Wikidata's is used if it passes) and the build log lists it. Co-productions that fail only the Indian check (Kung Fu Yoga, Gandhi) are ranked with foreign films instead. Films released in the last 120 days are trusted, because the lists lag behind new hits.
- Ranges such as "₹1,642–1,800 crore" are ranked by the lower figure and shown as a range on the film page.
- Other currencies are converted at the latest rate and are not adjusted for inflation.

## Project layout

```
src/app/(en)/                English pages and their root layout (/, /top/, /movie/[slug]/, …)
src/app/hi/                  Hindi pages and their root layout (/hi/, /hi/top/, …)
src/app/sitemap.ts, robots.ts, manifest.ts, search.json/, live.json/   generated files
src/views/                   the pages themselves, shared by both languages (home, live, charts, film, site-pages)
src/components/              header/footer (PageShell), document (SiteDocument), lists, posters, JSON-LD
src/components/client/       browser components: ₹/$ switch, live estimates, search, theme, chart
src/components/client/motion/  GSAP animations (hero, scroll reveals, count-ups, bars)
src/components/client/three/   three.js 3D poster stack in the home hero (loaded on demand)
src/content/en.ts, hi.ts     English and Hindi text: UI, home guide, FAQ, about, contact, privacy, terms
src/lib/data.ts              loads data/movies.json once and builds the indexes (years, languages, people, clubs)
src/lib/format.ts, live.ts   money formatting and the live estimate model (also used by scripts/merge.mjs)
src/lib/worldwide-chart.ts   Box Office Mojo top-200 snapshot (also used by scripts/fetch-worldwide-chart.mjs)
src/styles/site.css          all styles
public/                      icons, share image, TMDB logo
scripts/fetch-wikidata.mjs   films, box office and budget statements from Wikidata
scripts/fetch-wikipedia.mjs  gross / budget / starring from Wikipedia infoboxes
scripts/fetch-history.mjs    day-by-day totals from Wikipedia edit history (films in cinemas)
scripts/fetch-lists.mjs      films on Wikipedia's highest-grossing lists (vandalism guard)
scripts/fetch-rates.mjs      exchange rates
scripts/fetch-posters.mjs    film posters from Wikipedia infoboxes (no key)
scripts/fetch-people.mjs     photos of actors and directors from Wikidata + Wikimedia Commons (no key)
scripts/fetch-artwork.mjs    optional TMDB posters, backdrops and cast photos (only with TMDB_READ_TOKEN)
scripts/merge.mjs            picks one figure per film → data/movies.json
scripts/postbuild.mjs        error pages, removes RSC payload files, _headers, file-count check
scripts/serve.mjs            local preview of out/
scripts/make-icons.mjs       renders PNG icons, favicon.ico and og-image.png with Chrome
scripts/lib/wikitext.mjs     wikitext + money parser (tested in scripts/wikitext.test.mjs)
.github/workflows/update.yml daily update and deploy
```
