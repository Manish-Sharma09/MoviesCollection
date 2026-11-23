// IMDb user rating badge: the IMDb wordmark in its yellow tile, a star and the rating out of 10.
// No hooks and no server-only imports, so it renders in server pages and in client components alike.
// With `imdb` (a title id) it links to the film's IMDb page; leave it out inside an element that is
// already a link (a card that opens the film page).

export function ImdbRating({ value, votes, imdb, size = 'md' }: {
  value: number; votes?: number; imdb?: string | null; size?: 'sm' | 'md';
}) {
  const title = votes ? `IMDb rating ${value.toFixed(1)}/10 from ${votes.toLocaleString('en-IN')} votes` : `IMDb rating ${value.toFixed(1)}/10`;
  const body = (
    <>
      <span className="imdb-logo" aria-hidden="true">IMDb</span>
      <svg className="imdb-star" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" /></svg>
      <span className="imdb-value">{value.toFixed(1)}<small>/10</small></span>
      <span className="sr-only">{title}</span>
    </>
  );
  const cls = `imdb-rating imdb-${size}`;
  return imdb ? (
    <a className={cls} href={`https://www.imdb.com/title/${imdb}/`} rel="noopener" title={title}>{body}</a>
  ) : (
    <span className={cls} title={title}>{body}</span>
  );
}
