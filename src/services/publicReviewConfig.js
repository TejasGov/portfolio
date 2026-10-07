export function isPublicReviewKey(key) {
  if (key.startsWith('sb_publishable_')) return true;
  try {
    return JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon';
  } catch { return false; }
}
