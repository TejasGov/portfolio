# Portfolio v2 — Redesign Plan

From the macOS-desktop look (circa 2023) to one continuous story: a single morphing pixel/point-cloud world with HUD chrome, closest to bricelab.dev, plus Socra's narrative clock and human-md's "one idea per screen" pacing.

---

## 1. Concept: "Training Data"

You build ML systems, so the site tells your story the way a model learns: **you are the sum of what you were trained on.** It isn't a map or a city-to-city story. The point-cloud orb is "the model". As you scroll it trains, then infers, then ships. The metaphor stays in the HUD labels and chapter names; the copy itself stays human.

The Indian childhood shows up as **inputs**, not geography. Cricket, chai and Bollywood are things that shaped how you think. A place you left doesn't come into it.

| # | Chapter | What the orb becomes | HUD readout | Content source |
|---|---------|---------------------|-------------|----------------|
| 00 | **Boot** ("hold to initialise") | pixel field (pixel-displace-field) collapses into the orb while assets preload | `[ LOADING WEIGHTS 87% ]`, blinking `_` | — |
| 01 | **Hero**: name + one-line thesis | topographic contour sphere (your image) | live cursor `X/Y`, local clock, `PARAMS: 1 HUMAN` | `aboutData` |
| 02 | **Training data**: the inputs that shaped you | the orb morphs through one sample per input: a **cricket ball** spinning on its seam; a **chai cup seen from above**, its milk swirl matching the orb's contour lines, which you can stir with the cursor; a **film reel / marquee bulbs** (Bollywood); then Marvel, Messi and music samples pulled from your data | `sample 003 / 128 · cricket_ball.pts · weight 0.91` | childhood/about copy, `movieData`, `musicData`, football |
| 03 | **Inference**: what the model builds, as a wheel-indexed project carousel | one shape per project: neural mesh (CogniFlow), glasses (Revere), **hand landmarks (Smash Cricket, which closes the loop from the cricket sample)**, film strip (CineSearch, which closes the loop from the Bollywood sample), S-mark (Socra) | `■ 02 / 06 · latency 480ms`, stack tags | `projectsData` |
| 03b | **Case study** (route `/work/:slug`) | scene stays live but blurred behind a two-column case study | metadata rail | `projectsData`, `llms.txt` trade-offs, Supabase reviews |
| ⏸ | **INTERVAL** | a full-screen Bollywood-style interval card between the halves of the story: grainy, warm, with chai steam drifting off the orb. A one-beat joke that shows confidence in the pacing | `[ INTERVAL · 00:05 ]` | — |
| 04 | **Checkpoints**: experience | points line up into a vertical rail; each role is a saved checkpoint | `ckpt_2024_q3 · loss ↓` | `workData` |
| 05 | **Still training**: photography, music, library, movies | orb scatters into a mosaic; images resolve via dither/pixel-dissolve | `[ FILE 014.WEBP ]` | `photographyData`, `musicData`, `movieData`, `techData` |
| 06 | **Deploy**: contact | night falls. Points settle into a dotted NYC skyline above dark water and drift down onto it as glowing **diyas**, one per project shipped. The wordmark rises behind them | `deployed: us-east-1 (NYC) · next region: us-west (SF)` | socials |

**Why it works:** each early input pays off later. Cricket leads to Smash Cricket, Bollywood leads to CineSearch, and chai becomes the visual motif (swirl → contour lines → steam at the interval). Places appear only as cheeky deployment regions (NYC now, SF next). Buffalo shows up only as the factual "University at Buffalo" line in Checkpoints.

**Narrative device:** a mono `EPOCH` counter in the bottom-left ticks up as you scroll (a nod to Socra's clock). The light warms through Training data, peaks at the Interval, then cools to crisp night-blue for Deploy.

*Alternative structure, if the ML framing feels too on-the-nose:* "Innings". The whole site is a cricket scorecard: chapters are overs, projects are deliveries, and the HUD is a scoreboard. It's more playful and narrower in tone; the recommendation is still Training Data.

## 1b. Lessons from your birthday-garden site

That site works because it's **warm**. Scroll is a slow camera walk through one place, and the light runs from morning haze through dusk to night. The words float as a few lines of serif italic over the world, and it ends on lamps on water. The plan above leaned cold, all bricelab HUD, so v2 borrows the garden's warmth:

- **Time of day is the scroll axis.** The EPOCH counter drives a real lighting arc (haze → golden → dusk → night), not just a tint, using the same fog and sky-gradient approach as the garden.
- **Two voices in the type.** Mono HUD for the machine, plus a **serif italic** (Cormorant Garamond, which you already used there, or Instrument Serif) for the human sentences. human-md pairs type the same way.
- **Fewer words on screen.** One or two sentences per beat, with an eyebrow line in small caps above.
- **Diyas as the closing image.** The Indian element arrives as atmosphere, not as a map.
- **Atmosphere over chrome.** Fog, bloom and soft volumetric light around the orb, so the HUD reads as an overlay on a world, not a dashboard.

## 1c. Render style: Monolith × human-md (the north star)

The 3D is **illustrated, sculptural tableaux on bold colour fields**. Monolith supplies how things are drawn; human-md supplies how scenes are composed and written.

**From the Monolith Project (rendering):**
- Toon-shaded 3D: 2–3 flat tone bands per material, with no realistic speculars.
- **Hand-inked outlines:** a post-process edge pass over depth and normals, with noise-wobbled width so lines look drawn, not vector.
- **Paper grain** over everything, a faint chromatic fringe at the edges, and a soft glow on emissive things (the sun, the diyas).
- Chunky cream display capitals with an inked outline for chapter titles ("ACT 1 · TRAINING DATA"). The camera dollies into objects between acts.

**From human-md (art direction):**
- **One idea per screen**, each a staged still life: objects on plinths in front of a saturated colour wall, standing on a contrasting floor plane.
- Each chapter swaps its colour field.
- Big grotesk sentence; **one serif-italic punchline** in the accent colour; typewriter-mono captions under objects.
- A small vermilion dot is the "you are here" marker and cursor.

**The fusion, chapter by chapter:**
- The orb is the recurring character, toon-inked. Its contour lines become the ink strokes, which suits this style well.
- In **Training data** the orb sits on a plinth like human-md's statues. The inputs are presented as objects: a cricket ball, a **kulhad of chai** with steam drawn as ink curls, and a film reel with marquee bulbs.

**Where the "morphing pixel" lives:** it is the transition between tableaux. An object dissolves into a cloud of pixels, the cloud drifts, and it re-forms as the next object (mesh → points → mesh). pixel-displace-field is the Boot gate version of the same idea. That keeps the pixel idea central without turning the whole site into pixel art.

**Motion:** slow and deliberate. Objects bob and rotate slightly, like a gently animated illustration. Nothing snaps except UI.

## 2. Visual system

- **Base:** paper `#F4EFE8`, ink `#201E1F`.
- **Chapter colour fields**, a human-md-saturated take on Monolith's pastels:

  | Chapter | Field |
  |---|---|
  | Boot | sage-grey `#CFCFCF` |
  | Hero | sage `#9FB5AE` |
  | Training data | pink `#FFABC8` |
  | Interval | mustard `#F2C230` |
  | Inference | cobalt `#2140C4` |
  | Checkpoints | lilac `#E7BFFF` |
  | Still training | peach `#F5A08C` |
  | Deploy | night `#0B1026`, where the diyas glow |

- **Accent:** saffron-vermilion `#F0531C`, a quiet nod to India, used for the punchline word and the marker dot. Socra's teal now appears only inside the Socra project.
- **Type:**
  - **Bricolage Grotesque** (variable, 200–800). 800 for chunky outlined act titles, 300–400 for body sentences.
  - **Instrument Serif italic** for punchlines; it already lives in `public/fonts`.
  - **Geist Mono** for captions and small labels.
- **Labels:** captions sit under objects like museum tags (`sample 003 — cricket ball, 2009`), replacing the earlier sci-fi HUD. Keep just a small act counter and progress bar, as Monolith does.

## 3. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Keep **React 18 + Vite** | already in place, and bricelab uses the same stack |
| 3D | **@react-three/fiber + drei + three** (installed) | toon materials (`MeshToonMaterial` + gradient map) and a custom ink-outline + grain post pass; transitions use a `THREE.Points` shader whose float buffers (sampled from each mesh) are mixed by a `uProgress` uniform |
| Scroll/motion | **GSAP + ScrollTrigger + Lenis** (Lenis is new) | pinned chapters, scrubbed morphs; GSAP is already installed |
| Component registries | **shadcn CLI with `"tsx": false`** + **Tailwind v4** (`@tailwindcss/vite`) + `@/` alias | lets `npx shadcn add <pixel-perfect / 23rd url>` work directly and emit JSX, instead of hand-porting every TSX file |
| Routing | `react-router` (new) | real URLs for case studies; view-transition between list and detail |
| Skip | StringTune | overlaps GSAP + Lenis; two owners of scroll and transforms would conflict |
| Skip | framer-motion (eventually) | GSAP covers it; remove once the old components are gone |

**Morph target pipeline:** sample N = 40–60k points from each shape (an SVG path, a GLB surface via `MeshSurfaceSampler`, or procedural math for the sphere and rail). Bake them to `.bin` at build time with a small `scripts/bake-points.mjs`, the same idea as bricelab's `*.points.bin`. Load each chapter lazily.

## 4. Component shortlist (from research)

| Where | Component | Source | Notes |
|---|---|---|---|
| Gate / hero background | **pixel-displace-field** | pixel-perfect.space | no dependencies; recolour its ramps to the palette |
| Site-wide cursor | **dither-cursor-trail** or **pixel-cursor-trail** | pixel-perfect.space | desktop only |
| Hero name | **ascii-logo** or **text-glitch-portal** | 23rd.dev / pixel-perfect | pick one after previewing both |
| Hero / about portrait | **dither-scan** | 23rd.dev | 1-bit portrait resolves on a scan line |
| Project covers | **img-pixel-dissolve** / **mosaic-mask-reveal** | pixel-perfect.space | dissolve pulls in a shader chain (drop lil-gui) |
| Projects section (fallback) | **project-slice-scroll** | pixel-perfect.space | used if the 3D carousel is cut on mobile |
| Text reveals | `18-texts-reveal`, `33-text-morph` | transitions.dev skill | plain CSS/JS, rotating role titles |
| List ↔ detail | `08-page-side-by-side` | transitions.dev | |
| Page tilt | **folio** | 23rd.dev | optional |
| 404 | **dithered-404** | 23rd.dev | |
| Footer | **stretchy-footer** + giant wordmark | 23rd.dev | |

Confirm the pixel-perfect and 23rd licences before shipping.

## 5. How the tools fit

- **reanimate** (installed): clone specific reference interactions into our code and verify them frame by frame. Targets: bricelab's hold-to-enter gate, its wheel-step project carousel, and the case study sliding over the blurred scene.
- **motion2code** (to install: `claude plugin marketplace add lovisdotio/motion2code` → `claude plugin install motion2code@motion2code`; needs Python 3.9+, ffmpeg, and Playwright Chromium): its limits are flat vector/SVG only, with no canvas, 3D or images. Use it for the **kinetic-type intro** and **HUD label choreography**. Record or generate a clip, rebuild it as one GSAP timeline, then port it into a React component with `useGSAP`.
- **modern-web-guidance** (installed): consult it before writing view transitions, scroll-driven CSS, dialogs, image loading and CWV work.
- **prompt-motion.com**: reference clips for the intro (the kinetic-type self-portrait and easing/morphing showreels), which can feed motion2code.
- **regards.design / Are.na board**: reference only. The edoardolunardi 3D-ASCII lab and the laurent.fyi sphere are the closest matches.

## 6. Build phases

Each phase ends deployable and checked in the browser at desktop and 375px.

**Phase 0: Foundation (½ day)**
- New branch `v2`. Add Tailwind v4, the `@/` alias (`vite.config.js` + `jsconfig.json`), `components.json` with `tsx:false`, Lenis, `react-router`, `@gsap/react`.
- Keep the current OS site's code exactly where it is. Serve it as a second Vite page at `/os/` (multi-page build: `os/index.html` → the existing `src/main.jsx`), so its CSS never mixes with v2's. Link it from the v2 footer later.
- Tokens in CSS (`:root`), with Bricolage Grotesque, Instrument Serif and Geist Mono self-hosted.
- Stop tracking `node_modules`.

**Phase 1: Shell + HUD (1 day)**
- Corner brackets, mono nav (NAV / INDEX lists), cursor readout, clock, progress rail, reduced-motion handling.
- Chapters are empty full-screen sections with a Lenis + ScrollTrigger skeleton.

**Phase 2: The look + the orb (2–3 days, the core risk)**
- `<Stage>`: a single Canvas fixed behind the page. Toon materials, an ink-outline post pass (depth + normal edges, noise-wobbled), paper grain, colour-field wall and floor that swap per chapter.
- Toon-inked orb with contour strokes.
- `<PixelMorph>` transition: sample the current and next mesh into point buffers, then dissolve, drift and re-form on scroll.
- Start the look-dev with one tableau, the orb on a plinth, and get it signed off before building more.
- **Perf budget:** 60fps on an integrated GPU, a cap of about 40k points on mobile, and a static poster image if WebGL is unavailable or `prefers-reduced-motion` is set.

**Phase 3: Gate + hero (1 day)**
- Port pixel-displace-field. Hold-to-enter with the preload bar.
- Hero headline reveal: motion2code-built intro, or the transitions.dev recipe as a fallback.

**Phase 4: Work + case studies (2 days)**
- Bake per-project shapes. Wheel/arrow/swipe stepping.
- `/work/:slug` route over the blurred canvas. Supabase reviews move here.
- Image reveals with pixel-dissolve.

**Phase 5: Timeline, off-hours, contact (1–2 days)**
- Rail morph plus a scrubbed `workData` list.
- Dithered gallery for photography, music, library and movies.
- Wordmark footer and stretchy footer. 404.

**Phase 6: Polish + ship (1 day)**
- Optional sound toggle, as on monolith.
- Update the OG image, `llms.txt` and JSON-LD.
- Lighthouse: LCP under 2.5 s, since the hero text renders before WebGL. Keyboard navigation and focus rings.
- Cross-check against references with reanimate.

## 7. Kept / dropped

- **Kept:** all `src/data/*` content, `public/` media, SEO meta + `llms.txt`, Supabase reviews, the terminal (as a `~` easter-egg overlay).
- **Dropped from the main site:** the desktop, windows, dock, macOS widgets, glassmorphism, emoji colour coding, and per-role rainbow colours. All of them stay reachable at `/os`.

## 8. Decisions needed

1. **What happens to the old OS site?** Default: keep it at `/os`. The alternative is to delete it.
2. **Accent colour:** now saffron-vermilion `#F0531C` (see section 2). Socra teal stays inside the Socra project.
3. **Socra on the site:** shown as a featured venture in Work (default), or as its own chapter.
4. **Sound layer:** off by default, behind a toggle (default), or skipped. With it on, the Interval could carry a short tabla/harmonium sting.
5. **Story frame:** Training Data (default) or Innings.
6. **Training-data samples:** cricket, chai and Bollywood are confirmed. Pick 2–3 more from Marvel, Messi/football, music artists, books.
