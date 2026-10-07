import { useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { loadReviews, loadReviewStats, reviewsConfigured, REVIEW_PAGE_SIZE, saveReview } from '../../services/projectReviews';
import './ProjectReviews.css';

const emptyStats = { average_rating: null, rating_count: 0, review_count: 0 };
const dateLabel = date => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(date));
function Stars({ rating }) {
  return <span className="review-stars" aria-label={`${rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map(n => <Star key={n} size={14} fill={n <= Math.round(rating) ? 'currentColor' : 'none'} aria-hidden="true" />)}</span>;
}

export default function ProjectReviews({ project }) {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(emptyStats);
  const [loading, setLoading] = useState(reviewsConfigured);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [author, setAuthor] = useState('');
  const [body, setBody] = useState('');
  const [rating, setRating] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [notice, setNotice] = useState('');
  const alive = useRef(true);
  const pending = useRef(false);
  const moreRequest = useRef(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; moreRequest.current?.abort(); }; }, []);

  useEffect(() => {
    if (!reviewsConfigured) return;
    const controller = new AbortController();
    setLoading(true); setError('');
    Promise.all([loadReviews(project.id, { signal: controller.signal }), loadReviewStats(project.id, { signal: controller.signal })])
      .then(([rows, summary]) => {
        if (controller.signal.aborted) return;
        setReviews(rows); setStats(summary); setHasMore(rows.length === REVIEW_PAGE_SIZE && rows.length < Number(summary.review_count));
      })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [project.id, retry]);

  const more = async () => {
    if (loadingMore) return;
    const controller = new AbortController(); moreRequest.current = controller;
    setLoadingMore(true); setError('');
    try {
      const rows = await loadReviews(project.id, { offset: reviews.length, signal: controller.signal });
      if (alive.current) {
        setReviews(previous => [...previous, ...rows.filter(row => !previous.some(p => p.id === row.id))]);
        setHasMore(rows.length === REVIEW_PAGE_SIZE && reviews.length + rows.length < Number(stats.review_count));
      }
    } catch (e) { if (alive.current && !controller.signal.aborted) setError(e.message); }
    finally { if (alive.current) setLoadingMore(false); }
  };

  const submit = async event => {
    event.preventDefault();
    if (pending.current || (!body.trim() && !rating)) return;
    pending.current = true; setSaving(true); setSubmitError(''); setNotice('');
    try {
      await saveReview(project.id, { author, body, rating });
      if (alive.current) {
        setBody(''); setRating(0); setNotice('Your review is published. Thank you!');
        moreRequest.current?.abort(); setLoadingMore(false); setRetry(n => n + 1);
      }
    } catch (e) { if (alive.current) setSubmitError(e.message); }
    finally { pending.current = false; if (alive.current) setSaving(false); }
  };

  return <section className="proj-section proj-reviews" aria-labelledby="project-reviews-title">
    <div className="review-heading"><h3 id="project-reviews-title">Ratings & reviews</h3>{reviewsConfigured && <button type="button" className="review-text-button" disabled={loading || saving || loadingMore} onClick={() => setRetry(n => n + 1)}>Refresh</button>}</div>
    {!reviewsConfigured ? <p className="review-unavailable" role="status">Public reviews aren’t connected yet. Comments and ratings will appear here when they’re available.</p> : <>
      {!loading && !error && <div className="review-summary">{Number(stats.rating_count) > 0 ? <><strong>{Number(stats.average_rating).toFixed(1)}<small>out of 5</small></strong><span><Stars rating={Number(stats.average_rating)} /><span className="review-count">{stats.rating_count} {Number(stats.rating_count) === 1 ? 'rating' : 'ratings'} · {stats.review_count} {Number(stats.review_count) === 1 ? 'review' : 'reviews'}</span></span></> : <p>No ratings yet. Be the first to rate {project.shortTitle}.</p>}</div>}
      <form className="review-form" onSubmit={submit} aria-label={`Review ${project.shortTitle}`}>
        <fieldset disabled={saving}><legend>Your rating <span>(optional)</span></legend><div className="review-rate">{[1, 2, 3, 4, 5].map(n => <label key={n} className={rating >= n ? 'filled' : ''}><input type="radio" name={`rating-${project.id}`} value={n} checked={rating === n} onChange={() => setRating(n)} aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`} /><Star size={25} fill={rating >= n ? 'currentColor' : 'none'} aria-hidden="true" /></label>)}{rating > 0 && <button type="button" className="review-text-button" onClick={() => setRating(0)}>Clear</button>}</div></fieldset>
        <label className="review-field">Name <span>(optional)</span><input name="author" autoComplete="nickname" maxLength={60} value={author} onChange={e => setAuthor(e.target.value)} placeholder="Guest" disabled={saving} /></label>
        <label className="review-field">Your review <textarea name="review" maxLength={2000} rows={3} value={body} onChange={e => setBody(e.target.value)} placeholder={`What do you think of ${project.shortTitle}?`} disabled={saving} aria-describedby="review-sharing-note" /></label>
        <div className="review-form-footer"><p id="review-sharing-note">Your name, review and rating will be public. Add a rating, a comment, or both.</p><button type="submit" className="review-submit" disabled={saving || (!body.trim() && !rating)}>{saving ? 'Publishing…' : 'Publish review'}</button></div>
        {submitError && <p className="review-error" role="alert">{submitError}</p>}
        <p className="review-notice" role="status">{notice}</p>
      </form>
      {loading && <p className="review-status" role="status">Loading public reviews…</p>}
      {error && <div className="review-error" role="alert">{error} <button type="button" className="review-text-button" onClick={() => setRetry(n => n + 1)}>Retry</button></div>}
      {!loading && !error && reviews.length === 0 && <p className="review-status">No reviews yet. Share your thoughts above.</p>}
      <ol className="review-list" aria-label={`Public reviews for ${project.shortTitle}`}>{reviews.map(review => <li key={review.id}><div className="review-byline"><strong>{review.author}</strong><time dateTime={review.created_at}>{dateLabel(review.created_at)}</time></div>{review.rating && <Stars rating={review.rating} />}{review.body && <p>{review.body}</p>}</li>)}</ol>
      {hasMore && <button type="button" className="review-load-more" onClick={more} disabled={loadingMore || loading || saving}>{loadingMore ? 'Loading…' : 'Show more reviews'}</button>}
    </>}
  </section>;
}
