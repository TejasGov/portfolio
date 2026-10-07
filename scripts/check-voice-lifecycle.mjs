import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import puppeteer from 'puppeteer';

// Use the actual ElevenLabs provider/hooks with a deterministic transport.
// This private test server never changes the application's production config.
const root = fileURLToPath(new URL('..', import.meta.url));
const temporary = mkdtempSync(`${tmpdir()}/portfolio-voice-`);
const clientPath = `${root}/node_modules/@elevenlabs/client/dist/index.js`;
const mockId = '\0portfolio-voice-transport';
const server = await createServer({
  root, configFile: false, logLevel: 'error', cacheDir: `${temporary}/vite-cache`,
  plugins: [react(), {
    name: 'voice-transport-check',
    enforce: 'pre',
    resolveId(source) { if (source === '@elevenlabs/client') return mockId; },
    load(id) {
      if (id !== mockId) return;
      return `
        export * from ${JSON.stringify(clientPath)};
        import { Conversation } from ${JSON.stringify(clientPath)};
        export { Conversation };
        const test = window.__voiceTest = { starts: 0, pending: [], sessions: [] };
        Conversation.startSession = options => {
          test.starts++;
          options.onStatusChange?.({ status: 'connecting' });
          return new Promise((resolve, reject) => {
            test.pending.push({ options, resolve, reject });
          });
        };
        test.connect = () => {
          const { options, resolve } = test.pending.shift();
          const session = {
            muted: null, ended: false,
            setMicMuted(value) { this.muted = value; },
            getInputVolume() { return .4; }, getOutputVolume() { return .6; },
            async endSession() {
              if (this.ended) return;
              this.ended = true;
              options.onStatusChange?.({ status: 'disconnecting' });
              options.onStatusChange?.({ status: 'disconnected' });
              options.onDisconnect?.({ reason: 'user' });
            },
            message(role, text, eventId) { options.onMessage?.({ role, message: text, event_id: eventId }); },
          };
          test.sessions.push(session);
          options.onConversationCreated?.(session);
          options.onStatusChange?.({ status: 'connected' });
          options.onConnect?.({ conversationId: 'test' });
          resolve(session);
        };
        test.deny = () => {
          const { options, reject } = test.pending.shift();
          options.onStatusChange?.({ status: 'disconnected' });
          reject(new DOMException('Permission denied', 'NotAllowedError'));
        };
      `;
    },
  }],
  optimizeDeps: { exclude: ['@elevenlabs/react', '@elevenlabs/client'] },
  server: { host: '127.0.0.1', port: 0 },
});
await server.listen();
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'], env: { ...process.env, XDG_CONFIG_HOME: `${temporary}/config`, XDG_CACHE_HOME: `${temporary}/cache` } });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`, { waitUntil: 'networkidle0' });
  await page.click('[aria-label="Orb"]');
  assert.equal(await page.evaluate(() => window.__voiceTest.starts), 0);
  await page.click('.siri-talk');
  assert.equal(await page.evaluate(() => window.__voiceTest.starts), 1);
  assert.equal(await page.$eval('.siri-talk', e => e.disabled), true);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__voiceTest.connect());
  await page.waitForFunction(() => window.__voiceTest.sessions[0].ended);
  assert.equal(await page.$('.siri-dialog'), null);
  console.log('PASS no automatic voice start; close during connection ends the eventual session');

  await page.click('[aria-label="Orb"]');
  await page.click('.siri-talk');
  await page.evaluate(() => window.__voiceTest.deny());
  await page.waitForSelector('.siri-error');
  assert.match(await page.$eval('.siri-error', e => e.textContent), /Microphone access was denied/);
  assert.equal(await page.$eval('.siri-talk', e => e.disabled), false);
  await page.click('.siri-talk');
  await page.evaluate(() => window.__voiceTest.connect());
  await page.waitForSelector('[aria-label="Hold to talk"]');
  await page.waitForFunction(() => window.__voiceTest.sessions.at(-1).muted === true);
  await page.focus('[aria-label="Hold to talk"]');
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.__voiceTest.sessions.at(-1).muted === false);
  await page.keyboard.up('Space');
  await page.waitForFunction(() => window.__voiceTest.sessions.at(-1).muted === true);
  await page.keyboard.down('Enter');
  await page.waitForFunction(() => window.__voiceTest.sessions.at(-1).muted === false);
  await page.keyboard.up('Enter');
  await page.waitForFunction(() => window.__voiceTest.sessions.at(-1).muted === true);
  console.log('PASS asynchronous permission denial, retry, and keyboard push-to-talk release');

  const button = await page.$('[aria-label="Hold to talk"]');
  const bounds = await button.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.waitForFunction(() => window.__voiceTest.sessions.at(-1).muted === false);
  await page.mouse.move(20, 900);
  await page.mouse.up();
  await page.waitForFunction(() => window.__voiceTest.sessions.at(-1).muted === true);
  await page.focus('[aria-label="Hold to talk"]');
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.__voiceTest.sessions.at(-1).muted === false);
  await page.focus('[aria-label="End conversation"]');
  await page.waitForFunction(() => window.__voiceTest.sessions.at(-1).muted === true);
  await page.keyboard.up('Space');
  console.log('PASS pointer capture release and focus-loss microphone mute');

  await page.evaluate(() => {
    const session = window.__voiceTest.sessions.at(-1);
    session.message('user', 'What has Tejas built?', 1);
    session.message('agent', 'Tejas builds interfaces, machine learning projects, and games.', 2);
    session.message('agent', 'Tejas builds interfaces, machine learning projects, and games.', 2);
  });
  await page.waitForSelector('.siri-message.agent .streamed-text[data-streaming="false"]');
  assert.equal(await page.$$eval('.siri-message', e => e.length), 2, 'Repeated event IDs do not duplicate transcript messages');
  assert.match(await page.$eval('.siri-message.agent', e => e.textContent), /machine learning projects/);
  await page.click('[aria-label="End conversation"]');
  await page.waitForFunction(() => window.__voiceTest.sessions.at(-1).ended);
  await page.waitForFunction(() => document.querySelector('.siri-status')?.textContent === 'Conversation ended');
  assert.deepEqual(errors, []);
  console.log('PASS received transcripts, typed responses, event deduplication, end-session and no uncaught errors');
} finally { await browser.close(); await server.close(); }
