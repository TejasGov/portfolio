import { isPublicReviewKey } from './publicReviewConfig';

const baseURL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
// Only browser-safe keys belong in a Vite build. Never use a service-role key.
export const reviewsConfigured = /^https:\/\//.test(baseURL) && isPublicReviewKey(publicKey);
export const REVIEW_PAGE_SIZE = 10;

async function request(resource, { signal, ...options } = {}) {
  if (!reviewsConfigured) throw new Error('Public reviews are not connected yet.');
  const headers = { apikey: publicKey, 'Content-Type': 'application/json', ...options.headers };
  if (publicKey.startsWith('eyJ')) headers.Authorization = `Bearer ${publicKey}`;
  const response = await fetch(`${baseURL}/rest/v1/${resource}`, {
    ...options, headers, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(options.method === 'POST' ? 'Your review could not be saved. Please try again.' : 'Reviews could not be loaded. Please try again.');
  return response.json();
}

export async function loadReviews(projectId, { offset = 0, signal } = {}) {
  const query = new URLSearchParams({ project_id: `eq.${projectId}`, select: 'id,author,body,rating,created_at', order: 'created_at.desc,id.desc', limit: String(REVIEW_PAGE_SIZE), offset: String(offset) });
  return request(`project_reviews?${query}`, { signal });
}

export async function loadReviewStats(projectId, { signal } = {}) {
  const query = new URLSearchParams({ project_id: `eq.${projectId}`, select: 'average_rating,rating_count,review_count' });
  const rows = await request(`project_review_stats?${query}`, { signal });
  return rows[0] || { average_rating: null, rating_count: 0, review_count: 0 };
}

export async function saveReview(projectId, { author, body, rating }) {
  const rows = await request('project_reviews', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ project_id: projectId, author: author.trim() || 'Guest', body: body.trim(), rating: rating || null }),
  });
  if (!rows[0]?.id) throw new Error('The database did not confirm your review. Please try again.');
  return rows[0];
}
