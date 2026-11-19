# Contours: Portfolio Plan

The portfolio is one continuous 3D world that you scroll through, not a page of sections. It grows out of a single image, a topographic orb, and keeps to one visual rule: **soft painted forms drawn over with glowing contour lines.**

The 2023 macOS-style site still lives at `/os/`, linked from the contact card.

---

## 1. Why this direction

The first redesign (v2, now deleted) stitched together other people's signatures: HUD labels, colour walls and plinths, ink outlines, a registry pixel field. The result had no identity of its own, and its 3D sat in small boxes on a scrolling page.

Contours fixes both problems:

- **It is built from things that are Tejas's own.** The topographic orb image he brought, and the birthday garden he built: a real place, light changing as you move, lamps on water.
- **It is a world, not a page.** One canvas, one camera path. Scene changes are camera moves through haze, cloud and light, which is where the dreamy feeling comes from.

## 2. The rule

Every surface uses the same contour material:

- wrapped light softly posterised into painted planes
- brush mottling
- a height colour ramp
- contour lines every few metres, with every fifth line heavier

The lines glow at night and recede by day, so landmarks read clearly in daylight and the world lights up after dark. The land, trees, props, buildings and water all share this material; the project sculptures are made only of lines. One shared set of atmosphere uniforms (sky, horizon, ground, line colour, sun, fog) moves the whole world from night to day and back.

Nothing borrowed carries the look. The only dependency added for it is bloom (`@react-three/postprocessing`).

## 3. The journey

Scroll progress `p` runs from 0 to 1 over a 3200svh runway. The camera glides along a Catmull-Rom path through keyframes, with damped inertia. Everything below lives in `src/world/route.js`.

| p | Time | Place | What happens |
|---|---|---|---|
| 0.00–0.10 | Night | **The orb** | Dark sphere of drifting glowing contours, dust, stars. The camera falls into it; inside, the lines wrap all around you, and a white haze hides the cut. |
| 0.10–0.20 | Night → dawn | **Above the land** | Top-down, the terrain reads like the orb's surface. The camera descends as dawn turns pink, then sinks through a cloud bank. |
| 0.24–0.30 | Dawn | **The hilltop** | Levelled summit with a pitch, three crooked stumps, a leaning bat and a taped tennis ball. The view faces the valley and the rising sun. |
| 0.33–0.38 | Morning | **Chai stall** | Roadside tapri on a ridge: tin roof, brass kettle with steam, kulhads, a bench. |
| 0.40–0.45 | Midday | **The cinema** | Single-screen talkies: deco front, red canopy with chasing bulbs, lit posters. |
| 0.47–0.70 | Golden hour | **Project valley** | Five landmarks down the eastern valley, each the project's shape as stacked contour rings that rise as you arrive. A card beside each one. |
| 0.72–0.82 | Dusk | **Lamp path** | Five lamp posts, one per role, lighting as you reach them. A card per role. |
| 0.85–1.00 | Night | **The lake** | A skyline across the water drawn in the orb's blue lines, diyas drifting on the near water, then the contact card. |

### Landmarks (`src/world/sculptures.js`)

Each project is a signed distance function, sliced horizontally and traced with marching squares into rings, then drawn with `LineSegments2`.

| Project | Shape |
|---|---|
| Smash Cricket | open hand, fingers fanned (a "five") |
| CogniFlow | brain: two folded hemispheres on a stem |
| Revere | glasses, lenses facing you |
| Yudhveer | planted sword plus a leaning round shield |
| Commit City | 4×4 block of towers |

### Story lines (draft, in Tejas's voice)

Edit these in `BEATS` in `src/world/App.jsx`.

- "Everything I build starts as a line I can't stop following."
- "Follow enough of them, and they turn into a place."
- "It started here. A hilltop, a taped tennis ball, three stumps that were never quite straight."
- Chai: after-match cutting chai and arguments about who was really out.
- Cinema: Friday first shows, then Interstellar.
- "Some lines I followed further…"
- "Every place I've worked left a light on."
- "Right now I'm in New York. Next, I'd like to be in San Francisco."

## 4. Code map

| File | Role |
|---|---|
| `index.html` → `src/world/main.jsx` | Entry. `os/index.html` → `src/main.jsx` is the 2023 site (separate Vite page). |
| `src/world/App.jsx` | Lenis smooth scroll, the scroll runway, the white-out veil, and `BEATS`: lines and cards with `[in, out]` windows in `p`. |
| `src/world/Scene.jsx` | Lazy chunk: the `<Canvas>`. |
| `src/world/World.jsx` | Camera rig (path, inertia, cursor parallax, portrait lens), palette and sun application, sky, orb, terrain, trees, hilltop props, cloud bank, post-processing. |
| `src/world/route.js` | Camera keyframes, `PROJECT_P` / `LAMP_P` stops, the day palette, the sun arc, the veil curve. |
| `src/world/terrain.js` | Heightfield (Perlin fbm), the hill, levelled pads (`SITES`), the lake basin, tree scatter. Heights come from one function shared by mesh, props and camera. |
| `src/world/materials.js` | `atmosphere` uniforms; the contour, sky and orb materials. |
| `src/world/places.jsx` | Chai stall, cinema, landmarks, lamps, and the lake (water, skyline, diyas). |
| `src/world/sculptures.js` | SDF shapes and the slicer. |
| `src/world/content.js` | Featured projects and roles, read from `src/data/projectsData.js` and `src/data/workData.js`, plus contact links. |
| `src/world/progress.js` | Shared `{ target, current }` scroll progress. |

### Common edits

- **Change copy:** edit `BEATS` in `App.jsx`, or `line` in `content.js` for project one-liners.
- **Swap a featured project:** change its `id` or `shape` in `content.js`. For a new shape, add an SDF to `SHAPES`.
- **Move a place:** edit its pad in `SITES` (`terrain.js`). Camera keys reference sites, so they follow.
- **Retime the journey:** adjust `p` in `route.js` keys and `BEATS` windows together.

## 5. Quality bar

- **Performance:**
  - The page's own JS is about 35 KB.
  - The 3D chunk is about 133 KB plus three.js, lazy-loaded after the first text paint.
  - Mobile gets a coarser terrain (180 vs 320 segments) and fewer trees.
  - DPR is capped at 1.75.
- **Accessibility:**
  - All text and links are real DOM, with the name as the page's `h1`.
  - Cards that aren't showing are `inert`, so they leave the tab order.
  - Under reduced motion, scroll still drives the camera, but inertia, drift, idle animation and sculpture rise easing are off.
  - Without WebGL2, the page shows a short note instead of a blank canvas.
- **SEO:** the crawler payload and JSON-LD in `index.html` are unchanged, and `llms.txt` still describes the work.

## 6. Known gaps / next

1. **Real-device performance.** So far it has only been checked in headless Chromium, which renders the 3D in software. Profile on a mid-range laptop GPU and a phone. Likely levers: terrain segments, tree count, bloom resolution.
2. **Safari and iOS:** check WebGL2, `svh` units, and fat-line (`LineSegments2`) rendering.
3. **Copy pass** on all story lines, by Tejas.
4. **Hilltop and ground detail** up close: grass tufts, or a finer mottle on the plateau.
5. **Navigation:** a tiny progress indicator and a "skip to contact" link for people who won't scroll the whole day.
6. **Optional sound:** off by default, behind a toggle. Wind, a distant bat-on-ball, the hum of the cinema, water at night.
7. **Update `llms.txt`, the OG image and JSON-LD** to match the new site.
8. **Deploy:** confirm the host serves `/os/` as a directory index (it is a separate Vite page in `dist/os/index.html`).
