import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer';

const output = process.env.PORTFOLIO_CHECK_OUTPUT || '/tmp/portfolio-review';
mkdirSync(`${output}/config`, { recursive: true });
mkdirSync(`${output}/cache`, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  env: { ...process.env, XDG_CONFIG_HOME: `${output}/config`, XDG_CACHE_HOME: `${output}/cache` },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const titles = ['Projects', 'Work Ex.', 'Photography', 'My Tech', 'My Niche', 'My Sound', 'My Library'];
const settle = () => new Promise(resolve => setTimeout(resolve, 350));
const closeWindow = async () => {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.window-modal'));
};
const openFolder = async title => {
  await page.$eval(`[aria-label="Open ${title}"]`, element => element.scrollIntoView({ block: 'center' }));
  await page.click(`[aria-label="Open ${title}"]`);
  await page.waitForFunction(() => document.querySelector('.window-content') && !document.querySelector('.window-loading'));
  await settle();
};
const loadedPortrait = () => page.waitForFunction(() => {
  const image = document.querySelector('.about-portrait img');
  return image?.complete && image.naturalWidth > 0;
});

try {
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(process.argv[2] || 'http://127.0.0.1:5173/', { waitUntil: 'networkidle0' });
  for (const title of titles) {
    await openFolder(title);
    if (title === 'Projects') {
      const rows = await page.$$('.proj-sb-row');
      for (const row of rows) {
        await row.click();
        await page.waitForFunction(() => {
          const image = document.querySelector('.proj-visual img');
          return image?.complete && image.naturalWidth > 0;
        });
      }
      await rows[0].click();
      assert.equal(await page.$eval('.proj-btn-primary', e => e.getAttribute('href')), 'https://smash-cricket.vercel.app/');
    }
    if (title === 'Work Ex.') {
      await page.click('[aria-label="List view"]');
      await page.waitForSelector('.sb-row[role="button"]');
      const row = await page.$('.sb-row[role="button"]');
      await row.focus();
      await page.keyboard.press('Enter');
      assert.equal(await row.evaluate(e => e.getAttribute('aria-pressed')), 'true');
    }
    if (title === 'Photography') {
      await page.click('[aria-label="Open photo 1"]');
      await page.waitForSelector('[aria-label="Close photo preview"]');
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('[role="dialog"][aria-label^="Photo 2 of"]'));
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('[aria-label="Close photo preview"]'));
      assert.ok(await page.$('[data-window="photography"]'));
    }
    if (title === 'My Tech') {
      await page.focus('[aria-label="Explore AirPods Max"]');
      await page.keyboard.press('Enter');
      await page.waitForSelector('#tech-inspector');
      assert.match(await page.$eval('#tech-inspector', e => e.textContent), /Spatial audio/);
      await page.click('[aria-label="Email"]');
      await page.waitForSelector('dialog[open]');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('dialog[open]'));
      assert.ok(await page.$('#tech-inspector'));
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#tech-inspector'));
      assert.ok(await page.$('[data-window="my-tech"]'));
    }
    await page.screenshot({ path: `${output}/module-${title.replaceAll(' ', '-')}.png` });
    await closeWindow();
    console.log(`PASS ${title}`);
  }
  await page.click('[aria-label="About Me"]');
  await page.waitForSelector('.about-profile');
  await loadedPortrait();
  assert.equal(await page.$eval('.window-content', e => e.scrollHeight > e.clientHeight), true);
  await page.$eval('.window-content', e => { e.scrollTop = e.scrollHeight; });
  await page.screenshot({ path: `${output}/about-footer.png` });
  await closeWindow();

  await page.setViewport({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle0' });
  for (const title of titles) {
    await openFolder(title);
    assert.equal(await page.$eval('.window-content', e => e.scrollWidth <= e.clientWidth), true, `${title} phone overflow`);
    if (title === 'My Tech') {
      const initialScale = await page.$eval('.tech-canvas', e => Number(e.dataset.scale));
      const fits = await page.$eval('.tech-canvas', e => {
        const diagram = e.getBoundingClientRect();
        const viewport = e.parentElement.getBoundingClientRect();
        return diagram.left >= viewport.left && diagram.right <= viewport.right && diagram.top >= viewport.top && diagram.bottom <= viewport.bottom;
      });
      assert.equal(fits, true, 'Entire equipment diagram fits phone');
      await page.click('[aria-label="Zoom in on setup"]');
      assert.ok(await page.$eval('.tech-canvas', e => Number(e.dataset.scale)) > initialScale);
      await page.click('[aria-label="Fit setup to window"]');
      assert.equal(await page.$eval('.tech-canvas', e => Number(e.dataset.scale)), initialScale);
      await page.select('[aria-label="Explore equipment"]', 'headphones');
      await page.waitForSelector('#tech-inspector');
      await page.screenshot({ path: `${output}/phone-equipment-details.png` });
      await page.click('[aria-label="Close equipment details"]');
    }
    await page.screenshot({ path: `${output}/phone-${title.replaceAll(' ', '-')}.png` });
    await closeWindow();
  }
  await page.click('[aria-label="About Me"]');
  await page.waitForSelector('.about-profile');
  await loadedPortrait();
  assert.equal(await page.$eval('.window-content', e => e.scrollHeight > e.clientHeight), true);
  assert.equal(await page.$eval('.about-profile', e => e.scrollWidth <= e.clientWidth), true);
  await settle();
  await page.screenshot({ path: `${output}/about-mobile.png` });
  console.log('PASS all folder apps and About on phone');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'passed', uncaughtErrors: errors, screenshots: output }));
} finally {
  await browser.close();
}
