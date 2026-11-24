# LiveGross

A free website showing the box office collection of Indian and international films: live estimates for films in cinemas, day-wise collection, worldwide gross, budget, all-time rank, year and language charts, actor/director pages and the ₹100 / ₹500 / ₹1,000 crore clubs. In English, with the main pages also in Hindi (`/hi/`).

Everything is automatic and costs nothing:

| Part | Free service |
|---|---|
| Film list, box office, budget | Wikidata (open data) + English Wikipedia infoboxes |
| All-time worldwide chart | Wikipedia's "List of highest-grossing films" |
| Posters, photos of people | Wikipedia infoboxes, Wikimedia Commons |
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
npm test            # check the money and chart parsers
npm run fetch:worldwide  # re-read Wikipedia's all-time chart (also part of npm run fetch)
npm run icons       # redraw the app icons + share image after changing SITE_NAME or the logo (macOS + Chrome)
npm run deploy      # upload out/ to Cloudflare Pages by hand (needs `npx wrangler login` once)
```

## Put it online (one-time setup)

1. Create a free GitHub account and push this folder to a new **public** repository. Scheduled runs are free for public repos.
2. Create a free Cloudflare account. The workflow creates the Pages project (`livegross`) on its first run.
3. In Cloudflare, create an API token with the **Cloudflare Pages: Edit** permission and copy your Account ID.
4. In the GitHub repo, open **Settings → Secrets and variables → Actions** and add:
   - Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
   - Variables (all optional):
     - `SITE_URL`: your address, e.g. `https://yourdomain.com` (default `https://livegross.pages.dev`)
     - `SITE_NAME`: shown in the logo, titles and legal pages
     - `GA_ID`: Google Analytics 4 measurement ID (`G-XXXXXXX`). Without it, no analytics code is added.
     - `ADSENSE_CLIENT`, `ADSENSE_SLOT`: Google AdSense, see "Ads" below. Without them, no ad code is added.
     - `CONTACT_EMAIL`: shown on the contact and legal pages. Defaults to `contact@yourdomain.com` once `SITE_URL` is a custom domain.
     - `SITE_OWNER`: the person or business that runs the site, named on the about page and as the author of the guides. Without it they say "an independent project run from India" and "the LiveGross team" (with your `SITE_NAME`).
     - `CF_PROJECT`: Pages project name (default `livegross`)
     - `CONTACT_UA`: e.g. `LiveGross/1.0 (https://yourdomain.com)` so Wikipedia knows who is fetching
5. Open the **Actions** tab, choose **Update data and deploy** and press **Run workflow**. After that it runs by itself every day at 06:00 IST.

### When you add your own domain

- In Cloudflare Pages → your project → **Custom domains**, add the domain, then set `SITE_URL` to it.
- The next build writes a `_headers` rule that sends `X-Robots-Tag: noindex` for `*.pages.dev`, so Google only indexes your domain. (While `SITE_URL` is still a pages.dev address that rule is left out, otherwise the whole site would be hidden.)
- Turn on **Email Routing** for the domain in Cloudflare and forward `contact@yourdomain.com` to your Gmail.
- Add the site to Google Search Console and Bing Webmaster Tools and submit `https://yourdomain.com/sitemap.xml`.

## High-quality banners (your own images)

Wikipedia keeps film posters at about 280px wide, so for the films you want to feature (the latest releases),
drop your own images into `public/banners/`, named after the film's slug (the part of its address after `/movie/`):

| File | Size | Where it shows |
| --- | --- | --- |
| `<slug>.jpg` | wide, about 1920×1080 | Home page spotlight (sharp, full-bleed, replaces the poster card) and the film page's board |
| `<slug>-poster.jpg` | portrait, about 600×900 | Replaces the Wikipedia poster everywhere posters show at 330px or larger |

For example `public/banners/ramayana-part-1-2026.jpg` and `public/banners/ramayana-part-1-2026-poster.jpg`.
`.jpg`, `.png`, `.webp` and `.avif` all work; keep each file under about 400 KB (WebP at quality 80 is a good choice).
Replacing a file shows the new one at once (its modified time is part of the address). Restart `npm run dev` after
adding files; production builds pick them up automatically. Use only images you have the right to use, such as
official press or promotional stills released by the studio.

## IMDb ratings (off by default)

The site can show each film's IMDb rating (a yellow IMDb badge on cards, the home page spotlight and film pages),
read from IMDb's daily dataset by `scripts/fetch-ratings.mjs`. IMDb licenses that dataset for **personal and
non-commercial use only**, and a site that shows ads is commercial, so it is **off**: nothing is downloaded and no
rating is shown. Turn it on only with a licence that covers your use, by setting `IMDB_RATINGS=1` (a GitHub
Actions variable, or in the shell locally). Films with fewer than 100 votes never show a rating.

## Ads (Google AdSense)

The site is ready for AdSense but shows no ads until you turn them on. AdSense only approves sites on a domain you own, so add your custom domain first (see above).

Before applying, check what reviewers look for:

- **Trust pages**: about (who runs the site, how figures are checked), contact, privacy policy (with the ad-cookie disclosures Google requires), terms and disclaimer are all linked from every page's footer. Set `SITE_OWNER` and make sure the contact address works; `npm run build` prints an "AdSense readiness" warning when the domain, contact address or owner is missing.
- **Original content**: the guides in `src/content/guides.ts` (`/guides/`) are the site's own writing, alongside the data pages. Adding more guides over time helps; each is one object in that file, and the home page, sitemap and guide index pick it up automatically.
- **Indexing**: add the domain to Google Search Console, submit the sitemap, and wait until the main pages are indexed before requesting a review.

1. Sign up at [adsense.google.com](https://adsense.google.com/) and add your domain. Your publisher ID looks like `ca-pub-1234567890123456`.
2. Set it as the GitHub Actions variable `ADSENSE_CLIENT` and run the workflow. Every page then carries the AdSense tag and the `google-adsense-account` meta tag (for verification), `/ads.txt` is published, and the privacy policy and terms gain their advertising sections. Request a review in AdSense; approval can take a few days to a few weeks.
3. In AdSense, open **Privacy & messaging** and publish the **European regulations** message (Google's own consent banner for the EEA, UK and Switzerland; required for ads there), and the **US state regulations** message. The pages already set Google Consent Mode defaults: no ad or analytics cookies for visitors from those regions until they agree.
4. Choose how ads are placed:
   - **Auto ads** (simplest): turn them on for the site in AdSense. Google picks the places; nothing to set here.
   - **Fixed slots**: create a *Display ad* unit in AdSense and set its 10-digit ID as the variable `ADSENSE_SLOT`. Pages then get one slot after their content, the home page one after the recent releases and film pages one after the facts. Each slot is labelled "Advertisement", reserves its space so the page does not jump, and disappears when AdSense has nothing to fill it with. Error pages never get one.

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
- `sitemap.xml`, `robots.txt`, `_headers` (security headers, caching, pages.dev noindex), `manifest.webmanifest`, favicons and a 1200×630 share image; `ads.txt` once `ADSENSE_CLIENT` is set.
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

The all-time page (`/top/`, 500 places) and the home page's top 10 start with the top-50 table of Wikipedia's [List of highest-grossing films](https://en.wikipedia.org/wiki/List_of_highest-grossing_films), which editors keep current from the trade trackers. Every other film follows by the worldwide gross on its own Wikipedia article. The page says which is which, links the list and gives the time it was last edited. Film pages of films on the list show the list's figure and rank next to their own.

`scripts/fetch-worldwide-chart.mjs` (part of `npm run fetch`) checks the list's latest revision and, when it has changed, reads the table from the rendered page (the parse API's HTML, so totals computed with templates and footnote markers come out as plain figures; parser in `scripts/lib/wikipedia-chart.mjs`, tested in `scripts/wikipedia-chart.test.mjs`). Links to redirects are resolved, so rows match films by their article. Unreadable rows, a missing table or a request failure keep the last valid copy in `data/raw/`, or the bundled snapshot in `data/worldwide-lifetime.json`.

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
- **Posters as textures:** Wikimedia sends a CORS header with every image, so WebGL can read the posters. The stack still fetches each poster in CORS mode and, if a cached copy is refused, fetches it again past the cache.

## Posters and photos

Everything here is free and needs no key.

**Film posters** come from each film's English Wikipedia article: the image in its infobox, read through the free MediaWiki API (`scripts/fetch-posters.mjs`, cache `data/raw/posters.json`). Posters are copyrighted; Wikipedia shows them at low resolution to identify the film, and the site uses them the same way (small, next to the film's figures), as the footer and terms say; the terms also ask rights holders to use the contact page for removals. They are re-read monthly, and every 2 days for films released in the last 90 days. The home page banner is the featured film's poster, blurred. A film without a poster shows a title tile.

**India and overseas totals** (the Worldwide / Overseas / India net switch on film pages) come from the "Box office" section of each Indian film's Wikipedia article (`scripts/fetch-boxoffice.mjs`, parser `scripts/lib/boxoffice-text.mjs`, cache `data/raw/boxoffice.json`). Infoboxes only give the worldwide gross. The parser takes an amount only when the words around it name the market and the measure, and skips opening-day and weekend figures, single-language versions, milestones passed ("crossed ₹500 crore"), floors ("over ₹600 crore") and comparisons with other films. `src/lib/data.ts` then shows a figure only if it agrees with the worldwide gross. Day-by-day figures stay worldwide only: no free source reports daily India or overseas splits. About 190 Indian films have at least one figure; films released in the last 120 days are re-read every 6 hours, the rest monthly.

**Photos of actors and directors** come from Wikimedia Commons, through Wikidata (`scripts/fetch-people.mjs`, cache `data/raw/people.json`). Each film's own cast and director entries on Wikidata say exactly who is meant, so people who share a name are not mixed up. People with their own page are also looked up by name, and accepted only if the match is a person with a film occupation. Commons photos are freely licensed, and every one is credited with its photographer and licence: under the photo on person pages, and under "Photo credits" in a film's cast. People without a photo show their initials. A run only re-checks what is more than ~45 days old (3 days for films in cinemas); the first run reads the cast of every film and takes about 40 minutes.

TMDB and Box Office Mojo are deliberately not used: both require a paid licence for a site that earns money (TMDB counts ads as commercial use; IMDb's terms forbid reusing Box Office Mojo data).

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
src/components/client/       browser components: ₹/$ switch, live estimates, search, theme, chart, ad slot
src/components/client/motion/  GSAP animations (hero, scroll reveals, count-ups, bars)
src/components/client/three/   three.js 3D poster stack in the home hero (loaded on demand)
src/content/en.ts, hi.ts     English and Hindi text: UI, home guide, FAQ, about, contact, privacy, terms
src/lib/data.ts              loads data/movies.json once and builds the indexes (years, languages, people, clubs)
src/lib/format.ts, live.ts   money formatting and the live estimate model (also used by scripts/merge.mjs)
src/lib/worldwide-chart.ts   Wikipedia all-time chart snapshot (also used by scripts/fetch-worldwide-chart.mjs)
src/styles/site.css          all styles
public/                      icons, share image
scripts/fetch-wikidata.mjs   films, box office and budget statements from Wikidata
scripts/fetch-wikipedia.mjs  gross / budget / starring from Wikipedia infoboxes
scripts/fetch-history.mjs    day-by-day totals from Wikipedia edit history (films in cinemas)
scripts/fetch-lists.mjs      films on Wikipedia's highest-grossing lists (vandalism guard)
scripts/fetch-rates.mjs      exchange rates
scripts/fetch-posters.mjs    film posters from Wikipedia infoboxes (no key)
scripts/fetch-people.mjs     photos of actors and directors from Wikidata + Wikimedia Commons (no key)
scripts/fetch-boxoffice.mjs  India net / India gross / overseas totals from Wikipedia 'Box office' sections (no key)
scripts/fetch-worldwide-chart.mjs  all-time chart from Wikipedia's List of highest-grossing films
scripts/merge.mjs            picks one figure per film → data/movies.json
scripts/postbuild.mjs        error pages, removes RSC payload files, _headers, ads.txt, file-count check
scripts/serve.mjs            local preview of out/
scripts/make-icons.mjs       renders PNG icons, favicon.ico and og-image.png with Chrome
scripts/lib/wikitext.mjs     wikitext + money parser (tested in scripts/wikitext.test.mjs)
scripts/lib/wikipedia-chart.mjs  all-time chart table parser (tested in scripts/wikipedia-chart.test.mjs)
.github/workflows/update.yml daily update and deploy
```
