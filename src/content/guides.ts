// Guides: original explainers about how the box office works (English only, like film pages).
// Bodies are HTML. Figures that change (counts, biggest films, the exchange rate) come from `g`, which
// src/lib/guide-facts.ts computes from the data on every build, so the articles never go stale.
// When an article is changed in substance, update its `updated` date.
import { escapeHtml as esc, formatCount, formatINR } from '@/lib/format';
import type { ChartFilm, ClubSlug, Film, Stats } from '@/lib/types';

export interface GuideFacts {
  s: Stats;
  /** Films in the all-time worldwide top 100, by decade, newest decade first. */
  decades: { decade: number; count: number }[];
  oldestInTop100: ChartFilm | null;
  /** The Indian languages with the most films. */
  indianLanguages: { name: string; slug: string; count: number; top: Film; c100: number }[];
  /** Films with a reported budget, and how their worldwide gross compares with it. */
  budget: { films: number; atLeast2_5: number; underBudget: number };
  newestInClub: Record<ClubSlug, Film | undefined>;
  /** A film in cinemas with a long day-wise record, or null. */
  dailyExample: Film | null;
}

export interface Guide {
  slug: string;
  title: string;
  /** Meta description and the summary on guide cards. */
  description: string;
  /** ISO dates. */
  published: string;
  updated: string;
  /** Slugs of guides to suggest at the end. */
  related: string[];
  body: (g: GuideFacts) => string;
}

const film = (f: { slug?: string; title: string }) => (f.slug ? `<a href="/movie/${f.slug}/">${esc(f.title)}</a>` : esc(f.title));
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const guide = (slug: string, text: string) => `<a href="/guides/${slug}/">${text}</a>`;
const joinList = (items: string[]) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

const PUBLISHED = '2026-11-23';

export const GUIDES: Guide[] = [
  {
    slug: 'gross-net-share',
    title: 'Gross, net and share: the three numbers behind every box office report',
    description: 'Why one film can be reported at three different totals on the same day, what each one measures, and which to use for what.',
    published: PUBLISHED,
    updated: PUBLISHED,
    related: ['why-box-office-figures-differ', 'hit-or-flop-budget', 'box-office-glossary'],
    body: ({ s }) => `<p>Open three trade reports on the Monday after a big release and you may find three different totals for the same film. Often none of them is wrong. Box office money is counted at three stages, and each stage has its own name: gross, net and share. Knowing which one you are looking at is the most useful skill for reading box office news.</p>

<h2>Gross: what audiences paid</h2>
<p>Gross collection is the full value of the tickets sold, including the tax printed on the ticket. If 1,000 people each pay ₹250 for a show, the gross is ₹2.5 lakh. Gross is the only measure used in every country, so worldwide totals, Hollywood reports and the charts on this site all use it. When a producer's poster announces a worldwide figure, that is a gross figure too.</p>

<h2>Net: gross minus tax</h2>
<p>Within India, trade analysts usually quote net collection (often spelt “nett”): the gross with Goods and Services Tax taken out. Before GST arrived in 2017, each state charged its own entertainment tax, at rates that varied widely, so gross figures from different states could not be compared fairly. Taking the tax out gave the trade a cleaner number, and the habit stayed.</p>
<p>Today most cinema tickets in India carry 18% GST, cheap tickets are taxed at a lower rate, and a few states add a local entertainment tax on top. That is why analysts often turn net into gross by multiplying by about 1.18. A film reported at ₹300 crore net in India has grossed roughly ₹354 crore there. The exact factor depends on the mix of cheap and expensive tickets, so treat any conversion as approximate.</p>

<h2>Share: what reaches the distributor</h2>
<p>The cinema keeps part of the net, and what is left goes to the distributor. That is the distributor's share. In Indian multiplexes the distributor's cut of a Hindi film has traditionally been largest in the first week, around half of the net, and smaller in each week after that, which is one reason producers chase a big opening. Single screens, South Indian markets and individual deals all have their own terms.</p>
<p>The idea is the same abroad. In the United States a studio typically ends up with roughly half of a film's gross over its whole run, with a bigger cut in the opening weeks. In China, foreign films released under the standard revenue-sharing arrangement earn their studios about a quarter of the gross.</p>

<h2>Which number tells you if a film made money?</h2>
<p>None of them on its own. Share is the closest to real income from cinemas, but a film also earns from streaming, satellite television and music rights, and it has to pay back its production budget and its marketing costs. Our guide ${guide('hit-or-flop-budget', 'Hit or flop? What a film really needs to earn')} walks through how the trade decides.</p>

<h2>What this site shows</h2>
<p>Every chart on ${esc(s.site)} ranks films by worldwide gross, because it is the one figure that can be compared across countries, languages and decades. Indian films are shown in rupees and other films in US dollars, and the ₹/$ switch converts every amount at one recent exchange rate (₹${s.rate} per US$). When a film page also lists a separate figure for India or for the US and Canada, it comes from the film's own sources and covers only that market.</p>

<h2>A quick checklist</h2>
<ul>
<li>Does the report say net or gross? An India-only figure from a trade analyst that says neither is usually net.</li>
<li>Is it India only, overseas only, or worldwide?</li>
<li>Does it include the dubbed versions? For films released in several languages, the dubs can be a large part of the total.</li>
<li>When was it published? Early-morning figures are usually estimates that get revised later.</li>
</ul>`,
  },

  {
    slug: 'why-box-office-figures-differ',
    title: 'Why box office numbers never match from one site to the next',
    description: 'Net or gross, India or worldwide, estimate or final: the seven usual reasons two sources report different collections for the same film.',
    published: PUBLISHED,
    updated: PUBLISHED,
    related: ['gross-net-share', 'domestic-overseas-worldwide', 'live-box-office-estimate'],
    body: ({ s }) => `<p>Search for any big film's collection and you will find a spread of numbers, sometimes hundreds of crores apart. Fans argue about which one is real, but most of the gap comes from a handful of predictable differences. Once you can spot them, you can usually line two figures up yourself.</p>

<h2>1. Net or gross</h2>
<p>Indian trade analysts usually quote net collection (ticket sales minus GST), while producers' announcements and worldwide totals use gross. On most tickets the gap is around 18%. The ${guide('gross-net-share', 'guide to gross, net and share')} explains the difference.</p>

<h2>2. India, overseas or worldwide</h2>
<p>A headline saying a film “crossed ₹500 crore” may mean India net, India gross or the worldwide gross. Overseas markets can add a great deal: for Hindi films with a big diaspora audience, and for many Telugu, Tamil and Malayalam films, overseas earnings are a large part of the total.</p>

<h2>3. Which versions are counted</h2>
<p>Big Indian releases now come out dubbed in several languages. Some reports cover the original-language version only; others add every dub. The Hindi version of a South Indian film can earn as much as the original, so this difference alone can be large.</p>

<h2>4. Estimates and final figures</h2>
<p>The first numbers each morning are estimates built from a sample of cinemas and online bookings. They get revised as fuller figures come in, sometimes days later. Two sites quoting the same tracker at different times will disagree.</p>

<h2>5. Who is reporting</h2>
<p>Independent trackers, trade analysts, distributors and producers all publish figures. Producers have an interest in big numbers, and their totals are sometimes higher than independent estimates. None of these figures is audited in public, so a number is only as good as its source.</p>

<h2>6. Exchange rates</h2>
<p>Overseas earnings are converted into rupees, or Indian earnings into dollars, at some exchange rate. Whether that is the rate on release day, on the day of the report or today changes the total. This site converts everything at a single recent rate, ₹${s.rate} per US$, so a film's ranking does not jump around when the rupee moves.</p>

<h2>7. Re-releases and late markets</h2>
<p>Some totals include a re-release years later, or a release in China or Japan months after the first run. A film's worldwide gross can change long after it has left Indian cinemas.</p>

<h2>How ${esc(s.site)} chooses a number</h2>
<p>We use the worldwide gross cited in each film's English Wikipedia article, where editors have to back figures with a published source, and Wikidata when Wikipedia has none. Very large figures are cross-checked against Wikipedia's lists of highest-grossing films before they are published, and every film page links to its sources. The <a href="/about/">about page</a> lists the checks. Our figures are not more official than anyone else's, but they are consistent: every film is measured the same way, so the rankings are fair.</p>

<h2>Comparing two figures yourself</h2>
<ul>
<li>Bring both to the same scope first: India or worldwide, net or gross.</li>
<li>Check the dates. A total from day 10 cannot be compared with one from day 17.</li>
<li>Look for words such as “approximately”, “estimated” or “early estimates”.</li>
<li>If the gap is still large after that, trust the figure that names its source.</li>
</ul>`,
  },

  {
    slug: 'live-box-office-estimate',
    title: 'How our live box office estimate works',
    description: 'The exact model behind the live totals on this site: the daily base, weekday weights, the show-time curve, and when the estimate stops.',
    published: PUBLISHED,
    updated: '2026-11-24',
    related: ['reading-day-wise-collection', 'why-box-office-figures-differ', 'gross-net-share'],
    body: ({ s }) => `<p>Box office figures are reported about once a day, usually the morning after. In between, the live totals on ${esc(s.site)} move every minute. Those moving numbers are estimates that we calculate, and this guide explains exactly how, so you can judge how far to trust them.</p>

<h2>Step 1: the last reported total</h2>
<p>For every film in cinemas we read the history of its English Wikipedia article and take the worldwide total that stood at the end of each day, India time. A report edited after 8 pm is taken to cover that day; one edited earlier is taken to cover the day before, because morning updates usually report the previous day's business. New reports are read every three hours. The result is the day-wise table on each film page, and its last row is where the estimate starts.</p>

<h2>Step 2: a normal day's business</h2>
<p>Next we look at how much the film added over roughly the last three days before that report. Weekends earn more than weekdays, so each of those days is weighted by how much a typical day of the week earns compared with a Friday:</p>
<ul>
<li>Friday: 1.0</li>
<li>Saturday: 1.35</li>
<li>Sunday: 1.6</li>
<li>Monday: 0.55</li>
<li>Tuesday: 0.55</li>
<li>Wednesday: 0.5</li>
<li>Thursday: 0.45</li>
</ul>
<p>Dividing what the film added by the sum of those weights gives its base: what it would earn on an ordinary Friday at its current pace.</p>

<h2>Step 3: projecting forward</h2>
<p>For each day after the last report, the estimate is the base multiplied by that day's weight, reduced by 6% for each day that has passed. A 6% daily drop works out to about 35% a week, a typical rate for a film after its first weekend.</p>

<h2>Step 4: following the show times</h2>
<p>Money does not come in evenly through the day. Morning shows are small and evening shows are big, so the estimate follows a show-time curve, in India time:</p>
<ul>
<li>nothing before 9 am</li>
<li>10% of the day's business by noon</li>
<li>28% by 3 pm</li>
<li>50% by 6 pm</li>
<li>80% by 9 pm</li>
<li>all of it by midnight</li>
</ul>
<p>The total moves along that curve in one-minute steps, which is what you see ticking on the <a href="/live/">live page</a> and on film pages.</p>

<h2>A worked example</h2>
<p>Say a film's base is ₹10 crore and its last report covers Friday. Saturday's estimate for the full day is ₹10 crore × 1.35 × 0.94, about ₹12.7 crore. At 6 pm on Saturday half of that has come in, so the live total is Friday's reported total plus about ₹6.3 crore. When Saturday's real figure is reported, the estimate is dropped and starts again from the new total.</p>

<h2>When the estimate stops</h2>
<ul>
<li>As soon as a new figure is reported, the live total resets to it.</li>
<li>If no new figure arrives for four days, the site stops estimating and shows the last reported total, because guessing further would mostly be noise.</li>
<li>Live figures are always marked with a red dot. Reported figures never are.</li>
</ul>

<h2>Projection: the next stop</h2>
<p>Under the running total on a film page, the next round milestone (such as the next ₹100 or ₹200 crore) shows the day on which the model expects the film to pass it, if that is within about six weeks. It is the same model run forward day by day (6% less each day, adjusted for the day of the week).</p>
<p>That day is a projection at the current pace, not a forecast. A strong second weekend, a holiday or a new release changes the pace, and every new report moves it.</p>

<h2>What the model does not know</h2>
<p>The weights describe an ordinary week. They do not know about festivals and public holidays, when a weekday can earn like a Sunday. They do not know when a big new release takes screens away, or when strong word of mouth makes a film grow in its second week. On those days the estimate will be off, and the next report corrects it. It also cannot be more accurate than the reports it starts from, which are themselves estimates by trade sources.</p>

<h2>Why estimate at all?</h2>
<p>Because during a release people want to know how a film is doing right now, and between reports the honest answer is an estimate. We show it, label it, explain it here, and replace it with the reported figure as soon as there is one. Please do not quote live figures as actual collections; the <a href="/disclaimer/">disclaimer</a> says the same.</p>`,
  },

  {
    slug: 'reading-day-wise-collection',
    title: 'How to read a day-wise box office chart',
    description: 'Weekend spikes, the Monday test, second-weekend drops and holidays: what a film’s day-by-day numbers say about how it will finish.',
    published: PUBLISHED,
    updated: PUBLISHED,
    related: ['live-box-office-estimate', 'box-office-glossary', 'hit-or-flop-budget'],
    body: ({ s, dailyExample }) => `<p>A film's total tells you where it stands. Its day-by-day numbers tell you where it is heading. Every film in cinemas on ${esc(s.site)} has a day-wise table and chart, and with a few rules of thumb you can read them the way trade analysts do.</p>
${dailyExample ? `<p>To follow along, open a film with a long run of reports, such as ${film(dailyExample)}, and switch its chart to <em>Per day</em>.</p>\n` : ''}
<h2>The two views of the chart</h2>
<p><strong>Total</strong> shows the running worldwide total. A typical film draws a curve that rises steeply at first and then flattens as daily business shrinks. <strong>Per day</strong> shows how much each day added, which makes patterns much easier to see. A dashed line at the end is the live estimate for the time since the last report, not a reported number; the ${guide('live-box-office-estimate', 'live estimate guide')} explains it.</p>
<p>Days without a new report are left out, so one row of the table can cover two or three days. When that happens, the amount added belongs to all of those days together, not to the last one.</p>

<h2>The weekly rhythm</h2>
<p>In India most films open on a Friday, and big releases often on a Thursday or around a holiday. Saturday is usually higher than Friday, and Sunday is the best day of the week. Monday falls sharply, and the rest of the week drifts lower until the next weekend lifts business again. In the per-day view this looks like a saw: tall weekend teeth with valleys in between.</p>

<h2>The Monday test</h2>
<p>The first Monday is the first ordinary working day, so the trade watches it closely. As a rough guide, a film that keeps around half of its opening-day business on Monday is being recommended by the people who saw it. A much bigger fall suggests the opening was driven by excitement before release and that the audience is thinning out.</p>

<h2>The second weekend</h2>
<p>Compare the second weekend with the first. A drop of less than about 40% is a strong hold. Drops of 50 to 60% are common for big films whose fans rushed to see them in the first days. A film that falls further than that will probably finish at well under three times its opening weekend.</p>

<h2>Legs and the multiplier</h2>
<p>Divide a film's final total by its opening weekend and you get its multiplier; the trade calls a high one “legs”. Event films that everyone sees in the first days tend to have low multipliers. Films that grow by word of mouth have high ones, and a few earn more in their second week than in their first. With the day-wise table you can work out a rough multiplier while the film is still running.</p>

<h2>Holidays and clashes</h2>
<p>Festivals and long weekends break the weekly rhythm. A weekday holiday can earn as much as a Sunday, and the days around Diwali, Eid, Christmas and the Independence Day and Republic Day weekends are often among the biggest of the year. On the other hand, a big new release takes away screens and show times, and an older film's daily numbers then fall faster than usual. When a chart does something odd, check the calendar first.</p>

<h2>What the numbers cannot show</h2>
<p>A day-wise total is only as good as its reports. Trade figures are often revised, and our rows record what the film's Wikipedia article said at the end of each day. A sudden jump can be a late correction rather than a great day. Our guide to ${guide('why-box-office-figures-differ', 'why box office numbers differ')} covers the usual reasons.</p>`,
  },

  {
    slug: 'hit-or-flop-budget',
    title: 'Hit or flop? What a film really needs to earn',
    description: 'Budgets, cinema shares, marketing costs and rights deals: why a film can gross twice its budget and lose money, or gross less and still profit.',
    published: PUBLISHED,
    updated: PUBLISHED,
    related: ['gross-net-share', 'crore-clubs', 'box-office-glossary'],
    body: ({ s, budget }) => `<p>“It made ₹200 crore on a ₹150 crore budget, so it's a hit.” It is the most common box office argument online, and it is often wrong in both directions. A film's verdict depends on far more than its gross. This guide explains what the trade actually counts.</p>

<h2>What a budget includes</h2>
<p>The budget you see reported is normally the production cost: the money spent making the film. It usually leaves out the cost of releasing it, known as prints and advertising, which for a big release can add a large amount on top. Reported budgets are also rarely audited. Producers sometimes play them down and sometimes up, and different reports quote different numbers.</p>

<h2>Why gross is not income</h2>
<p>Of every rupee a cinema-goer pays, part goes to the government as tax and part is kept by the cinema. Only the distributor's share flows back towards the people who paid for the film, and depending on the week, the market and the deal, that is usually well under half of the gross. Abroad the share varies by country. The ${guide('gross-net-share', 'gross, net and share guide')} has the details.</p>

<h2>A rule of thumb for Hollywood</h2>
<p>Because studios get back only part of the gross and also pay for marketing around the world, a common rule of thumb in Hollywood is that a film needs to gross around two and a half times its production budget in cinemas to break even. A $200 million film needs about $500 million worldwide to cover its costs from the cinema run alone. Streaming, television and home entertainment income then decide how profitable it is in the end.</p>

<h2>Why Indian films are different</h2>
<p>Indian producers often sell a film's non-theatrical rights before release: streaming, satellite television, music and, for films released in several languages, dubbing rights. For a film with big stars these deals can cover a large part of the budget, sometimes most of it. The cinema run then decides how much profit is made rather than whether the money comes back at all. That is why trade verdicts in India are based on what the distributors recovered, not on the gross, and why a film can lose money for its distributors while its producer still profits, or the other way round.</p>

<h2>The trade's verdict words</h2>
<p>Trade analysts sort films into labels such as flop, average, hit, super hit and blockbuster, based on how much of their investment the distributors recovered. Different trackers use different scales, and the labels are opinions, not audited results. ${esc(s.site)} does not give verdicts. We show the reported gross, the reported budget and the ratio between them, and leave the judgement to you.</p>

<h2>What our “times its budget” figure means</h2>
<p>On a film page, a line such as “Earned 3.2 times its budget” is simply the worldwide gross divided by the reported budget, both in the same currency. It is a quick way to compare films of different sizes, not a measure of profit. Of the ${formatCount(budget.films)} films on the site with a reported budget, ${pct(budget.atLeast2_5, budget.films)}% grossed at least two and a half times their budget and ${pct(budget.underBudget, budget.films)}% grossed less than their budget.</p>

<h2>Questions to ask before calling a film a hit</h2>
<ul>
<li>Who reported the budget, and does it include marketing?</li>
<li>Is the gross for India or worldwide, and is it net or gross?</li>
<li>How much did the streaming, television and music rights sell for?</li>
<li>Did the distributors earn back what they paid for the film?</li>
</ul>`,
  },

  {
    slug: 'crore-clubs',
    title: 'The 100, 500 and 1,000 crore clubs explained',
    description: 'Where the crore clubs came from, how many Indian films are in each today, and why ₹100 crore means less than it used to.',
    published: PUBLISHED,
    updated: PUBLISHED,
    related: ['inflation-and-all-time-records', 'indian-box-office-by-language', 'gross-net-share'],
    body: ({ s, newestInClub }) => {
      const n = (slug: ClubSlug) => formatCount(s.clubs[slug].length);
      const newest = (slug: ClubSlug) => (newestInClub[slug] ? `; the most recent to join is ${film(newestInClub[slug]!)}` : '');
      const ti = s.topIndian;
      return `<p>Indian box office talk is organised around round numbers. A film “enters the 100 crore club”, “crosses 500 crore” or “joins the 1,000 crore club”, and the milestone often becomes the headline. This guide explains what the clubs mean, how ${esc(s.site)} counts them, and why the bar keeps moving.</p>

<h2>Where the clubs came from</h2>
<p>The phrase took off in the late 2000s, when Hindi films began crossing ₹100 crore at the Indian box office. <em>Ghajini</em> (2008) is widely credited as the first Hindi film to pass ₹100 crore net in India, and within a few years several films a year were doing it. As ticket prices, screen counts and overseas markets grew, the milestones that made headlines moved up to ₹200, ₹300 and ₹500 crore. In 2017 <em>Baahubali 2: The Conclusion</em> became the first Indian film to gross ₹1,000 crore worldwide.</p>

<h2>Which number counts</h2>
<p>There is no official club. Trade reports usually mean India net collection, producers often mean worldwide gross, and fans pick whichever is bigger. On ${esc(s.site)} the clubs use worldwide gross, the same figure as everything else on the site, so a film can appear in our 100 crore club before trade reports say it has crossed ₹100 crore net in India.</p>

<h2>The clubs today</h2>
<ul>
<li><a href="/club/100-crore/">100 crore club</a>: ${n('100-crore')} Indian films${newest('100-crore')}.</li>
<li><a href="/club/500-crore/">500 crore club</a>: ${n('500-crore')} Indian films${newest('500-crore')}.</li>
<li><a href="/club/1000-crore/">1,000 crore club</a>: ${n('1000-crore')} Indian films${newest('1000-crore')}.</li>
<li><a href="/club/1-billion-dollar/">$1 billion club</a>: ${n('1-billion-dollar')} films from any country that grossed US$1 billion or more worldwide.</li>
</ul>
${ti ? `<p>The highest-grossing Indian film on the site is ${film(ti)}${ti.year ? ` (${ti.year})` : ''}, with ${formatINR(ti.gross.inr)} worldwide.</p>\n` : ''}<p>The lists update themselves every day, so a film joins a club on the site as soon as its reported worldwide gross passes the mark.</p>

<h2>Why ₹100 crore is not what it was</h2>
<p>Box office figures are not adjusted for inflation. Ticket prices in India have risen many times over in the last few decades, multiplexes have replaced many single screens, and big films now open on thousands of screens at once and in several languages. A film that sells as many tickets as a 1990s hit will gross several times more today. That is why the 100 crore club has grown to ${n('100-crore')} films, and why older classics, which sold huge numbers of tickets at low prices, often sit below recent mid-sized hits. The guide to ${guide('inflation-and-all-time-records', 'inflation and all-time records')} goes further.</p>

<h2>Clubs and dubbed versions</h2>
<p>Since <em>Baahubali</em>, many big Indian films have been released in several languages at once. Their totals include every dubbed version, which is how a Telugu, Tamil or Kannada film can reach the 1,000 crore club on the strength of its Hindi version as well as its original. See the guide to ${guide('indian-box-office-by-language', 'India’s box office by language')}.</p>`;
    },
  },

  {
    slug: 'inflation-and-all-time-records',
    title: 'Why old blockbusters look small: inflation and all-time records',
    description: 'All-time box office charts favour recent films. Here is why, how big the effect is on our own chart, and other ways to compare films across decades.',
    published: PUBLISHED,
    updated: '2026-11-23',
    related: ['crore-clubs', 'domestic-overseas-worldwide', 'gross-net-share'],
    body: ({ s, decades, oldestInTop100 }) => {
      const parts = decades.map(({ decade, count }) => `${formatCount(count)} from the ${decade}s`);
      return `<p>Look at any all-time box office chart, including ours, and you will see mostly recent films. That is not because older films were less popular. Box office charts rank films by the money they took, and money has changed value over the decades.</p>

<h2>What our chart looks like</h2>
<p>Of the 100 highest-grossing films on our <a href="/top/">all-time chart</a>, ${joinList(parts)}.${oldestInTop100 ? ` The oldest film in the top 100 is ${film(oldestInTop100)} (${oldestInTop100.year}).` : ''}</p>

<h2>Three reasons new films win</h2>
<p><strong>Ticket prices.</strong> A cinema ticket costs many times what it did a few decades ago, in India and almost everywhere else. Selling the same number of tickets brings in far more money today.</p>
<p><strong>More markets.</strong> Hollywood films now open almost everywhere at once, and China grew from a small market into one of the largest in the world during the 2010s. Indian films reach audiences in dozens of countries and in several languages at the same time.</p>
<p><strong>Premium formats.</strong> 3D, IMAX and recliner seats cost more than a standard ticket, and they make up a larger share of sales for the biggest releases.</p>

<h2>The currency effect</h2>
<p>${esc(s.site)} converts every amount at one recent exchange rate (₹${s.rate} per US$). This keeps rankings stable, but it has a side effect. The rupee has weakened against the dollar over the decades, so an older Indian film's rupee total converted at today's rate is worth fewer dollars than it was when the film was released, and an older Hollywood film's dollar total looks bigger in rupees than it did at the time. Compare films in their own currency when you can.</p>

<h2>Adjusted for inflation</h2>
<p>Lists that adjust grosses to today's prices tell a different story. <em>Gone with the Wind</em> (1939) tops most inflation-adjusted lists of worldwide box office. In India, trade writers often argue that classics such as <em>Mughal-e-Azam</em> (1960) and <em>Sholay</em> (1975) would rank among the biggest films ever if their ticket sales were valued at today's prices. Adjusted figures are estimates, though: they depend on which inflation measure is used, and on box office records that, for older films, are often incomplete.</p>
<p>${esc(s.site)} publishes its own adjusted charts: the <a href="/india/adjusted/">biggest Indian films adjusted for inflation</a> and the <a href="/top/adjusted/">all-time worldwide chart adjusted for inflation</a>. Each gross is raised with the consumer price index of the country whose currency it was reported in, using World Bank figures that start in 1960, so older films are left out. Old films are only adjusted when Wikipedia's highest-grossing lists include them, or when even the adjusted figure is modest, because a wrong figure from the 1960s multiplied by ninety becomes a wrong record. Film pages show the adjusted figure next to the reported one, and the <a href="/compare/">compare tool</a> puts any two films side by side in today's money.</p>

<h2>Footfalls: counting people, not money</h2>
<p>Another way to compare across decades is footfalls, the number of tickets sold. Divide a gross by the average ticket price of its time and you get a rough count of how many people saw the film. Indian trade analysts use footfalls to compare old and new hits, and they show many older films in a much better light. The weakness is the same: average ticket prices for past decades are themselves estimates.</p>

<h2>How to use our chart</h2>
<ul>
<li>Use it to see which films took the most money, not which were seen by the most people.</li>
<li>For the fairest comparison, compare films from the same few years: every <a href="/years/">year</a> has its own chart.</li>
<li>Read every figure as nominal: the amount reported at the time, not its value today.</li>
</ul>`;
    },
  },

  {
    slug: 'indian-box-office-by-language',
    title: 'Hindi, Telugu, Tamil and more: India’s box office by language',
    description: 'How India’s film industries compare at the box office, with the number of films, ₹100 crore grossers and the biggest film in each language on the site.',
    published: PUBLISHED,
    updated: PUBLISHED,
    related: ['domestic-overseas-worldwide', 'crore-clubs', 'why-box-office-figures-differ'],
    body: ({ s, indianLanguages }) => `<p>India does not have one film industry; it has many, each with its own stars, audiences and release calendar. Films are made in more than 20 languages, and the biggest industries now compete with each other for the top of the national box office. This guide gives a quick picture of each, using the figures on ${esc(s.site)}.</p>

<h2>The languages at a glance</h2>
<ul>
${indianLanguages.map((l) => `<li><a href="/language/${l.slug}/">${esc(l.name)}</a>: ${formatCount(l.count)} films on the site, ${formatCount(l.c100)} of them in the 100 crore club. Biggest: ${film(l.top)}${l.top.year ? ` (${l.top.year})` : ''}, ${formatINR(l.top.gross.inr)} worldwide.</li>`).join('\n')}
</ul>
<p>The counts include every film with a reported box office figure in our sources, so they show what the site tracks, not everything each industry has made. A film listed with more than one language counts under each.</p>

<h2>Hindi</h2>
<p>Hindi cinema, often called Bollywood, has the widest reach in India, because Hindi is understood across much of the north, centre and west of the country, and it has the largest overseas following of any Indian cinema. For decades the biggest Indian hits were almost all Hindi films.</p>

<h2>Telugu</h2>
<p>The Telugu industry, centred on Hyderabad, makes large-scale films for audiences in Andhra Pradesh and Telangana, and has a strong following in North America. Since <em>Baahubali: The Beginning</em> (2015), Telugu films released in several languages at once have repeatedly topped the national box office.</p>

<h2>Tamil</h2>
<p>Tamil cinema, centred on Chennai, has a big home market in Tamil Nadu and one of the most widespread overseas audiences of any Indian cinema, including Sri Lanka, Malaysia, Singapore, the Gulf, Europe and North America. A new film from one of its biggest stars is treated as an event.</p>

<h2>Malayalam</h2>
<p>Malayalam films are usually made on smaller budgets than those of the other large industries and are known for strong writing. Kerala's large community in the Gulf makes overseas earnings unusually important, and in recent years Malayalam films have reached much bigger totals than before.</p>

<h2>Kannada</h2>
<p>Kannada cinema was long a mainly regional market, until <em>K.G.F: Chapter 1</em> (2018) and <em>K.G.F: Chapter 2</em> (2022) showed that a Kannada film could become a hit across India. <em>Kantara</em> (2022) confirmed it.</p>

<h2>Marathi, Bengali, Punjabi and others</h2>
<p>Smaller industries have their own hits and loyal audiences. Marathi cinema's <em>Sairat</em> (2016) showed how far a regional film can travel, Bengali cinema has a long art-house tradition, and Punjabi films do especially well in Canada, the United Kingdom and Australia.</p>

<h2>Pan-India releases</h2>
<p>The biggest change of the last decade is the pan-India film: a big-budget release dubbed into Hindi, Telugu, Tamil, Malayalam and Kannada and opened across the country on the same day. These films blur the old language lines, and their totals include every version. On the site a film is listed under the language or languages given in its sources, while its gross covers all versions together.</p>`,
  },

  {
    slug: 'domestic-overseas-worldwide',
    title: 'Domestic, overseas, worldwide: where a film’s money comes from',
    description: 'How box office territories work for Hollywood and Indian films, which overseas markets matter most, and how a worldwide total is put together.',
    published: PUBLISHED,
    updated: PUBLISHED,
    related: ['why-box-office-figures-differ', 'indian-box-office-by-language', 'gross-net-share'],
    body: ({ s }) => `<p>A worldwide gross is the sum of many markets, each reported by different people, in different currencies, on different schedules. Knowing how the pieces fit together makes box office headlines much easier to read.</p>

<h2>Hollywood: domestic and international</h2>
<p>In Hollywood reporting, “domestic” means the United States and Canada together, and “international” means everywhere else. Studios publish weekend estimates on Sunday and actual figures on Monday, which is why Monday's numbers sometimes differ slightly from the weekend headlines. Film pages on ${esc(s.site)} show a separate US and Canada figure when one is reported.</p>
<p>For most big Hollywood films, international markets now earn more than the domestic one. China became one of the largest markets in the world in the 2010s, although Hollywood films earn far less there now than they did at their peak.</p>

<h2>India: domestic and overseas</h2>
<p>For Indian films, “domestic” means India and “overseas” means everywhere else. Inside India the trade divides the country into distribution territories, called circuits, such as Mumbai, Delhi–UP, East Punjab, Nizam (mainly Telangana) and Mysore (Karnataka). Each has its own distributors, and detailed reports break a film's business down circuit by circuit.</p>

<h2>The overseas markets that matter</h2>
<ul>
<li><strong>North America.</strong> The biggest overseas market for many Hindi and Telugu films, thanks to a large Indian community.</li>
<li><strong>The Gulf.</strong> The United Arab Emirates and its neighbours are especially important for Malayalam films, and big for Hindi, Tamil and Telugu releases too.</li>
<li><strong>The United Kingdom, Australia and New Zealand.</strong> Steady markets for Hindi and Punjabi films and, increasingly, for South Indian releases.</li>
<li><strong>Southeast Asia.</strong> Malaysia and Singapore have large Tamil-speaking audiences.</li>
<li><strong>China and Japan.</strong> Occasional, but they can transform a film's total. A few Indian films have earned more in China than in India, <em>Dangal</em> being the best-known example, and <em>RRR</em> ran for months in Japanese cinemas.</li>
</ul>

<h2>How a worldwide total is put together</h2>
<p>Overseas figures are normally reported as gross in US dollars, while Indian figures are reported in rupees and often as net. To get a worldwide gross, the India figure has to be turned into gross, the overseas figure converted into rupees, and the two added. Each step involves a choice: which tax factor, which exchange rate, which language versions. That is a large part of why ${guide('why-box-office-figures-differ', 'sources disagree')}.</p>

<h2>Reading our film pages</h2>
<p>The headline number on every film page is the worldwide gross. When the film's sources also give a separate figure for India or for the US and Canada, it is listed below the headline, so you can see how much of the total came from the home market and how much from the rest of the world.</p>`,
  },

  {
    slug: 'box-office-glossary',
    title: 'Box office glossary: the terms used in trade reports',
    description: 'Plain-English definitions of the words used in box office reports, from ATP and footfalls to legs, net, share and worldwide gross.',
    published: PUBLISHED,
    updated: PUBLISHED,
    related: ['gross-net-share', 'reading-day-wise-collection', 'hit-or-flop-budget'],
    body: ({ s }) => `<p>Box office reports have a vocabulary of their own, part industry jargon and part Indian trade shorthand. Here are the terms you will meet most often, in plain English, with links to the guides that explain the bigger ideas.</p>

<dl class="glossary">
<dt>Advance booking</dt>
<dd>Tickets sold before a show, mostly online. Strong advance booking for the first days is the earliest sign of a big opening.</dd>
<dt>All-time blockbuster</dt>
<dd>The highest verdict some trade analysts give, for a film that earns far more than was invested in it. Like every verdict, it is an opinion, not an audited result.</dd>
<dt>ATP (average ticket price)</dt>
<dd>The gross divided by the number of tickets sold. Multiplexes in big cities have a much higher ATP than single screens in small towns.</dd>
<dt>Break-even</dt>
<dd>The point at which a film has earned back what was spent on it. See ${guide('hit-or-flop-budget', 'Hit or flop?')}.</dd>
<dt>Circuit</dt>
<dd>A distribution territory within India, such as Mumbai, Delhi–UP, East Punjab, Nizam or Mysore. Detailed reports break a film's business down by circuit.</dd>
<dt>Clash</dt>
<dd>Two or more big films releasing on the same day and splitting the screens and the audience.</dd>
<dt>Collection</dt>
<dd>The money a film takes at the box office. On its own, the word does not say whether it means net or gross.</dd>
<dt>Day 1</dt>
<dd>The opening day. Paid previews held before it are sometimes added to it and sometimes reported separately.</dd>
<dt>Distributor</dt>
<dd>The company that releases a film in a territory, books it into cinemas and collects the distributor's share.</dd>
<dt>Domestic</dt>
<dd>The home market: India for Indian films, and the United States and Canada for Hollywood films.</dd>
<dt>Dubbed version</dt>
<dd>The film released in another language with new voices. For films released in several languages, totals usually include every version.</dd>
<dt>Extended weekend</dt>
<dd>An opening weekend stretched by a holiday or an early release, for example from Thursday to Sunday.</dd>
<dt>Footfalls</dt>
<dd>The number of tickets sold. Useful for comparing films across decades, because it ignores changes in ticket prices.</dd>
<dt>Front-loaded</dt>
<dd>A film that earns most of its total in the first few days, usually because its fans rush to see it.</dd>
<dt>Gross</dt>
<dd>The full value of the tickets sold, including tax. Every chart on ${esc(s.site)} uses worldwide gross. See ${guide('gross-net-share', 'gross, net and share')}.</dd>
<dt>Hold</dt>
<dd>How well a film keeps its business from one day or week to the next. A “good hold” means a small drop.</dd>
<dt>Legs</dt>
<dd>A film's staying power. A film “with legs” keeps earning well for weeks after its opening.</dd>
<dt>Lifetime</dt>
<dd>A film's final total at the end of its run in cinemas.</dd>
<dt>Multiplex</dt>
<dd>A cinema with several screens, usually in a mall, with higher ticket prices than a single screen.</dd>
<dt>Multiplier</dt>
<dd>The final total divided by the opening weekend. A high multiplier means a long, steady run. See ${guide('reading-day-wise-collection', 'how to read a day-wise chart')}.</dd>
<dt>Net (nett)</dt>
<dd>Gross minus GST and any local entertainment tax. The usual figure in Indian domestic reports.</dd>
<dt>Occupancy</dt>
<dd>The share of seats filled, often reported for morning, afternoon, evening and night shows on the first days.</dd>
<dt>Opening weekend</dt>
<dd>The first Friday to Sunday of a film's release, or longer when the release is on a Thursday or a holiday.</dd>
<dt>Overseas</dt>
<dd>Everything outside the home market. For Indian films, every country except India. See ${guide('domestic-overseas-worldwide', 'domestic, overseas, worldwide')}.</dd>
<dt>P&amp;A (prints and advertising)</dt>
<dd>The cost of marketing and releasing a film. Usually not included in the reported budget.</dd>
<dt>Paid previews</dt>
<dd>Shows held before the official release day with tickets on sale to the public.</dd>
<dt>Pan-India film</dt>
<dd>A film released across India in several languages on the same day.</dd>
<dt>Re-release</dt>
<dd>A film returning to cinemas, sometimes years later. Some totals include what a re-release earned.</dd>
<dt>Screen count</dt>
<dd>The number of screens showing a film. The biggest Indian releases open on several thousand screens.</dd>
<dt>Share (distributor's share)</dt>
<dd>The part of the net that goes to the distributor after the cinema keeps its cut.</dd>
<dt>Single screen</dt>
<dd>A cinema with one screen, traditionally with lower ticket prices than a multiplex.</dd>
<dt>Verdict</dt>
<dd>A trade label such as flop, average, hit, super hit or blockbuster, based on how much the distributors recovered. ${esc(s.site)} does not give verdicts.</dd>
<dt>Word of mouth</dt>
<dd>What audiences tell each other about a film. Good word of mouth shows up as a strong first Monday and second weekend.</dd>
<dt>Worldwide gross</dt>
<dd>Gross from every country added together. It is the figure every ranking on this site uses.</dd>
</dl>`,
  },
];

export const guideBySlug = new Map(GUIDES.map((g) => [g.slug, g]));
