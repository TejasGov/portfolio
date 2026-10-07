import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer';

const output = process.env.PORTFOLIO_CHECK_OUTPUT || '/tmp/portfolio-review';
mkdirSync(`${output}/config`, { recursive: true });
mkdirSync(`${output}/cache`, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
  env: { ...process.env, XDG_CONFIG_HOME: `${output}/config`, XDG_CACHE_HOME: `${output}/cache` },
});
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.evaluateOnNewDocument(() => {
    window.galaxyDraws = 0;
    for (const type of [WebGLRenderingContext, WebGL2RenderingContext]) {
      for (const name of ['drawArrays', 'drawElements']) {
        const original = type.prototype[name];
        type.prototype[name] = function (...args) {
          if (this.canvas.closest('.galaxy-wrapper')) window.galaxyDraws++;
          return original.apply(this, args);
        };
      }
    }
  });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(process.argv[2] || 'http://127.0.0.1:5173/', { waitUntil: 'networkidle0' });
  await page.click('[aria-label="Open My Sound"]');
  await page.waitForSelector('.music-nav');
  await page.click('.music-nav-item:last-child');
  await page.waitForSelector('.galaxy-card');
  await pause(1500);
  assert.deepEqual(errors, []);
  const initial = await page.evaluate(() => window.galaxyDraws);
  await pause(500);
  assert.ok(await page.evaluate(() => window.galaxyDraws) > initial);
  await page.click('[aria-label="Minimize My Sound"]');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-window="my-sound"]')).visibility === 'hidden');
  await pause(500);
  const hidden = await page.evaluate(() => window.galaxyDraws);
  await pause(500);
  assert.equal(await page.evaluate(() => window.galaxyDraws), hidden);
  await page.click('[aria-label="Restore On repeat"]');
  await pause(700);
  assert.ok(await page.evaluate(() => window.galaxyDraws) > hidden);
  assert.ok(await page.$('.galaxy-card'));
  assert.deepEqual(errors, []);
  console.log('PASS Artist canvas rendering pauses while minimized and resumes with state retained');
} finally {
  await browser.close();
}
