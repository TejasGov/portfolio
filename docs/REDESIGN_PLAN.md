# Now Showing: Portfolio Plan

The portfolio is **a night at the movies**. It runs in one 3D world, a cinema built in Blender with its lighting baked in. That world is interrupted by one paper flashback, the India scrapbook, and one paper index, the credits. The 2023 macOS site lives at `/os/`.

## 1. The film

| Chapter | World | What happens |
|---|---|---|
| **Prologue · Lights down** | Cinema | It opens in the projection booth with a vintage projector, film cans and a warm bulb. The camera passes the lens, flies out through the window and down the beam to the screen, which shows your name. It turns back over the seats and rises into the lamp. The light floods the frame and breaks into paper pixels. |
| **I · Chai, Cricket & Cinema** | Paper | The horizontal scrapbook with parallax: Prayagraj, chai, cricket and cinema. |
| **II · Now Showing** | Cinema, then films | The hall arrives as an ink drawing on the scrapbook's paper, and colour blooms out from the screen. The camera walks into the screen. Five animated films star the traveller, a stylised Tejas: Smash Cricket, CogniFlow, Revere, Yudhveer and Commit City. Each blooms out of ink and washes back to ink before the next cut. The camera walks back out, and the hall washes to ink and lifts off the page. |
| **III · Places I Worked** | The journey | The traveller walks a path from Prayagraj (2022) to New York (2026), past six little worlds, one per stop. Each world blooms from ink into colour as he reaches it, and the day turns to night along the way. Paper slips carry every role. |
| **IV · Press Start** | The neon coast, then blocks | An ode to the games Tejas grew up on, in two original worlds that share one place. You walk an 80s neon beach boulevard at dusk under a third-person chase camera: pastel hotels, palms, a parked coupe, a striped sunset over the sea. At the arcade cabinet at the end of the boardwalk, a wave rolls out and the coast dissolves into a voxel world under a bright sky. Glowing cubes lift off the wave's front, and you walk on and jump. |
| **Epilogue · House lights** | Cinema | The hall is drawn back onto the page and blooms into colour with the house lights up. The screen reads "The End". Contact details follow, then the colophon. |

**The seams** are one language: the 3D world as an ink drawing on the book's paper (`cinema/sketch.js`), with a wave between the drawing and the lit world. The wave is a growing sphere for the hall and the films, and a front that travels with the traveller on the journey.

## 2. How the world is built

- **The hall:** `scripts/cinema/hall_build.py` builds it in Blender 5.2:
  - stadium rake, acoustic wall panels with uplights, ceiling baffles;
  - the booth with its projection window, the screen, curtains and exit signs;
  - designed light: sconces throwing scallops up the fabric walls, a warm proscenium cove around the screen, and footlights on the curtains.

  Every material carries a `detail` id.
- **The bake:** `scripts/cinema/bake.py` bakes the hall twice with Cycles on the GPU (HIP):
  - `hall_show` is lit by the screen and projector;
  - `hall_house` adds warm downlights.

  Both are 4K and stored as **log-encoded radiance**, so the dark room and the bright fittings both keep detail in 8 bits. The bake also writes two UV sets: world-scale detail coordinates and each face's material id. The web multiplies the matching texture from `hall_detail.webp` over the bake:
  - R: an art-deco carpet, drawn for the hall;
  - G: wool herringbone;
  - B: board-formed concrete;
  - A: velvet.

  The last three are CC0 from Poly Haven. A star ceiling is drawn live on top.
- **Models:** generated with **Meshy**:
  - the projector and the recliner (smart topology, instanced 330 times), compressed with glTF-Transform (meshopt);
  - the traveller (smart topology, auto-rig, ten library clips and a walk);
  - the six journey dioramas.

  The traveller and the dioramas are compressed by `scripts/cinema/compress.py` (Blender: Draco and 1K WebP, the walk merged in): the traveller is 0.77 MB and the dioramas 0.4–0.7 MB each.
- **Films and journey:** live scenes in an ink-and-paint style (`cinema/films/kit.js`), with cel shading on the Meshy textures, ink outlines, painted skies and procedural props. A film renders into a target shown on the screen from the seats, or straight to the frame once the camera is inside (a view offset matches the screen's crop).
- **Live layer:** the projector is a three.js `SpotLight` whose `map` is the film frame (a canvas). The screen is lit by it, so objects in the beam cast shadows on it. The beam itself is ray-marched through 3D noise haze at half resolution (`cinema/core.js`), with dust motes that light up only inside it. Post-processing adds mipmap bloom, AgX tone mapping, grain, chromatic aberration and a vignette.
- **Transitions:** the bloom flood and the paper pixel sweep (`stage/Takeover.jsx`, `cinema/sweep.js`) are scroll-driven, so they run backwards too.
- **Sound (opt-in, header toggle):** synthesized live with WebAudio in `lib/sound.js`, with no audio files: the projector's 24 fps clatter, motor hum and fan (louder the closer the camera is to the lens), the hall's air, and a rush of air as the light floods the frame. Silent under paper chapters.

## 3. Code map

| Path | Role |
|---|---|
| `src/novel/cinema/world.js` | The hall: loading, hall material (bake × detail textures), seats, projector, star ceiling, lights, beam, dust, title cards, and `render(state)`, which also draws the films and the journey. |
| `src/novel/cinema/timeline.js` | Scroll progress to world state: camera paths, lamp, flood and sweep, which film is playing, the ink waves. **Tune timing here.** |
| `src/novel/cinema/sketch.js` | The ink-drawing pass and its waves. |
| `src/novel/cinema/film.js`, `films/*.js` | The films. `kit.js` holds the shared ink-and-paint kit and the traveller; there is one scene file per project. |
| `src/novel/cinema/journey.js` | Chapter Three's world: path, dioramas, scenery and sky. |
| `src/novel/cinema/arcade.js` | Chapter Four's two worlds and the wave between them. Every coast material discards inside the wave and every block material outside it. The props are Meshy models in `public/cinema/arcade/`. |
| `src/novel/cinema/core.js` | Beam frame, volumetric pass, dust and noise volume. |
| `src/novel/stage/Stage.jsx`, `Takeover.jsx` | The canvas and render loop (paused under paper chapters, with adaptive resolution); the prologue's flood and pixel sweep. |
| `src/novel/content.js` | Project copy (`PROJECTS`) and the journey's stops and roles (`JOURNEY`). |
| `public/cinema/` | The hall bake, `hall_detail.webp`, the projector and seat, `traveller.glb` (eleven clips), and `journey/*.glb`. |
| `scripts/cinema/` | The Blender build and bake (`hall_build.py`, `bake.py`), `compress.py` (Draco and WebP for Meshy models), and the collage photo processor. |
| `lab/` (dev only) | `film.html?film=<id>` plays one film, `seam.html` shows the ink seam, and `hall.html` is the free-camera inspector. |

### Common edits

- **Copy:** `BEATS` in `chapters/Prologue.jsx` and `chapters/Epilogue.jsx`; `collage.js`; `content.js` for project one-liners.
- **A film:** its scene file in `cinema/films/`. Every film keeps its subject left of centre (`frameLeft`), because the card sits in the right third.
- **A journey stop or role:** `STOPS` in `content.js`. The dioramas are Meshy models; compress new ones with `scripts/cinema/compress.py`.
- **Share card:** `public/og.jpg` (1200×630) is a frame of the opening shot with the header and page counter hidden. Re-render it if the prologue's look changes.
- **Relight the hall:** edit the lights in `scripts/cinema/bake.py`, then rebake:

  ```sh
  blender -b hall.blend --python bake.py -- out 2048 256
  ```

  Copy `hall.glb`, the two bakes (as WebP) and `hall_gains.json` into `public/cinema/`.

## 4. Quality bar

- **Performance:**
  - The page's own JS is about 60 KB. The 3D stage is lazy-loaded, with the films and the journey loading after the first frame.
  - Phones get fewer ray-march steps, fewer dust motes and smaller shadow and film-frame maps.
  - On a desktop RX 9060 XT a frame takes 6–10 ms at 2520×1575 in the hall, and 3–4 ms in the films and the journey. Slower GPUs are handled by adaptive resolution: when frames run long for about a second, the stage drops the pixel ratio by 20%, down to 0.7 (`govern` in `stage/Stage.jsx`).
  - Rendering stops while paper covers the screen.
- **Accessibility:** all text and links are real DOM. Hidden beats are `inert`. Reduced motion stacks the scrapbook. The 3D sits behind an error boundary with a WebGL2 check.
- **Licensing:**
  - Photographs: Wikimedia Commons, credited in the colophon.
  - 3D models: generated with Meshy on your account.
  - Textures: Poly Haven, CC0.

## 5. Open items

1. **Real hardware:** check on a phone and a laptop GPU. Adaptive resolution covers the worst of it. The remaining levers are `steps` in the volumetric pass, dust count, the recliner instance count and the shadow map size.
2. **Four portraits:** Salman Khan, Akshay Kumar, Priyanka Chopra and a new Deepika Padukone photo were picked (see `scripts/cinema/collage_jobs.json`). Wikimedia still answers 429 to scripted downloads from this machine (retried on 19 Nov). Run `python scripts/cinema/collage_photos.py scripts/cinema/collage_jobs.json salman akshay priyanka deepika2`, then add them to the cast lineups in `collage.js`.
3. **Smash Cricket link:** `smash-cricket.vercel.app` returns 404 and there is no public repo, so the link is hidden (`link: "#"` in `src/data/projectsData.js`). Put the URL back when it is redeployed.
4. **Copy pass by Tejas,** especially the prologue lines.
