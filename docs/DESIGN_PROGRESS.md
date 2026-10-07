# Design elevation — durable checkpoint

## Goal
Audit and elevate the portfolio in verified, resumable parts. Keep existing content destinations, add the supplied cloud video and restrained dither treatment, and improve usability without losing the playful personal-workspace idea.

## Baseline audit
- Identity and primary work are hidden behind a desktop metaphor; the homepage needs a clear introduction and useful first action.
- The colorful wallpaper, folder gradients, glass surfaces and many unrelated component styles compete for attention.
- Forced boot animation delays every visit. Biography content is gated by a simulated typing conversation.
- Clickable list items, divs and icons lack keyboard behavior; windows lack usable controls and focus lifecycle.
- Resume has no document/action. Search advertises unfinished certificate/contact/voice placeholder windows.
- Project star ratings and placeholder screenshots undermine credibility; use factual project content and real assets.
- Phone/short-screen layouts clip because the homepage has fixed positioning and disabled scrolling.
- Search has no suggestions or empty state. Minimized windows have no clear recovery mechanism.
- Motion preferences, background-video pause/fallback, clipboard errors and external-service failure feedback need explicit handling.

## Visual direction
An editorial personal workspace: charcoal and warm ivory, one chartreuse accent, expressive serif paired with a clean sans, fine rules, clear hierarchy, atmospheric monochrome clouds and restrained halftone/dither texture. Content remains the focus. Desktop keeps floating windows; mobile becomes readable, scrollable sheets.

## Stages
1. **Audit and foundation — complete:** baseline screenshots/video inspected; asset optimization, typography, tokens and motion preferences.
2. **Home and navigation — complete:** persistent identity, clear work/about/contact actions, responsive directory, command bar, window recovery.
3. **Content and interactions — pending:** factual Projects, immediate About, accessible window frame/search/contact, route corrections.
4. **Verification and handoff — pending:** production build; desktop, phone and short-screen screenshots; keyboard/window/search/contact flows; reduced-motion behavior; error inspection.

## Working rules / resume
- Existing checkout: `/workspace/portfolio`; do not reinstall dependencies unnecessarily (this repo tracks macOS node_modules).
- Build: `ESBUILD_BINARY_PATH=/workspace/portfolio/node_modules/@esbuild/linux-x64/bin/esbuild npm run build -- --config /workspace/.cloud-onboarding/portfolio/vite.config.mjs`.
- Dev: same environment variable, `npm run dev -- --config /workspace/.cloud-onboarding/portfolio/vite.config.mjs --host 127.0.0.1 --port 5173 --strictPort`.
- Review artifacts are under `/workspace/design-review`; uploaded original is outside checkout in `/workspace/attachments`.
- Local Chromium `/usr/bin/chromium` with Puppeteer is available; use writable XDG paths and local-only `--no-sandbox` as documented in onboarding.
- `npm run lint` is already blocked by missing repository ESLint configuration. Do not count it as passed.
- No secrets are required for core browsing. External integrations may be limited by network policy; keep graceful fallback and distinguish untested service behavior.
- Save a verified checkpoint in this document after each part. Do not leave half-connected controls or claim unrun checks passed.

## Branch checkpoints
- `design/portfolio-foundation`: new home/shell, local fonts (OFL licenses included), optimized cloud video/poster, theme/motion controls and resumable plan.
- `ux/portfolio-navigation`: next — windows, native dialogs, search/contact/assistant feedback and route cleanup.
- `design/portfolio-content`: next — truthful Projects and immediately readable About; further module polish.
Branches are stacked so later branches include earlier completed updates. Push each completed checkpoint; leave `main` unchanged until review/merge.

## Verification record
Before screenshots captured at 1440×1000 and 390×844. Baseline production build and basic Projects search passed during onboarding. Foundation production build passed; desktop 1440×1000 and phone 390×844 screenshots reviewed. Home has no horizontal overflow and no uncaught runtime errors. Video is muted and playable; pause and reduced-motion checks continue in the interaction stage.
