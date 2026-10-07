import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer';

const output = process.env.PORTFOLIO_CHECK_OUTPUT || '/tmp/portfolio-macos';
mkdirSync(`${output}/config`, { recursive: true });
mkdirSync(`${output}/cache`, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'], env: { ...process.env, XDG_CONFIG_HOME: `${output}/config`, XDG_CACHE_HOME: `${output}/cache` } });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(process.argv[2] || 'http://127.0.0.1:5173/', { waitUntil: 'networkidle0' });
  await page.click('[aria-label="Open Spotlight"]');
  await page.waitForSelector('dialog.search-dialog[open]');
  assert.ok(await page.$eval('.search-dialog', e => e.getBoundingClientRect().height) < 90, 'Empty Spotlight is a search field');
  assert.equal(await page.evaluate(() => document.activeElement.placeholder), 'Spotlight Search');
  await page.screenshot({ path: `${output}/spotlight-empty.png` });
  await page.type('input[role="combobox"]', 'my');
  const first = await page.$eval('input', e => e.getAttribute('aria-activedescendant'));
  await page.keyboard.press('ArrowDown');
  assert.notEqual(await page.$eval('input', e => e.getAttribute('aria-activedescendant')), first);
  assert.equal(await page.$$eval('.search-results [aria-selected="true"]', e => e.length), 1);
  await page.screenshot({ path: `${output}/spotlight-results.png` });
  await page.keyboard.press('Escape');
  assert.ok(await page.$('dialog.search-dialog[open]'), 'First Escape clears the query');
  assert.equal(await page.$eval('input[role="combobox"]', e => e.value), '');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Open Spotlight');
  console.log('PASS native Spotlight shape, keyboard selection, Escape clear/close and focus recovery');

  await page.keyboard.down('Meta'); await page.keyboard.press('Space'); await page.keyboard.up('Meta');
  await page.waitForSelector('input[role="combobox"]');
  await page.keyboard.press('Escape');
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewport(viewport);
    await page.click('[aria-label="Search the portfolio"]');
    await page.type('input[role="combobox"]', 'my');
    const bounds = await page.$eval('.search-dialog', e => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, bottom: r.bottom }; });
    const footer = await page.$eval('.search-footer', e => e.getBoundingClientRect().bottom);
    assert.ok(bounds.left >= 0 && bounds.right <= viewport.width && bounds.bottom <= viewport.height);
    assert.ok(footer <= bounds.bottom, 'Footer remains visible in short landscape');
    await page.screenshot({ path: `${output}/spotlight-${viewport.width}.png` });
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  }
  console.log('PASS Command-Space and responsive Spotlight results');

  await page.setViewport({ width: 1440, height: 1000 });
  await page.click('[aria-label="About Me"]');
  await page.waitForFunction(() => document.querySelector('.about-answer-text [aria-hidden="true"]')?.textContent.length > 15);
  assert.equal(await page.$('.window-switcher'), null, 'Visible windows have no duplicate floating tabs');
  await page.click('[aria-label="Minimize About Me"]');
  const before = await page.$eval('.about-answer-text [aria-hidden="true"]', e => e.textContent);
  await wait(250);
  assert.equal(await page.$eval('.about-answer-text [aria-hidden="true"]', e => e.textContent), before, 'Typing pauses while minimized');
  await page.click('[aria-label="Restore About"]');
  await page.waitForFunction(text => document.querySelector('.about-answer-text [aria-hidden="true"]').textContent !== text, {}, before);
  await page.click('.about-answer-label button');
  await page.waitForSelector('.about-portrait img');
  await page.$eval('.about-prompts button', e => e.click());
  await page.waitForFunction(() => document.querySelectorAll('.about-turn').length === 2);
  await page.waitForFunction(() => document.querySelector('.about-turn:last-child .about-answer-text [aria-hidden="true"]')?.textContent.length > 30);
  await page.screenshot({ path: `${output}/about-conversation.png` });
  await page.click('.about-read-all');
  await page.waitForFunction(() => document.querySelectorAll('.about-turn').length === 8);
  assert.equal(await page.$eval('.about-thread', e => e.scrollHeight > e.clientHeight), true);
  await page.click('[aria-label="Replay About conversation"]');
  assert.equal(await page.$$eval('.about-turn', e => e.length), 1);
  console.log('PASS About typing, paused minimize/restore, topic selection, read-all and replay');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('[data-window="about"]'));

  await page.click('[aria-label="Open Projects"]');
  await page.waitForSelector('.proj-app-name');
  await page.click('[aria-label="Minimize Projects"]');
  await page.click('[aria-label="About Me"]');
  await page.waitForSelector('.about-chat-footer');
  const spacing = await page.evaluate(() => ({ windowBottom: document.querySelector('[data-window="about"]').getBoundingClientRect().bottom, switcherTop: document.querySelector('.window-switcher').getBoundingClientRect().top }));
  assert.ok(spacing.windowBottom <= spacing.switcherTop, 'Minimized-window controls do not cover active app footers');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('[data-window="about"]'));
  await page.click('[aria-label="Restore Projects"]');
  await page.waitForFunction(() => document.activeElement?.closest('[data-window="projects"]'));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('[data-window="projects"]'));
  console.log('PASS minimized-window recovery without footer overlap');

  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewport(viewport);
    await page.click('[aria-label="About Me"]');
    await page.waitForSelector('.about-read-all');
    await page.click('.about-read-all');
    assert.equal(await page.$eval('.about-profile', e => e.scrollWidth <= e.clientWidth), true);
    assert.ok(await page.$eval('.about-chat-footer', e => e.getBoundingClientRect().bottom) <= viewport.height);
    await page.screenshot({ path: `${output}/about-${viewport.width}.png` });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[data-window="about"]'));
  }
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.click('[aria-label="About Me"]');
  await page.waitForSelector('.about-portrait');
  assert.equal(await page.$('.streamed-text[data-streaming="true"]'), null);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('[data-window="about"]'));
  console.log('PASS phone conversation scrolling and immediate reduced-motion answers');

  await page.evaluate(() => { window.micRequests = 0; navigator.mediaDevices.getUserMedia = () => { window.micRequests++; return Promise.reject(new DOMException('Permission denied', 'NotAllowedError')); }; });
  await page.click('[aria-label="Orb"]');
  await page.waitForSelector('.siri-dialog[open]');
  assert.equal(await page.evaluate(() => window.micRequests), 0, 'Opening Orb does not start the microphone');
  await page.screenshot({ path: `${output}/voice-orb.png` });
  await page.click('.siri-talk');
  await page.waitForSelector('.siri-error', { timeout: 30000 });
  assert.equal(await page.$eval('.siri-talk', e => e.disabled), false, 'Connection errors allow retry');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  console.log('PASS explicit microphone start, connection failure feedback, retry and dismissal');
  assert.deepEqual(errors, []);
  console.log(`PASS no uncaught errors; screenshots in ${output}`);
} finally { await browser.close(); }
