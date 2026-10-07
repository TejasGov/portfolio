import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer';

const url = process.argv[2] || 'http://127.0.0.1:5173/';
const output = process.env.PORTFOLIO_CHECK_OUTPUT || '/tmp/portfolio-review';
mkdirSync(output, { recursive: true });
mkdirSync(`${output}/config`, { recursive: true });
mkdirSync(`${output}/cache`, { recursive: true });
const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'], env: { ...process.env, XDG_CONFIG_HOME: `${output}/config`, XDG_CACHE_HOME: `${output}/cache` } });
const errors = [];
const checks = [];
const record = message => { checks.push(message); console.log(`PASS ${message}`); };
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  assert.match(await page.$eval('h1', e => e.textContent), /Hi, I’m Tejas/);
  assert.equal(await page.$$eval('.desktop-icons-grid button', items => items.length), 7);
  await page.screenshot({ path: `${output}/home-desktop.png` });
  record('macOS desktop identity and seven Finder folders');

  await page.click('[aria-label="Control Center"]');
  await page.click('[aria-label="Pause background video"]');
  assert.equal(await page.$eval('video', e => e.paused), true);
  await page.reload({ waitUntil: 'networkidle0' });
  assert.equal(await page.$eval('video', e => e.paused), true);
  await page.click('[aria-label="Control Center"]');
  await page.click('[aria-label="Play background video"]');
  await page.click('[aria-label="Control Center"]');
  await page.waitForFunction(() => !document.querySelector('video').paused);
  record('Background video pause/play and persisted preference');

  await page.click('[aria-label="Open Projects"]');
  await page.waitForSelector('.proj-app-name');
  await page.click('[aria-label="Minimize Projects"]');
  await page.waitForFunction(() => !document.querySelector('.window-modal'));
  await page.click('[aria-label="Restore Projects"]');
  await page.waitForSelector('.proj-app-name');
  record('Project window minimize and restore');
  await page.click('[aria-label="Email"]');
  await page.waitForSelector('dialog[open]');
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.querySelector('dialog[open]').contains(document.activeElement)), true);
  }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  assert.equal(await page.$$eval('.window-modal', windows => windows.length), 1);
  await page.$eval('.window-modal', e => e.focus());
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.window-modal'));
  record('Native dialog focus containment and Escape isolation');

  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
  await page.waitForSelector('input[role="combobox"]');
  await page.type('input[role="combobox"]', 'zz-no-such-destination');
  assert.match(await page.$eval('.search-empty', e => e.textContent), /No matches/);
  await page.focus('input[role="combobox"]');
  await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.type('input[role="combobox"]', 'contact');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.contact-email');
  assert.equal(await page.$eval('.contact-email a', e => e.getAttribute('href')), 'mailto:tejasgov2005@gmail.com');
  await page.keyboard.press('Escape');
  record('Search keyboard navigation, empty state and actual contact routing');

  if (await page.$('[aria-label="Switch to dark theme"]')) await page.click('[aria-label="Switch to dark theme"]');
  await page.click('[aria-label="Switch to light theme"]');
  assert.equal(await page.evaluate(() => document.body.classList.contains('dark-mode')), false);
  await page.reload({ waitUntil: 'networkidle0' });
  assert.equal(await page.evaluate(() => document.body.classList.contains('dark-mode')), false);
  await page.screenshot({ path: `${output}/home-light.png` });
  await page.click('[aria-label="Switch to dark theme"]');
  record('Theme switching and persistence');

  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewport(viewport);
    await page.reload({ waitUntil: 'networkidle0' });
    assert.equal(await page.$eval('.mac-desktop', e => e.scrollWidth <= e.clientWidth), true);
    await page.$eval('[aria-label="Open Projects"]', e => e.scrollIntoView({ block: 'center' }));
    await page.click('[aria-label="Open Projects"]');
    await page.waitForSelector('.proj-app-name');
    const rect = await page.$eval('.window-modal', e => { const r = e.getBoundingClientRect(); return { x: r.x, right: r.right, bottom: r.bottom }; });
    assert.ok(rect.x >= 0 && rect.right <= viewport.width && rect.bottom <= viewport.height);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.window-modal'));
    await page.screenshot({ path: `${output}/home-${viewport.width}x${viewport.height}.png` });
  }
  record('390px phone, 320px phone and short landscape bounds');

  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.reload({ waitUntil: 'networkidle0' });
  assert.equal(await page.$eval('video', e => e.paused), true);
  await page.click('[aria-label="Control Center"]');
  assert.equal(await page.$eval('[aria-label="Reduced motion enabled"]', e => e.disabled), true);
  record('Reduced motion keeps background still');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'passed', checks, uncaughtErrors: errors, screenshots: output }, null, 2));
} finally { await browser.close(); }
