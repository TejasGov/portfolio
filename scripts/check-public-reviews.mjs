import assert from 'node:assert/strict';
import { createServer as httpServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import puppeteer from 'puppeteer';

const output = '/tmp/portfolio-public-reviews';
mkdirSync(`${output}/config`, { recursive: true }); mkdirSync(`${output}/cache`, { recursive: true });
const key = 'sb_publishable_portfolio_fixture';
const records = Array.from({ length: 13 }, (_, i) => ({ id: `fixture-${i}`, project_id: 'cosmos', author: `Reader ${i + 1}`, body: `Sample for this private test ${i + 1}`, rating: 4, created_at: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString() }));
let failRead = false, failSave = false, saves = 0, nextId = 1;
const database = httpServer(async (req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey,content-type,prefer,authorization', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Content-Type': 'application/json' };
  const respond = (status, data) => { res.writeHead(status, cors); res.end(JSON.stringify(data)); };
  if (req.method === 'OPTIONS') return respond(200, {});
  assert.equal(req.headers.apikey, key); assert.equal(req.headers.authorization, undefined, 'Publishable keys are not used as JWTs');
  const url = new URL(req.url, 'http://fixture');
  if (req.method === 'GET') {
    if (failRead) { failRead = false; return respond(503, {}); }
    const projectId = url.searchParams.get('project_id')?.replace(/^eq\./, '');
    const rows = records.filter(r => r.project_id === projectId);
    if (url.pathname.endsWith('project_review_stats')) {
      const ratings = rows.filter(r => r.rating !== null);
      return respond(200, rows.length ? [{ average_rating: ratings.length ? ratings.reduce((n, r) => n + r.rating, 0) / ratings.length : null, rating_count: ratings.length, review_count: rows.length }] : []);
    }
    const offset = Number(url.searchParams.get('offset')), limit = Number(url.searchParams.get('limit'));
    return respond(200, rows.toSorted((a, b) => b.created_at.localeCompare(a.created_at)).slice(offset, offset + limit));
  }
  if (req.method === 'POST') {
    let raw = ''; for await (const chunk of req) raw += chunk;
    if (failSave) { failSave = false; return respond(503, {}); }
    const body = JSON.parse(raw);
    assert.deepEqual(Object.keys(body).sort(), ['author', 'body', 'project_id', 'rating']);
    await new Promise(resolve => setTimeout(resolve, 200));
    saves++;
    const row = { ...body, id: `published-${nextId++}`, created_at: new Date().toISOString() }; records.push(row);
    return respond(201, [row]);
  }
  respond(404, {});
});
await new Promise(resolve => database.listen(0, '127.0.0.1', resolve));
const api = `http://127.0.0.1:${database.address().port}`;
const vite = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)), configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)),
  cacheDir: `${output}/vite-cache`, logLevel: 'error',
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://reviews.portfolio.test'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(key) },
  server: { host: '127.0.0.1', port: 5190, strictPort: true },
});
let browser;
const errors = [];
try {
  await vite.listen();
  browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'], env: { ...process.env, XDG_CONFIG_HOME: `${output}/config`, XDG_CACHE_HOME: `${output}/cache` } });
  const visitor = async () => {
    const context = await browser.createBrowserContext(); const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({ width: 1440, height: 1000 });
    await page.setRequestInterception(true);
    page.on('request', async req => {
      if (!req.url().startsWith('https://reviews.portfolio.test/')) return req.continue();
      try {
        const url = new URL(req.url());
        const response = await fetch(`${api}${url.pathname}${url.search}`, { method: req.method(), headers: req.headers(), body: ['POST', 'PUT'].includes(req.method()) ? req.postData() : undefined });
        await req.respond({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
      } catch { await req.abort(); }
    });
    await page.goto('http://127.0.0.1:5190/', { waitUntil: 'domcontentloaded' });
    await page.click('[aria-label="Open Projects"]'); await page.waitForSelector('.proj-app-name');
    return page;
  };
  const choose = async (page, id) => {
    await page.$eval(`[data-project-id="${id}"]`, e => e.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
    await page.click(`[data-project-id="${id}"]`);
    await page.waitForFunction(() => !document.querySelector('.review-status')?.textContent.includes('Loading'));
    await page.$eval('.proj-reviews', e => e.scrollIntoView({ block: 'start' }));
  };
  const first = await visitor();
  await choose(first, 'revere');
  assert.match(await first.$eval('.review-summary', e => e.textContent), /No ratings yet/);
  failRead = true;
  await first.click('.review-heading button'); await first.waitForSelector('.review-error');
  await first.$eval('.review-error button', e => e.click());
  await first.waitForFunction(() => !document.querySelector('.review-error') && !document.querySelector('.review-status')?.textContent.includes('Loading'));
  await first.click('input[aria-label="1 star"]'); await first.keyboard.press('ArrowRight');
  assert.equal(await first.$eval('input[aria-label="2 stars"]', e => e.checked), true, 'Native star radio keyboard control');
  await first.click('input[aria-label="5 stars"]');
  await first.type('input[name="author"]', 'Visitor One');
  const text = '<img src=x onerror="window.reviewInjected=true"> Really enjoyed this project.';
  await first.type('textarea[name="review"]', text);
  failSave = true;
  await first.click('.review-submit'); await first.waitForSelector('.review-form .review-error');
  assert.equal(await first.$eval('textarea', e => e.value), text);
  assert.equal(await first.$eval('input[aria-label="5 stars"]', e => e.checked), true);
  assert.equal(await first.$eval('input[name="author"]', e => e.value), 'Visitor One');
  await first.$eval('.review-form', e => { e.requestSubmit(); e.requestSubmit(); });
  await first.waitForFunction(() => document.querySelector('.review-notice')?.textContent.includes('published'));
  await first.waitForFunction(() => document.querySelector('.review-list li p')?.textContent.includes('Really enjoyed'));
  assert.equal(saves, 1, 'Double submission sends one write');
  assert.equal(await first.$eval('textarea', e => e.value), '');
  assert.equal(await first.evaluate(() => window.reviewInjected), undefined);
  assert.equal(await first.$('.review-list img'), null, 'Submitted HTML is escaped');
  const second = await visitor(); await choose(second, 'revere');
  assert.equal(await second.$eval('.review-list li p', e => e.textContent), text, 'Independent visitor reads the shared record');
  await second.reload({ waitUntil: 'domcontentloaded' }); await second.click('[aria-label="Open Projects"]'); await second.waitForSelector('.proj-app-name'); await choose(second, 'revere');
  assert.equal(await second.$$eval('.review-list li', e => e.length), 1, 'Shared feedback survives a visitor reload');
  await second.click('input[aria-label="3 stars"]'); await second.click('.review-submit');
  await second.waitForFunction(() => document.querySelector('.review-count')?.textContent.includes('2 ratings'));
  assert.equal(await second.$eval('.review-summary strong', e => e.firstChild.textContent), '4.0');
  await first.click('.review-heading button'); await first.waitForFunction(() => document.querySelector('.review-count')?.textContent.includes('2 ratings'));
  console.log('PASS independent visitors, persistence, real summary, star keyboard, failed-save recovery and duplicate-click prevention');
  await choose(second, 'cosmos');
  await second.waitForFunction(() => document.querySelectorAll('.review-list li').length === 10);
  assert.match(await second.$eval('.review-count', e => e.textContent), /13 ratings/);
  await second.$eval('.review-load-more', e => e.click()); await second.waitForFunction(() => document.querySelectorAll('.review-list li').length === 13);
  assert.equal(await second.$('.review-load-more'), null);
  await choose(second, 'commit-city');
  assert.equal(await second.$$eval('.review-list li', e => e.length), 0, 'Reviews belong to their project');
  await second.type('textarea', 'Comment without stars'); await second.click('.review-submit');
  await second.waitForFunction(() => document.querySelector('.review-list li p')?.textContent === 'Comment without stars');
  assert.match(await second.$eval('.review-summary', e => e.textContent), /No ratings yet/);
  assert.equal(records.find(r => r.project_id === 'commit-city').rating, null);
  console.log('PASS complete aggregates beyond one page, pagination, project isolation and comment-only reviews');
  for (const width of [390, 320]) {
    await second.setViewport({ width, height: 844 });
    for (const dark of [false, true]) {
      await second.evaluate(dark => document.body.classList.toggle('dark-mode', dark), dark);
      await second.$eval('.review-form', e => e.scrollIntoView({ block: 'center' }));
      assert.ok(await second.$eval('.proj-detail', e => e.scrollWidth <= e.clientWidth));
      await second.screenshot({ path: `${output}/reviews-${width}-${dark ? 'dark' : 'light'}.png` });
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS mobile review layout in both themes and no uncaught errors');
} finally {
  await browser?.close(); await vite.close(); await new Promise(resolve => database.close(resolve));
}
