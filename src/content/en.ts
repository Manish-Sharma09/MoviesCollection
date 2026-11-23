// English text for the site. Facts (film counts, top films, club sizes) come from `s`, which
// src/lib/data.ts computes from the data on every build, so the copy never goes out of date.
import { formatINR, formatUSD, formatCount, formatDate, escapeHtml as esc, joinNames } from '@/lib/format';
import type { Money } from '@/lib/types';
import type { Content } from './types';

const PRIVACY_DATE = '23 November 2026';
const TERMS_DATE = '23 November 2026';
const DISCLAIMER_DATE = '23 November 2026';
// Film links go to the English film pages (they are not translated).
const film = (f: { slug?: string; title: string }) => (f.slug ? `<a href="/movie/${f.slug}/">${esc(f.title)}</a>` : esc(f.title));
const inr = (f: { gross: Money }) => formatINR(f.gross.inr);
const usd = (f: { gross: Money }) => formatUSD(f.gross.usd);

const club: Content['club'] = {
  '1000-crore': { label: '₹1,000 crore club', note: 'Indian films that grossed ₹1,000 crore or more worldwide.' },
  '500-crore': { label: '₹500 crore club', note: 'Indian films that grossed ₹500 crore or more worldwide.' },
  '100-crore': { label: '₹100 crore club', note: 'Indian films that grossed ₹100 crore or more worldwide.' },
  '1-billion-dollar': { label: '$1 billion club', note: 'Films from any country that grossed US$1 billion or more worldwide.' },
};

const content: Content = {
  htmlLang: 'en-IN',
  hreflang: 'en',
  ogLocale: 'en_IN',

  ui: {
    langName: 'English',
    switchTitle: 'Read this page in English',
    skip: 'Skip to content',
    navLabel: 'Main',
    nav: { live: 'Live', liveLong: 'Live box office', top: 'All-time', topLong: 'All-time chart', india: 'Indian films', years: 'Years', yearsLong: 'Box office by year', guides: 'Guides', about: 'About' },
    home: 'Home',
    breadcrumb: 'Breadcrumb',
    searchLabel: 'Search films and people',
    searchPlaceholder: 'Search films and people',
    searchPlaceholderBig: 'Search a film, actor or director',
    currencyGroup: 'Show amounts in',
    inRupees: 'Show amounts in rupees',
    inDollars: 'Show amounts in US dollars',
    lightMode: 'Light mode',
    ogImageAlt: (name) => `${name}: live and all-time box office collection`,
    footerAbout: 'Box office collection of Indian and international films, updated automatically every day from public sources.',
    footerCharts: 'Charts',
    footerSite: 'Site',
    footerLanguage: 'Language',
    aboutUs: 'About us',
    contactUs: 'Contact us',
    privacy: 'Privacy policy',
    terms: 'Terms and conditions',
    disclaimer: 'Disclaimer',
    guidesTitle: 'Box office guides',
    guidesNote: 'Plain-English explainers on how box office numbers work, written by our team.',
    allGuides: 'All guides',
    footerNote: (rate, date) =>
      `Figures come from Wikipedia and Wikidata. Other currencies are converted at ₹${rate} per US$ (rate of ${date}) and are not adjusted for inflation. Live figures are estimates between reports.`,
    copyright: (year, name) => `© ${year} ${name}. Not affiliated with any film studio, distributor or ticketing platform.`,
    imagesNote: 'Film posters come from Wikipedia and are shown small, only to identify the films. Photos of people are from Wikimedia Commons, credited with their photographer and licence.',
    adLabel: 'Advertisement',

    boardTitle: 'In cinemas now',
    boardNote: 'Films released in the past 60 days, ranked by reported collection.',
    boardFallback: (y) => `Biggest films of ${y}`,
    boardFallbackNote: 'No new releases with reported figures in the last 60 days.',
    day: (n) => `Day ${n}`,
    clubsTitle: 'The crore clubs',
    clubsNote: 'Indian films grouped by what they earned worldwide, next to the films that crossed a billion dollars.',
    clubCount: (label) => `films in the ${label}`,
    topIndia: 'Biggest Indian films',
    topIndiaNote: 'Worldwide gross, all languages.',
    allIndian: 'All Indian films by collection',
    topWorld: 'Biggest films worldwide',
    topWorldNote: 'Every country and language, not adjusted for inflation.',
    top500: 'View the all-time chart',
    chartSource: 'Wikipedia’s list of highest-grossing films',
    byYear: "Each year's biggest film",
    everyYear: 'Every year',
    byLanguage: 'Browse by language',
    explore: 'Explore by year, language and guides',
    menu: { open: 'Open menu', close: 'Close menu', title: 'Menu', settings: 'Settings' },
    card: {
      released: (d) => `Released ${d}`,
      budget: 'Reported budget',
      worldwide: 'Worldwide gross',
      indiaNet: 'India net',
      indiaGross: 'India gross',
      overseas: 'Overseas',
      northAmerica: 'North America',
      rankToday: (n) => `No. ${n} today`,
      indian: 'Indian',
      international: 'International',
      votes: (n) => `${n} IMDb votes`,
    },
    faqTitle: 'Frequently asked questions',
    filmsCount: (n) => `${formatCount(n)} films`,
    indianFilms: 'Indian films',
    allFilms: 'All films',
    adjustedLink: 'Adjusted for inflation',
    reportedLink: 'Reported figures',
    reportedThen: 'reported',
    compareFilms: 'Compare films',
    compareTitle: 'Compare any two films',
    compareNote: 'Gross, budget, opening days and today’s money, side by side, for any two films from any year or language.',
    compareOpen: 'Pick your own',
    raceTitle: (y) => `${y} box office race by language`,
    raceNote: 'Worldwide gross of this year’s Indian releases, by each film’s original language. Dubbed versions count towards the original.',
    raceTop: 'Top',
  },

  club,

  hero: () => ({
    kicker: 'Box office tracker',
    h1Html: 'Box office<br><em>collections</em>',
    intro: 'Track recent releases, worldwide grosses and all-time records for Indian and international films.',
    browse: 'Recent releases',
    live: 'Live collection',
    seeAllLive: 'All films in cinemas',
    updated: 'Sources checked',
    featured: 'Featured film',
    stack: { group: 'Featured films', previous: 'Previous film', next: 'Next film', pause: 'Pause', play: 'Play' },
    reported: 'Reported collection',
    estimate: 'Live estimate',
    chart: 'chart',
    filmsTracked: 'films tracked',
  }),

  worldwideNoteHtml: (count, asOf, link) =>
    `The top ${count} are from ${link}, last edited ${asOf} IST; the rest are ranked by the worldwide gross on each film’s own Wikipedia article. Not adjusted for inflation.`,

  home: (s) => ({
    title: `Box Office Collection Today: Live, Day-wise & Worldwide | ${s.site}`,
    description: `Live box office collection today for films in cinemas, with day-wise figures, worldwide gross, budget and all-time rank for ${formatCount(s.films)} Bollywood, South Indian and Hollywood films.`,
    h1: 'Box office collection, today and <span class="nowrap">all-time</span>',
    intro: `Live totals for films in cinemas, and the worldwide gross, budget and rank of ${formatCount(s.films)} Indian and international films.`,
  }),

  article: (s) => {
    const c100 = s.clubs['100-crore'].length;
    const c500 = s.clubs['500-crore'].length;
    const c1000 = s.clubs['1000-crore'].length;
    const c1b = s.clubs['1-billion-dollar'].length;
    return `<h2 id="guide">Box office collection, tracked every day</h2>
<p>${esc(s.site)} is a free box office collection tracker for films from India and the rest of the world. Every film has its own page with its worldwide box office collection, its budget where one has been reported, where it ranks among all films ever released, and how it compares with other films from the same year and language. There are ${formatCount(s.films)} films on the site today, from Hindi classics to this week's Telugu, Tamil, Malayalam and Hollywood releases, and the list grows by itself as new films get reported figures.</p>

<h3>Live box office collection for films in cinemas</h3>
<p>While a film is still running, one total is not enough. You want to know how it did yesterday, how the weekend went and where it stands right now. For every film released in the last 90 days, ${esc(s.site)} builds a day-wise box office collection table from the totals reported each day, so you can see how much every day added. Between two reports the site shows a live estimate of the box office collection today. It starts from the last reported worldwide figure and adds an estimate based on the past three days, the day of the week and the time of the shows. The live figure is always marked as an estimate with a red dot, and it goes back to the real number as soon as a new figure is reported.</p>

<h3>Bollywood and South Indian box office collection</h3>
<p>Indian films are shown in rupees, in crore and lakh, the way trade reports write them. You can read the Bollywood box office collection of Hindi films next to Telugu, Tamil, Kannada, Malayalam, Marathi, Bengali and Punjabi releases, or open a language page to see every film in that language ranked by worldwide gross. The <a href="/india/">Indian films chart</a> ranks all ${formatCount(s.indian)} Indian films on the site, so a South Indian blockbuster and a Hindi hit can be compared directly.</p>

<h3>Worldwide box office collection and all-time charts</h3>
<p>Films from outside India are shown in US dollars. The <a href="/top/">all-time chart</a> lists the highest-grossing films of all time worldwide, and every year from ${s.firstYear} onwards has its own page with that year's biggest releases. Use the ₹ and $ switch at the top of any page to see every amount in rupees or in dollars; the site remembers your choice. Amounts are converted at the latest exchange rate (₹${s.rate} per US dollar) and are not adjusted for inflation, so older films look smaller than they were in their day.</p>

<h3>The 100 crore, 500 crore and 1,000 crore clubs</h3>
<p>Indian trade talk revolves around clubs. Crossing ₹100 crore worldwide makes a film a hit for most budgets, ₹500 crore marks a blockbuster, and ₹1,000 crore is territory only a handful of films have reached. The club lists update themselves: right now ${formatCount(c100)} Indian films are in the <a href="/club/100-crore/">100 crore club</a>, ${formatCount(c500)} in the <a href="/club/500-crore/">500 crore club</a> and ${formatCount(c1000)} in the <a href="/club/1000-crore/">1,000 crore club</a>. The <a href="/club/1-billion-dollar/">$1 billion club</a> does the same for every country; ${formatCount(c1b)} films have crossed that mark.</p>

<h3>Where the numbers come from</h3>
<p>Figures are read automatically from public sources: the infobox on each film's English Wikipedia article, where editors cite trade analysts, producers and box office trackers, and Wikidata, the open database behind Wikipedia. When a film has no worldwide figure on Wikipedia, the Wikidata figure is used. Every film page links to its sources so you can check a number yourself. Nothing is typed in by hand, which is how the site stays free and keeps updating around the clock.</p>

<h3>Gross, net and share: reading a box office report</h3>
<p>Box office numbers are reported in more than one way, which is why two websites can show different figures for the same film. Gross collection is the total value of the tickets sold. Net collection is the gross minus GST and other taxes, and is the figure most often quoted for a film's business within India. Distributor share is what reaches the distributor after cinemas keep their part. ${esc(s.site)} shows the worldwide gross collection unless a page says otherwise, because it is the one figure that can be compared across countries and languages.</p>

<h3>How to use ${esc(s.site)}</h3>
<ul>
<li>Type any film, actor or director into the search box. Results appear as you type.</li>
<li>Open a film page to see its worldwide gross, budget, all-time rank, day-wise collection and the biggest films of the same year.</li>
<li>Open an actor or director page to see all their films ranked by collection, with a career total.</li>
<li>Browse by <a href="/years/">year</a> or by language to see what topped the box office in any year since ${s.firstYear}.</li>
<li>Switch between rupees and dollars, and between English and <a href="/hi/">Hindi</a>, at the top of the page.</li>
</ul>

<h3>Updated automatically, free for everyone</h3>
<p>The whole site is rebuilt every day, and films in cinemas are refreshed every three hours. There is no sign-up, no paywall and no app to install, and it works on any phone, tablet or computer. If a number looks wrong, the fastest fix is to correct the film's Wikipedia article with a reliable source; the change shows up here after the next update.</p>`;
  },

  faq: (s) => {
    const ti = s.topIndian;
    const tw = s.topWorld;
    const big = s.clubs['1000-crore'];
    return [
      {
        q: 'What is box office collection?',
        a: '<p>Box office collection is the money a film earns from cinema ticket sales. It is usually reported as a running total from release day: the opening day, the first weekend, the first week and the lifetime total. Worldwide collection adds up every country where the film was released.</p>',
      },
      ti && {
        q: 'Which is the highest-grossing Indian film of all time?',
        a: `<p>${film(ti)}${ti.year ? ` (${ti.year})` : ''} is the highest-grossing Indian film on ${esc(s.site)}, with ${inr(ti)} worldwide. See the full list of the <a href="/india/">biggest Indian films</a>, ranked by worldwide gross in every language.</p>`,
      },
      tw && {
        q: 'Which film has the highest box office collection worldwide?',
        a: `<p>${film(tw)}${tw.year ? ` (${tw.year})` : ''} has the highest worldwide box office collection, ${usd(tw)}. The <a href="/top/">all-time chart</a> lists the top ${formatCount(s.worldwideCount)} films. Figures are not adjusted for inflation.</p>`,
      },
      {
        q: 'How is box office collection calculated?',
        a: '<p>Cinemas report ticket sales to distributors, and trade analysts and producers publish the totals. The gross collection is the number of tickets sold multiplied by their prices. Totals from different countries are added up for the worldwide figure, converted to one currency at the exchange rate of the day.</p>',
      },
      {
        q: 'What is the difference between net and gross collection?',
        a: '<p>Gross collection is the full value of the tickets sold. Net collection is what remains after GST and other taxes are taken out, and is the figure most often quoted for a film’s business within India. Gross is always higher than net. This site shows worldwide gross unless a page says otherwise.</p>',
      },
      {
        q: 'Is the live box office collection real time?',
        a: '<p>No one publishes ticket sales minute by minute, so the live figure is an estimate. It starts from the last reported total and adds an estimate based on the last three days, the day of the week and show times. It is marked with a red dot and resets to the reported figure whenever a new one comes in.</p>',
      },
      {
        q: 'How often are box office collections updated?',
        a: '<p>The whole site is rebuilt every day. Films released in the last 90 days are refreshed every three hours, and the live estimate on their pages moves every few minutes between reports.</p>',
      },
      {
        q: 'How can I see the day-wise box office collection of a film?',
        a: '<p>Search for the film and open its page. For films released in the last 90 days there is a day-wise table with the total reported at the end of each day and how much that day added.</p>',
      },
      {
        q: 'What is the 100 crore club?',
        a: `<p>The 100 crore club is the list of Indian films that grossed ₹100 crore or more. ${formatCount(s.clubs['100-crore'].length)} Indian films are in it on this site, by worldwide gross. See the <a href="/club/100-crore/">full 100 crore club list</a>.</p>`,
      },
      {
        q: 'Which films are in the 1000 crore club?',
        a: big.length
          ? `<p>${formatCount(big.length)} Indian films have grossed ₹1,000 crore or more worldwide, including ${joinNames(big.slice(0, 4).map(film))}. See the <a href="/club/1000-crore/">full 1000 crore club list</a>.</p>`
          : '<p>No Indian film on the site has crossed ₹1,000 crore yet.</p>',
      },
      {
        q: 'Why do different websites show different box office numbers?',
        a: '<p>Sites mix net and gross figures, India-only and worldwide totals, and estimates from different trade sources. Exchange rates also change. This site uses the worldwide gross cited on Wikipedia, so its figures can differ from a site that quotes India net collection.</p>',
      },
      {
        q: 'Are box office figures adjusted for inflation?',
        a: `<p>No. Figures are the amounts reported at the time, converted at today’s rate of ₹${s.rate} per US dollar. Older films earned their totals with much cheaper tickets, so they look smaller next to new releases.</p>`,
      },
      {
        q: `Where does ${esc(s.site)} get its figures?`,
        a: '<p>From the infobox on each film’s English Wikipedia article and from Wikidata. Both are public and cite trade sources. Every film page links to its sources. Read more on the <a href="/about/">about page</a>.</p>',
      },
      {
        q: `Is ${esc(s.site)} free to use?`,
        a: '<p>Yes. There is no sign-up, no subscription and no app. Every page works on phones and computers.</p>',
      },
    ].filter((item) => item !== undefined);
  },

  pages: {
    live: (s, n) => ({
      h1: 'Live box office collection',
      title: 'Live box office collection today: every film in cinemas',
      description: `Live box office collection today for the ${formatCount(n)} films in cinemas: running worldwide totals that update every 5 minutes, today's collection and each film's recent daily trend.`,
      intro: 'Every film in cinemas now, with its worldwide total and what it has collected today. Between reported figures the totals move every 5 minutes.',
      note: `How it works: each total is the latest figure reported on Wikipedia, plus an estimate for the time since, based on the last three days, the day of the week and show times. A film with no new report in four days shows its last reported figure. New reports are read every three hours, and this page picks them up while it is open. <a href="/guides/live-box-office-estimate/">How the live estimate works</a>.`,
    }),
    top: () => ({
      h1: 'Biggest films of all time',
      title: 'Highest-grossing films of all time worldwide',
      description: 'The highest-grossing films of all time at the worldwide box office, ranked from Wikipedia’s list of highest-grossing films and each film’s own figures.',
    }),
    india: (s) => ({
      h1: 'Biggest Indian films',
      title: 'Highest-grossing Indian films of all time',
      description: 'Highest-grossing Indian films of all time by worldwide box office collection: Bollywood, Telugu, Tamil, Malayalam, Kannada and more.',
      intro: `The highest-grossing Indian films worldwide, in every language. ${formatCount(s.indian)} films tracked.`,
    }),
    topAdjusted: (s, y) => ({
      h1: 'Biggest films of all time, adjusted for inflation',
      title: `Highest-grossing films of all time adjusted for inflation (${y} prices)`,
      description: `The highest-grossing films of all time adjusted for inflation: each film’s worldwide gross in ${y} prices, worked out from consumer prices since its release year.`,
      intro: `Each film’s worldwide gross raised to ${y} prices with the consumer price index of the country whose currency it was reported in (World Bank figures, from 1960), then converted at ₹${s.rate} per US$. Totals that include later re-releases are raised from the first release year, so they come out high. Films from before 1960 are not included. Estimates, not official figures: <a href="/guides/inflation-and-all-time-records/">why adjust for inflation</a>.`,
    }),
    indiaAdjusted: (s, y) => ({
      h1: 'Biggest Indian films, adjusted for inflation',
      title: `Highest-grossing Indian films adjusted for inflation (${y} prices)`,
      description: `Indian films ranked by worldwide box office collection in ${y} prices: old classics and new hits compared fairly, using India’s consumer price index.`,
      intro: `Each film’s worldwide gross raised to ${y} prices with India’s consumer price index (World Bank). Older classics earned their money at a fraction of today’s ticket prices; this list shows what those totals are worth now. Totals that include re-releases or ticket sales abroad in other currencies are raised from the first release year, so treat them as rough. Films from before 1960 are not included. <a href="/guides/inflation-and-all-time-records/">More on inflation and records</a>.`,
    }),
    club: (meta, n) => ({
      title: `${meta.label}: all ${formatCount(n)} films`,
      description: `${meta.note} Full list of ${formatCount(n)} films ranked by box office collection.`,
      intro: `${meta.note} ${formatCount(n)} films so far.`,
    }),
    explore: (s) => ({
      h1: 'Explore box office collection',
      title: 'Explore box office by year, language and guides',
      description: `Browse ${formatCount(s.films)} films by year and language, read plain-English box office guides, and find answers to common questions about box office collection.`,
      intro: 'Each year\'s biggest film, every language we track, our box office guides and answers to the questions we get asked most.',
    }),
    years: () => ({
      h1: 'Box office by year',
      title: 'Box office collection by year',
      description: 'The highest-grossing film of every year at the worldwide box office.',
      intro: 'The biggest film of every year we have figures for.',
    }),
    year: (y, n, ind) => ({
      h1: `Biggest films of ${y}`,
      title: `Box office collection ${y}: biggest films of ${y}`,
      description: `The highest-grossing films of ${y} worldwide${ind ? ` and the biggest Indian films of ${y}` : ''}, ranked by box office collection.`,
      intro: `${formatCount(n)} films from ${y} with box office figures${ind ? `, ${formatCount(ind)} of them Indian` : ''}.`,
    }),
    language: (name, n) => ({
      h1: `Biggest ${name} films`,
      title: `Highest-grossing ${name} films of all time`,
      description: `All-time highest-grossing ${name} films by worldwide box office collection.`,
      intro: `${formatCount(n)} ${esc(name)} films ranked by worldwide gross.`,
    }),

    about: (s) => ({
      h1: 'About us',
      title: 'About us and how the numbers work',
      description: `Who runs ${s.site}, where its box office figures come from, how often they update and how live estimates work.`,
      lead: `${esc(s.site)} is an independent, free website that tracks the box office collection of Indian and international films.`,
      body: `<h2>Why this site exists</h2>
<p>Box office numbers are scattered across trade tweets, news articles and forums, and they rarely agree. ${esc(s.site)} puts the figures for ${formatCount(s.films)} films in one place, ranks them the same way, and keeps them up to date without anyone having to type them in. It is made by film fans, for film fans.</p>
<p>The site is not affiliated with any film studio, producer, distributor, ticketing platform or trade publication, and nobody pays to have a film listed or ranked.</p>

<h2>Who runs it</h2>
<p>${s.owner ? `${esc(s.site)} is an independent project run by ${esc(s.owner)} from India.` : `${esc(s.site)} is an independent project run from India.`} ${s.ads ? 'It is paid for by the ads shown on its pages, which is why it can stay free with no sign-up or paywall.' : 'It is free to use, with no sign-up or paywall.'} Advertisers have no say in which films are listed or how they are ranked.</p>
<p>Besides the charts, we write <a href="/guides/">guides</a> that explain how the box office works: what gross, net and share mean, why sites disagree, how to read a day-wise chart, and how our live estimate is calculated.</p>

<h2>Where the figures come from</h2>
<p>Every figure is read automatically from two free, public sources: the infobox on each film's English Wikipedia article, and Wikidata. Wikipedia editors follow trade reports and producers' announcements, so a film's number changes as new reports come in. When the two sources disagree, the site uses the one with the clearer worldwide figure. Every film page links to its sources so you can check.</p>

<h2>How the figures are checked</h2>
<p>Open sources can be vandalised, so every update runs a few checks before a number reaches the site:</p>
<ul>
<li>A figure that would put an Indian film above ₹500 crore, or any film above US$1 billion, is accepted only if the film also appears on Wikipedia’s lists of highest-grossing films, which are closely watched. Films released in the last four months are exempt, because those lists take time to catch up with new hits.</li>
<li>Day-wise totals use the figure that stood at the end of each day. A figure higher than the film’s current total is ignored (it was almost always vandalism that was later undone), and a total never goes down from one day to the next.</li>
<li>The all-time chart takes its top places from Wikipedia’s list of highest-grossing films rather than from individual articles, and leaves out a film whose own article claims more than the list allows.</li>
</ul>
<p>None of this makes the figures official. They are the best publicly reported numbers, and they are labelled as such. The <a href="/disclaimer/">disclaimer</a> explains the limits.</p>

<h2>What “worldwide gross” means</h2>
<p>It is the total ticket sales across all countries, before the cinema's share, as reported. Indian films are shown in rupees and other films in US dollars by default; use the ₹ and $ buttons at the top to switch.</p>

<h2>Live estimates</h2>
<p>For films in cinemas, the site reads each film's Wikipedia history to get the total at the end of every day, which gives the day-wise table. Between reports it estimates the running total: it takes the average of the last three days, adjusts for the day of the week (weekends earn more), lowers it slightly each day, and spreads it across the day following show times. The estimate moves in 5-minute steps and is marked with a red dot. When a new figure is reported, the estimate starts again from it, and after four days without a report the site stops estimating.</p>

<h2>Conversions and inflation</h2>
<p>Amounts are converted at the latest exchange rate (₹${s.rate} per US$, rate of ${formatDate(s.rateDate)}), so older films look smaller than they were at the time. Figures are not adjusted for inflation.</p>

<h2>Spotted a wrong number?</h2>
<p>Corrections made on the film's Wikipedia article, with a reliable source, show up here after the next update. For anything else, <a href="/contact/">contact us</a>.</p>`,
    }),

    contact: (s) => ({
      h1: 'Contact us',
      title: 'Contact us',
      description: `How to reach ${s.site} and how to get a box office figure corrected.`,
      lead: 'Questions, corrections and suggestions are all welcome.',
      body: `<h2>A figure looks wrong</h2>
<p>Every number on this site comes from the film's English Wikipedia article. The quickest way to fix one is to edit that article's infobox and cite a reliable source, such as a trade publication or the producer's announcement. The site picks up the change at its next update, usually within a day. Each film page links to its Wikipedia article at the bottom.</p>
${s.email ? `<h2>Write to us</h2>
<p>For anything else, including feedback, business enquiries or a request about your data, email <a href="mailto:${esc(s.email)}">${esc(s.email)}</a>. We aim to reply within seven days.</p>` : ''}
<h2>Before you write</h2>
<ul>
<li>We cannot share figures that have not been reported publicly.</li>
<li>We do not accept payment to list, rank or remove a film.</li>
<li>For questions about tickets or show times, please contact the cinema or ticketing platform directly.</li>
</ul>`,
    }),

    'privacy-policy': (s) => ({
      h1: 'Privacy policy',
      title: 'Privacy policy',
      description: `How ${s.site} handles your information: no accounts, no forms, and what ${s.ads ? 'advertising, ' : ''}analytics and hosting providers see.`,
      lead: `Last updated ${PRIVACY_DATE}.`,
      body: `<p>${esc(s.site)} (“we”, “the site”) is a free website about box office collections. This policy explains what information is handled when you visit ${esc(s.url)}.</p>

<h2>The short version</h2>
<ul>
<li>There are no accounts, sign-ups or forms, so we never ask for your name, phone number or email.</li>
<li>Your ₹/$ and light/dark choices are saved in your own browser and never sent to us.</li>
${s.ads ? '<li>We show ads from Google AdSense, which keep the site free. Google and its partners use cookies to choose which ads to show.</li>' : ''}
${s.analytics ? '<li>We use Google Analytics to count visits and see which pages are popular.</li>' : ''}
<li>We do not sell or rent any information to anyone.</li>
</ul>

<h2>Information stored in your browser</h2>
<p>The site uses your browser's local storage to remember two settings: whether amounts are shown in rupees or dollars, and whether you chose the light or dark theme. These stay on your device. You can remove them at any time by clearing your browser's site data.</p>

${s.analytics ? `<h2>Analytics</h2>
<p>We use Google Analytics, provided by Google LLC, to understand how many people visit and which pages they read. Google Analytics uses cookies and collects information such as the pages you view, how long you stay, the type of device and browser, and your approximate location. It does not give us your name or contact details. Google processes this information under its own <a href="https://policies.google.com/privacy" rel="noopener">privacy policy</a>. You can opt out with the <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener">Google Analytics opt-out browser add-on</a>, or by blocking cookies in your browser.</p>
` : ''}
${s.ads ? `<h2>Advertising</h2>
<p>The site shows ads served by Google AdSense, a service of Google LLC. Third-party vendors, including Google, use cookies to serve ads based on your previous visits to this site and other websites. Google’s use of advertising cookies enables it and its partners to serve ads to you based on your visits to this site and/or other sites on the internet.</p>
<p>You can opt out of personalised advertising in Google’s <a href="https://adssettings.google.com/" rel="noopener">Ads Settings</a>, and opt out of some other vendors’ use of cookies for personalised advertising at <a href="https://www.aboutads.info/choices/" rel="noopener">aboutads.info</a>. You will still see ads, but they will not be based on your browsing. Google explains <a href="https://policies.google.com/technologies/partner-sites" rel="noopener">how it uses information from sites that use its services</a>.</p>

<h2>Your choices and consent</h2>
<p>Visitors from the European Economic Area, the United Kingdom and Switzerland are asked for consent, through a message provided by Google, before cookies are used for personalised ads or analytics. Until you agree, ads are not personalised and analytics does not set cookies. You can change your choice at any time with the privacy and cookie settings link that the message adds to the page. You can also block or delete cookies in your browser’s settings.</p>

` : ''}<h2>Hosting and fonts</h2>
<p>The site is hosted on Cloudflare, which processes technical information such as your IP address to deliver pages and protect the site from attacks. Text is shown in your device's own fonts, so your browser does not contact a font provider. Cloudflare handles this information under its own privacy policy.</p>

<h2>Links to other websites</h2>
<p>Film pages link to Wikipedia, Wikidata and IMDb. Those sites have their own privacy policies, and we are not responsible for how they handle information.</p>

<h2>Children</h2>
<p>The site is meant for a general audience and does not knowingly collect information from children.</p>

<h2>Changes to this policy</h2>
<p>If this policy changes, the new version will be posted on this page with a new date at the top.</p>

<h2>Contact</h2>
<p>${s.email ? `Questions about this policy can be sent to <a href="mailto:${esc(s.email)}">${esc(s.email)}</a>.` : 'Questions about this policy can be sent through the <a href="/contact/">contact page</a>.'}</p>`,
    }),

    terms: (s) => ({
      h1: 'Terms and conditions',
      title: 'Terms and conditions',
      description: `The terms for using ${s.site}, including how accurate the box office figures and live estimates are.`,
      lead: `Last updated ${TERMS_DATE}.`,
      body: `<p>By using ${esc(s.site)} at ${esc(s.url)} you agree to these terms. If you do not agree, please do not use the site.</p>

<h2>What the site provides</h2>
<p>${esc(s.site)} shows box office collection figures, rankings and estimates for films, for general information and entertainment. It is free to use and needs no account.</p>

<h2>Accuracy of figures and estimates</h2>
<p>Figures are collected automatically from public sources, mainly Wikipedia and Wikidata, which can contain mistakes or change at any time. Live figures are estimates calculated by the site between reported totals; they are not official numbers. We do our best to keep everything correct and current, but we make no promise that any figure is complete, accurate or up to date. Do not rely on the site for business, investment or legal decisions.</p>

<h2>Sources and licences</h2>
<p>Box office figures are facts reported by trade sources. Data from Wikidata is available under CC0. Figures from Wikipedia, including the all-time chart taken from its List of highest-grossing films, are used with attribution under the Creative Commons Attribution-ShareAlike licence, and each page links to its source.</p>

<h2>Images</h2>
<p>Film posters are shown at a small size only to identify the films they belong to, as Wikipedia does. Copyright in each poster stays with its owner. If you hold the rights to an image and want it removed, write to us through the <a href="/contact/">contact page</a> and we will take it down promptly. Photos of people come from Wikimedia Commons under free licences and are credited with their author and licence.</p>
${s.ads ? `
<h2>Advertising</h2>
<p>The site shows ads from third parties, including Google. An ad is not an endorsement, and we are not responsible for advertisers’ products, services or websites. The <a href="/privacy-policy/">privacy policy</a> explains how ads use cookies.</p>
` : ''}
<h2>Trademarks</h2>
<p>Film titles, names and trademarks belong to their owners and are used only to identify the films. The site is not affiliated with or endorsed by any studio, producer, distributor or ticketing platform.</p>

<h2>Using the site</h2>
<p>You may read, share and link to any page. You agree not to disrupt the site, overload it with automated requests, or try to get around its security. Short quotations of figures with a link back to the source page are welcome.</p>

<h2>Links to other websites</h2>
<p>The site links to other websites that we do not control. We are not responsible for their content or practices.</p>

<h2>Limitation of liability</h2>
<p>The site is provided “as is”, without warranties of any kind. To the extent the law allows, ${esc(s.site)} is not liable for any loss or damage arising from the use of, or reliance on, the site or its figures.</p>

<h2>Changes</h2>
<p>We may update these terms from time to time. The new version will be posted on this page with a new date at the top. Continuing to use the site means you accept the updated terms.</p>

<h2>Governing law</h2>
<p>These terms are governed by the laws of India.</p>

<h2>Contact</h2>
<p>${s.email ? `Questions about these terms can be sent to <a href="mailto:${esc(s.email)}">${esc(s.email)}</a>.` : 'Questions about these terms can be sent through the <a href="/contact/">contact page</a>.'}</p>`,
    }),

    disclaimer: (s) => ({
      h1: 'Disclaimer',
      title: 'Disclaimer',
      description: `What ${s.site}'s box office figures and live estimates can and cannot be used for.`,
      lead: `Last updated ${DISCLAIMER_DATE}.`,
      body: `<h2>For general information only</h2>
<p>${esc(s.site)} publishes box office figures, rankings and explanations for general information and entertainment. Nothing on the site is professional, financial, investment or legal advice.</p>

<h2>Figures are reported, not official</h2>
<p>Box office numbers are collected automatically from public sources, mainly Wikipedia and Wikidata, which in turn quote trade analysts, producers and box office trackers. Producers, distributors and trade sources often publish different numbers for the same film, and early figures are usually revised. We check figures before they are published (see <a href="/about/">how the figures are checked</a>), but we cannot guarantee that any number is complete, accurate or current.</p>

<h2>Live figures are estimates</h2>
<p>The live totals on the site are estimates that we calculate between two reported figures. They are always marked with a red dot, and they are replaced by the reported number as soon as a new one is published. They are not ticket sales data and must not be quoted as actual collections. The <a href="/guides/live-box-office-estimate/">guide to our live estimate</a> explains exactly how it is calculated.</p>

<h2>Conversions and comparisons</h2>
<p>Amounts in other currencies are converted at a single recent exchange rate (₹${s.rate} per US$) and are not adjusted for inflation. Rankings compare films released decades apart, with very different ticket prices and numbers of screens, so they show what films earned, not how popular they were in their day.</p>

<h2>No affiliation</h2>
<p>${esc(s.site)} is independent. It is not affiliated with, endorsed by or sponsored by any film studio, producer, distributor, cinema chain, ticketing platform or trade publication. Film titles, names, posters and trademarks belong to their owners and are used only to identify the films.</p>
${s.ads ? `
<h2>Advertising</h2>
<p>Ads on the site are chosen and served by Google AdSense. We do not choose individual ads, and an ad is not a recommendation from us. Advertisers have no influence over figures, rankings or what we write.</p>
` : ''}
<h2>External links</h2>
<p>Pages link to Wikipedia, Wikidata, IMDb and other websites. We do not control those sites and are not responsible for their content.</p>

<h2>Errors and corrections</h2>
<p>If you find a mistake, the fastest fix is to correct the film’s Wikipedia article with a reliable source; the site picks it up at the next update. For anything else, <a href="/contact/">contact us</a>${s.email ? ` at <a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : ''}.</p>

<h2>Liability</h2>
<p>To the extent the law allows, ${esc(s.site)} accepts no liability for any loss or damage arising from the use of, or reliance on, information on the site. The <a href="/terms/">terms and conditions</a> apply to every use of the site.</p>`,
    }),
  },

  errors: {
    notFoundTitle: 'Page not found',
    notFoundH1: 'No film at this address',
    notFoundText: 'The link may be old or mistyped. Search for the film or person instead.',
    goHome: 'Go to the home page',
    serverTitle: 'Something went wrong',
    serverH1: 'The page could not load',
    serverText: 'Something went wrong on our side. Please reload the page in a minute.',
  },
};

export default content;
