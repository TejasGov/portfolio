import assert from 'node:assert/strict';
import { mkdirSync, existsSync } from 'node:fs';
import puppeteer from 'puppeteer';
import { projectsData } from '../src/data/projectsData.js';

const output = '/tmp/portfolio-projects';
mkdirSync(`${output}/config`, { recursive: true });
mkdirSync(`${output}/cache`, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'], env: { ...process.env, XDG_CONFIG_HOME: `${output}/config`, XDG_CACHE_HOME: `${output}/cache` } });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const filter = label => page.$$eval('.proj-type-control button', (buttons, label) => buttons.find(b => b.textContent === label).click(), label);
try {
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(process.argv[2] || 'http://127.0.0.1:5173/', { waitUntil: 'networkidle0' });
  await page.click('[aria-label="Open Projects"]');
  await page.waitForSelector('.proj-app-name');
  for (const project of projectsData) {
    await page.click(`[data-project-id="${project.id}"]`);
    assert.equal(await page.$eval('.proj-app-name', e => e.textContent), project.title);
    await page.waitForFunction(() => [...document.querySelectorAll('.proj-tech-icon img')].every(img => img.complete));
    assert.ok(await page.$$eval('.proj-tech-icon img', images => images.every(img => img.naturalWidth > 0)), `${project.id} loads its SVGs`);
    assert.equal(await page.$$eval('.proj-tech-icon img', images => images.length), project.tech.split(', ').length, 'Every listed technology has an actual SVG');
    assert.ok(existsSync(`public${project.image}`), 'Project visual is vendored locally');
  }
  for (const [type, label] of [['games', 'Games'], ['ai', 'AI & ML'], ['web', 'Web apps']]) {
    await filter(label);
    const ids = await page.$$eval('.proj-sb-row', rows => rows.map(r => r.dataset.projectId));
    assert.deepEqual(ids, projectsData.filter(p => p.type === type).map(p => p.id));
    if (ids.length) {
      await page.focus('.proj-sb-row'); await page.keyboard.press('End');
      assert.equal(await page.$eval('.proj-sb-row.on', e => e.dataset.projectId), ids.at(-1));
      await page.keyboard.press('Home');
      assert.equal(await page.$eval('.proj-sb-row.on', e => e.dataset.projectId), ids[0]);
    } else assert.ok(await page.$('.proj-empty'), 'Empty type has a recovery action');
  }
  await filter('All');
  await page.click('[data-project-id="revere"]');
  await filter('AI & ML');
  assert.match(await page.$eval('.proj-app-name', e => e.textContent), /Revere/);
  console.log('PASS exact type filters, retained selection, keyboard navigation and all local SVGs');
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewport(viewport);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.click('[aria-label="Open Projects"]');
    await page.waitForSelector('.proj-app-name');
    for (const dark of [false, true]) {
      await page.evaluate(dark => document.body.classList.toggle('dark-mode', dark), dark);
      await filter('All');
      await page.$eval('[data-project-id="cognifight"]', e => e.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
      await page.click('[data-project-id="cognifight"]');
      const bounds = await page.$eval('.proj-root', e => ({ width: e.clientWidth, scroll: e.scrollWidth }));
      assert.ok(bounds.scroll <= bounds.width, 'Project layout does not overflow horizontally');
      await page.$eval('.proj-section [aria-label="Technology stack"]', e => e.scrollIntoView({ block: 'center' }));
      await page.screenshot({ path: `${output}/stack-${viewport.width}-${dark ? 'dark' : 'light'}.png` });
      assert.ok(await page.$eval('.proj-type-control', e => e.getBoundingClientRect().right) <= viewport.width);
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS desktop, 390px, 320px, landscape, both themes and no uncaught errors');
} finally { await browser.close(); }
