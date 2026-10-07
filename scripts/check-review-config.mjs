import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { isPublicReviewKey } from '../src/services/publicReviewConfig.js';

const jwt = role => `eyJfixture.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.fixture`;
assert.ok(isPublicReviewKey('sb_publishable_test'));
assert.ok(isPublicReviewKey(jwt('anon')));
assert.equal(isPublicReviewKey(jwt('service_role')), false);
assert.equal(isPublicReviewKey('sb_secret_test'), false);
const original = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
try {
  for (const key of ['sb_secret_test', jwt('service_role')]) {
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = key;
    await assert.rejects(createServer({ configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)), cacheDir: '/tmp/portfolio-review-config-cache', logLevel: 'silent', server: { middlewareMode: true } }), error => {
      assert.match(error.message, /must never enter a browser build/);
      assert.ok(!error.message.includes(key), 'Configuration errors do not print the key');
      return true;
    });
  }
  console.log('PASS browser-safe key formats and privileged-key rejection before bundle generation');
} finally {
  if (original === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = original;
}
