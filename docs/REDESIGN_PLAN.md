# A Design Novel: Portfolio Plan

The portfolio reads as **a design novel in four chapters**. Two worlds alternate:

- **Night:** live WebGL, a cloud of about 90,000 pixels and a glowing scientific orb.
- **Paper:** an editorial collage and a typeset index.

Pixel-dithered fringes stitch the two together as you scroll. The 2023 macOS site lives at `/os/`.

## 1. Why this, after Contours

Contours, a procedural 3D landscape, read as "PS3", not premium, and invented details: a hilltop cricket field in the middle of nowhere, when Tejas grew up in Prayagraj. This version is built from three things he asked for:

1. **The orb image he brought,** rebuilt at its own level of detail: near-black sphere, glowing multi-strand contour ribbons, a hot rim, bracketed live-coordinate labels and survey lines.
2. **A morphing pixel vortex** that condenses into that orb, and later into each project.
3. **India as a Vox-style paper collage** with real photographs: chai in a kulhad, cricket and MS Dhoni, Bollywood. The design references are human-md for editorial pacing, Monolith for scene-to-scene motion, and bricelab for restraint. None of their signature elements is copied.

Every claim in the copy comes from Tejas's own words or `src/data`.

## 2. The book

| Chapter | World | What happens |
|---|---|---|
| Prologue · Signal | Night | Your name assembles over a two-armed pixel vortex with depth of field. The pixels spiral in and settle onto the orb's contour lines. The drawn orb takes over, with instrument rings, survey markers and lines, then turns so Prayagraj (25.4358° N, 81.8463° E) faces you: "Mine started here." |
| I · Chai, Cricket & Cinema | Paper | A horizontal scrapbook pinned to the scroll: title card with a hand-drawn Sangam map → Prayagraj (Sangam, Naini Bridge, Kumbh) → chai (kulhad, chaiwala) → cricket (gully cricket, MS Dhoni, bat, ball) → cinema (Elgin Talkies, SRK, Deepika, Amitabh, ticket) → 2022 Sunflower Association → "Somewhere in there, I started building things." A double-pass ink route draws itself across the spreads. |
| II · Things I Built | Night | The pixel cloud forms each project as a tinted, annotated hologram. Each shape is a signed distance function sliced into contour rings and given a three-quarter turn: Smash Cricket (hand), CogniFlow (brain), Revere (glasses), Yudhveer (sword and shield), Commit City (towers). An editorial spread with links sits beside each. |
| III · Places I Worked | Paper | Every role in `workData`, typeset as a book index. Each entry is a `<details>` that opens to its impact line and bullets. |
| Epilogue · Write to me | Night | The last hologram folds back into the orb. Contact details, then a colophon that credits every photograph. |

## 3. Code map (`src/novel`)

| Path | Role |
|---|---|
| `main.jsx`, `App.jsx`, `index.css` | Entry, the chapter order, design tokens (night/paper, five typefaces), HUD and collage styles. |
| `Book.jsx` | Running head (difference blend, so it reads on both worlds), Contents dialog, page counter. |
| `lib/scroll.js` | Lenis on GSAP's ticker, with ScrollTrigger. |
| `lib/store.js` | Per-chapter progress plus mouse, read every frame by the stage. |
| `lib/chapters.js` | `useProgress` (progress into the store), `usePaper` (pauses WebGL while paper covers the screen), `useRunningHead`. |
| `lib/Beats.jsx`, `lib/Assemble.jsx` | Text that surfaces at scroll windows; titles whose letters fly in. |
| `lib/PixelFringe.jsx` | The dithered night↔paper edge. |
| `stage/Stage.jsx` | Canvas, camera rig, HUD projector, post-processing (bloom, chromatic aberration, grain, vignette). |
| `stage/timeline.js` | Scroll → state for pixels, orb, camera and HUD. **Tune timing here.** |
| `stage/Field.jsx` + `targets.js` + `targets.worker.js` | The pixel cloud. Targets (galaxy, orb lines, dust, five shapes) are built in a Web Worker. |
| `stage/noise.js` | The orb's domain-warped field, written in both JS and GLSL so the pixels land on the drawn lines. |
| `stage/Orb.jsx`, `stage/Instrument.jsx` | The orb shader (ribbons, emboss, rim, graticule, scan) and its tick-ring rig. |
| `stage/Hud.jsx`, `stage/anchors.js` | Bracketed readouts, survey lines, home marker, project annotations. |
| `stage/sculptures.js` | Project shape functions, the slicer, and per-shape yaw. |
| `chapters/*` | One file per chapter. `collage.js` holds the scrapbook layout as data. |
| `content.js`, `credits.json` | Projects and roles (from `src/data`); photo licences and attribution. |
| `public/novel/collage/` | Processed photos: `*-s` stickers (cut out with rembg, white rim baked in) and `*-t` torn prints. |

### Common edits

- **Copy:** `BEATS` in `chapters/Prologue.jsx` and `chapters/Epilogue.jsx`; `chapters/collage.js` for the scrapbook; `content.js` for project one-liners.
- **A different featured project:** edit `PROJECTS` in `content.js`. For a new shape, add it to `SHAPES` and `YAW` in `sculptures.js`, its key to `SHAPE_KEYS` in `Field.jsx` and to `WORK_KEYS` in `timeline.js`, and its labels to `WORK_NOTES` in `anchors.js`.
- **Pacing:** section heights in each chapter file, and windows in `timeline.js`.

## 4. Quality bar

- **Performance:**
  - The page's own JS is about 55 KB.
  - The stage chunk is about 90 KB plus three.js, lazy-loaded; target generation runs in a 5 KB worker.
  - Phones get 42k pixels instead of 90k and a wider lens.
  - WebGL rendering stops while a paper chapter covers the screen.
  - DPR is capped at 1.75.
- **Accessibility:**
  - All text and links are real DOM, with one `h1`.
  - Hidden beats are `inert`.
  - Reduced motion removes drift, inertia and the sideways scrapbook travel; spreads stack instead.
  - The 3D sits behind an error boundary, with a WebGL2 check.
- **Licensing:** Chapter One's photographs are from Wikimedia Commons (CC BY, CC BY-SA, CC0, public domain), credited in the colophon. They are photos of public figures, used as a personal collage, not as an endorsement.

## 5. Open items

1. **Real-device check:** so far the site has only been rendered in headless Chromium, which renders WebGL in software. Profile on a laptop GPU and a phone. The levers are pixel count `N` and bloom.
2. **The Smash Cricket live link** (`smash-cricket.vercel.app`) returned 404 in QA. Fix it or drop it in `src/data/projectsData.js`.
3. **Copy pass by Tejas,** especially the prologue lines and the collage notes.
4. **Optional:** hover previews in the Chapter Three index, sound, and an updated OG image and `llms.txt`.
