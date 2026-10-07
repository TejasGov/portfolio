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
3. **Content and interactions — complete:** factual Projects, immediate About, accessible window frame/search/contact, route corrections.
4. **Verification and handoff — complete:** production build and both browser checks pass. Desktop, phone and short-screen screenshots reviewed; final My Tech phone fit and keyboard access corrected.

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
- `ux/macos-navigation` (`cf5d26e`): pushed — native dialogs, search/contact/assistant feedback, route cleanup and app interaction feedback; based on the corrected macOS branch.
- `design/macos-content` (`7ecb7b1`): pushed — truthful Projects and immediately readable About inside the preserved macOS windows; production verification passed.
- `ux/macos-apps`: final checkpoint — responsive equipment diagram, native keyboard selection, readable inspector, labelled 44px zoom controls, and Escape precedence for gallery/equipment when another overlay is open.
Branches are stacked so later branches include earlier completed corrections. Push completed checkpoints. `main` has not been changed.

## Verification record
Before screenshots captured at 1440×1000 and 390×844. Baseline production build and basic Projects search passed during onboarding. The earlier foundation production build passed; desktop 1440×1000 and phone 390×844 screenshots reviewed. Home has no horizontal overflow and no uncaught runtime errors. Video is muted and playable; pause and reduced-motion checks continue in the interaction stage.

## Latest checkpoint
macOS shell restored and desktop/phone screenshots reviewed. Native dialog/search/contact changes are pushed. App interaction follow-up adds labelled, keyboard-operable gallery controls with focus restoration and isolated Escape, keyboard selection in Experience, clipboard failure feedback in Blog, and an accurate Spotify fallback. About and Projects are complete: immediate biography, compact profile, real portrait, skills and interests; Finder project index with real images, factual content and actual links.

### Interaction verification
The macOS browser check passed: seven Finder folders; video pause/play and preference persistence; window minimize/restore; dialog focus containment and Escape isolation; keyboard search/empty state/contact routing; theme persistence; 390px/320px phones and short landscape; reduced-motion still wallpaper. No uncaught application errors. Small-screen scroll padding reserves space for the dock. Run `node scripts/check-portfolio.mjs` against a running local server to repeat. Voice connection is not exercised; mic/network failures have visible feedback.

All seven folder apps opened without uncaught errors. Project images and the real live-project link loaded; Experience list selection worked with Enter; gallery arrow navigation and Escape left its parent window open. About scrolls through to its footer on desktop and phone. Production build passed after these app interaction changes.

Final content production build and both browser scripts passed against Vite preview on port 4173. All seven folder apps also pass phone overflow checks, with screenshots captured. Repeat with `node scripts/check-windows.mjs [preview-url]` and `node scripts/check-portfolio.mjs [preview-url]`. Outputs default to `/tmp/portfolio-review`; set `PORTFOLIO_CHECK_OUTPUT` to preserve elsewhere. External Spotify embeds and weather requests are blocked in this environment; fallback text and direct links remain visible. Live voice and remote media playback are untested. Existing large-chunk build warnings remain.

### Final app verification
My Tech now fits the entire diagram to its viewport, including phones, and recomputes fit after resize/maximize. Pan and zoom remain available. Equipment hotspots are native buttons, with a labelled native selection control as an alternative; details appear in a readable inspector outside the scaled canvas. Escape closes the inspector, restores focus and keeps the app open. A contact overlay above it receives Escape first. Production build and extended window checks passed after this change, including keyboard selection, inspector focus recovery, phone diagram bounds, zoom and fit reset. Gallery Escape also respects native overlays and active-window order.

### Handoff / resume
Use `ux/macos-apps` as the latest combined branch; it includes the macOS desktop correction, navigation and content checkpoints. Earlier branches are independent review points, not separate changes to merge together. `main` remains at `1458b92`. Screenshots: `/workspace/design-review/production-core` and `/workspace/design-review/production-windows`. Checkout is clean after the final commit. External service verification, existing large-chunk optimization and repository lint configuration remain future engineering work; the visual/usability pass is complete.

## October 7 — macOS polish continuation
User requested a further UI/smoothness pass while preserving macOS, with modern dither/pixel details. Based on `ux/macos-apps`.

- `design/macos-pixel-polish`: coherent light/dark glass, clearer widget labels, distinct macOS dock app finishes, stronger folder depth, hover paper lift and a brief ordered-dither shimmer. Added a compact Spotlight shortcut in the welcome widget. Decorative effects use one tiny SVG tile and CSS; no animation loop or new dependency. Reduced motion disables the folder animation. Narrow-phone dock spacing now keeps all five icons within the screen.
- Verification: production build and core browser check passed; desktop, light/dark and 390/320px phone screenshots inspected. Additional smoothness/state-preservation work follows on its own branch.
