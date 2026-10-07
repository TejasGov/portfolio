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

## Visual direction — corrected after user feedback
**Preserve the macOS identity.** The user rejected the editorial homepage replacement. Keep the native-feeling menu bar, Finder-style colored folders, desktop widgets, traffic lights, frosted surfaces and magnifying dock. Use the uploaded monochrome cloud video and restrained dither details within that language. Improve accessibility, content clarity, mobile fit and actual actions without replacing the desktop metaphor.

## Stages
1. **Audit and foundation — complete:** baseline screenshots/video inspected; asset optimization, typography, tokens and motion preferences.
2. **Home and navigation — complete:** persistent identity, clear work/about/contact actions, responsive directory, command bar, window recovery.
3. **Content and interactions — in progress:** factual Projects, immediate About, accessible window frame/search/contact, route corrections.
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
- `design/portfolio-foundation` (`fd06d5e`): pushed earlier editorial alternative; **user rejected its visual direction — do not merge alone**.
- `design/macos-desktop` (`b49c152`): pushed — corrected macOS shell, folders, widgets, dock and traffic lights.
- `ux/macos-navigation` (`2d63557` plus app interaction follow-up): pushed — native dialogs, search/contact/assistant feedback and route cleanup; based on the corrected macOS branch.
- `design/macos-content`: next — truthful Projects and immediately readable About inside the preserved macOS windows.
Branches are stacked so later branches include earlier completed corrections. Push completed checkpoints. `main` has not been changed.

## Verification record
Before screenshots captured at 1440×1000 and 390×844. Baseline production build and basic Projects search passed during onboarding. The earlier foundation production build passed; desktop 1440×1000 and phone 390×844 screenshots reviewed. Home has no horizontal overflow and no uncaught runtime errors. Video is muted and playable; pause and reduced-motion checks continue in the interaction stage.

## Latest checkpoint
macOS shell restored and desktop/phone screenshots reviewed. Native dialog/search/contact changes are pushed. App interaction follow-up adds labelled, keyboard-operable gallery controls with focus restoration and isolated Escape, keyboard selection in Experience, clipboard failure feedback in Blog, and an accurate Spotify fallback. About and Projects remain separate content work.

### Interaction verification
The macOS browser check passed: seven Finder folders; video pause/play and preference persistence; window minimize/restore; dialog focus containment and Escape isolation; keyboard search/empty state/contact routing; theme persistence; 390px/320px phones and short landscape; reduced-motion still wallpaper. No uncaught application errors. Small-screen scroll padding reserves space for the dock. Run `node scripts/check-portfolio.mjs` against a running local server to repeat. Voice connection is not exercised; mic/network failures have visible feedback.

All seven folder apps opened without uncaught errors. Project images and the real live-project link loaded; Experience list selection worked with Enter; gallery arrow navigation and Escape left its parent window open. About scrolls through to its footer on desktop and phone. Production build passed after these app interaction changes.
