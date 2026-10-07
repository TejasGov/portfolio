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
The original pass ended at `ux/macos-apps`; the continuation below identifies the newest combined branch. Earlier branches are independent review points, not separate changes to merge together. `main` remains at `1458b92`. Original screenshots: `/workspace/design-review/production-core` and `/workspace/design-review/production-windows`. External service verification, existing large-chunk optimization and repository lint configuration remain future engineering work.

## October 7 — macOS polish continuation
User requested a further UI/smoothness pass while preserving macOS, with modern dither/pixel details. Based on `ux/macos-apps`.

- `design/macos-pixel-polish` (`117f627`): pushed — coherent light/dark glass, clearer widget labels, distinct macOS dock app finishes, stronger folder depth, hover paper lift and a brief ordered-dither shimmer. Added a compact Spotlight shortcut in the welcome widget. Decorative effects use one tiny SVG tile and CSS; no animation loop or new dependency. Reduced motion disables the folder animation. Narrow-phone dock spacing keeps all five icons within the screen.
- `ux/macos-smoothness`: complete — windows animate with springs while preserving app selection, scroll, view mode and drag state on minimize/restore. Minimized windows are inert and hidden from assistive technology; focus moves to Restore and returns to the window. Dock geometry is cached on entry, avoiding repeated layout reads on pointer moves. Added keyboard magnification, fading tooltips, menu navigation with arrow/Home/End keys, Spotlight precedence, shorter menu/dialog transitions, and clearer inactive-window chrome. Volume observation only inspects newly added media. Control Center fits phones; smaller widget spacing clears folder labels above the dock on 390px phones.
- The artist gallery no longer waits for a remote HDR lighting asset; local scene lighting remains. Starfield render/animation work and the React Three Fiber render loop suspend while minimized; reduced motion uses a still scene with demand rendering. A Chromium check counts actual WebGL draw calls: they stop after minimize and resume after restore without resetting Artists. Repeat with `node scripts/check-artist-rendering.mjs [preview-url]`.
- Verification: production build, core desktop/keyboard/dialog checks, all seven folder apps on desktop and phone, 320/390px phones and short landscape, persisted motion/theme preferences, reduced motion, and artist render suspension passed. No uncaught errors in the tested flows. Final menu-to-Spotlight keyboard precedence and restored-window focus checks are included in the core script. Existing lint-configuration and large-chunk warnings remain; live voice and external media playback remain untested.
- Review: `/workspace/design-review/elevated-macos/desktop-dark.png`, `desktop-light.png`, `phone-390.png`, `phone-320.png`, `spotlight.png`, and `motion-demo.mp4` (11 seconds). Production check artifacts are in `/workspace/design-review/elevated-production-core` and `/workspace/design-review/elevated-production-windows`.
- Resume from `ux/macos-smoothness`, which includes every earlier macOS correction and polish checkpoint. `main` remains unchanged. No dependencies were added.

## October 7 — central branch and macOS fidelity
The user now requests **one central branch**, no further branches or PR stack. Continue committing and pushing only `ux/macos-smoothness`; `main` stays untouched until the user merges. Restore the Siri/LLM-style authored About conversation and voice interface while keeping accessibility and responsiveness.

- Spotlight now opens as the macOS floating search field, with Top Hits, blue selection, folder/app icons, a result preview, and a native-looking Open action after typing. Escape clears the query before dismissing. Added Command-Space alongside the existing Command/Control-K fallback, IME protection, and scrollable results that keep the footer visible in short landscapes.
- About restores the original authored biography and personal stories as streamed answers, with Siri artwork, selectable follow-up questions, replay, show-answer/read-all controls, keyboard access, and reduced-motion immediacy. Typing pauses while minimized or the document is hidden. No live model call is needed for authored biography content.
- Orb restores a frosted Siri-style panel, real received transcripts, typed response presentation, and an audio meter driven by SDK volume. Push-to-talk unmutes only while held and mutes on pointer release/cancel, lost capture, keyboard release, lost focus, or page hiding. It starts only after an explicit action.
- Fixed the ElevenLabs lifecycle: its React `startSession` returns void, so completion/errors now follow SDK callbacks. Closing during a pending connection cancels the eventual session, retries remain available after failure, and connection timeouts stop the pending request. Duplicate transcript event IDs are updated in place.
- Fixed footer overlap: floating recovery controls appear only for minimized apps, with space reserved in active windows. Short landscape windows now clear the dock. Corrected Help/Contact references to controls that actually exist and brought dialog headings back to system scale.
- Verification: production build; core browser checks; all seven folder apps and About on desktop/phone; dedicated macOS search/conversation/phone/reduced-motion checks; and voice lifecycle checks with the real SDK provider/hooks and a deterministic transport passed. The transport check verifies pending-close cancellation, async permission failure/retry, keyboard/pointer push-to-talk, focus-loss mute, transcript deduplication and teardown. Live external voice service remains unverified. Existing lint configuration and large-chunk warnings remain.
- New commands: `node scripts/check-macos.mjs [url]` and `node scripts/check-voice-lifecycle.mjs`. Visual evidence: `/workspace/design-review/macos-replica`.
- Luna reviewed public GitHub projects and manifests at the user's request. Next checkpoint: add the strongest verified projects with repository links and real screenshots or explicitly labelled logo/banner artwork.
