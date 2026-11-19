# Now Showing: Portfolio Plan

The portfolio is **a night at the movies**. It runs in one 3D world, a cinema built in Blender with its lighting baked in. That world is interrupted by one paper flashback, the India scrapbook, and one paper index, the credits. The 2023 macOS site lives at `/os/`.

## 1. The film

| Chapter | World | What happens |
|---|---|---|
| **Prologue · Lights down** | Cinema | It opens in the projection booth: a vintage projector, film cans and a warm bulb. The camera passes the lens, flies out through the projection window and down the beam to the screen, which shows your name. It turns back over the seats to face the booth, then rises into the lamp. The light floods the frame blue-white and breaks into paper pixels. |
| **I · Chai, Cricket & Cinema** | Paper | The horizontal scrapbook with parallax: Prayagraj, chai, cricket (the 2011 World Cup night, Dhoni, Chepauk in CSK yellow) and cinema (PVR, the Bollywood billing block). |
| **II · Now Showing** | Cinema | Five screenings, seen from row ten: the whole screen between the curtains, seat backs in silhouette below. For each project the screen plays its real footage (its screenshot, masked like a flat print on a scope screen), dust streams down the beam and condenses on a Meshy model in front of it, and the solid model dissolves in with a hot edge and casts its shadow onto the picture. The beam takes each project's tint. |
| **III · Places I Worked** | Paper | Every role in `workData`, set as an index (the credits). |
| **Epilogue · House lights** | Cinema | The lamp dims and the house lights come up, crossfading to a second baked lighting state. The screen reads "The End". Contact details, then a colophon that credits every photo and model. |

## 2. How the world is built

- **The hall:** `scripts/cinema/hall_build.py` builds it in Blender 5.2: stadium rake, acoustic wall panels with uplights, ceiling baffles, the booth with its projection window, the screen, curtains and exit signs.
- **The bake:** `scripts/cinema/bake.py` bakes the hall twice with Cycles on the GPU (HIP):
  - `hall_show` is lit by the screen and projector;
  - `hall_house` adds warm downlights.

  Both are stored as **log-encoded radiance**, so the dark room and the bright fittings both keep detail in 8 bits. The web decodes them in `cinema/world.js`.
- **Models:** generated with **Meshy**: the projector, the recliner (smart topology, about 6k triangles, instanced 330 times) and the five project models. Each started as a concept image, then image-to-3D with 4K PBR textures. They were compressed with glTF-Transform (meshopt, WebP), from 13–52 MB down to 0.2–4.5 MB.
- **Live layer:** the projector is a three.js `SpotLight` whose `map` is the film frame (a canvas). The screen is lit by it, so objects in the beam cast shadows on it. The beam itself is ray-marched through 3D noise haze at half resolution (`cinema/core.js`), with dust motes that light up only inside it. Post-processing adds mipmap bloom, AgX tone mapping, grain, chromatic aberration and a vignette.
- **Transitions:** the bloom flood and the paper pixel sweep (`stage/Takeover.jsx`, `cinema/sweep.js`) are scroll-driven, so they run backwards too.
- **Sound (opt-in, header toggle):** synthesized live with WebAudio in `lib/sound.js`, with no audio files: the projector's 24 fps clatter, motor hum and fan (louder the closer the camera is to the lens), the hall's air, and a rush of air as the light floods the frame. Silent under paper chapters.

## 3. Code map

| Path | Role |
|---|---|
| `src/novel/cinema/world.js` | The world: loading, hall material, seats, projector, lights, beam, dust, title cards, project materialization, `render(state)`. |
| `src/novel/cinema/timeline.js` | Scroll progress to world state: camera paths, lamp, flood and sweep, which project is screening and how far it has formed. **Tune timing here.** |
| `src/novel/cinema/core.js` | Beam frame, volumetric pass, dust, noise volume. |
| `src/novel/stage/Stage.jsx`, `Takeover.jsx` | The canvas and render loop (paused under paper chapters); the flood and pixel-sweep overlays. |
| `src/novel/lib/sound.js` | The synthesized soundtrack and its toggle state. |
| `src/novel/chapters/*` | One file per chapter. `collage.js` holds the scrapbook layout as data. |
| `public/cinema/` | `hall.glb`, `hall_show.webp`, `hall_house.webp`, `hall_gains.json`, and the Meshy models. |
| `scripts/cinema/` | The Blender build and bake, studio renders, and the collage photo processor. |
| `lab/` (dev only) | Sandbox pages; `lab/hall.html` is a free-camera inspector for the world (keys 1–5, `h` for house lights). |

### Common edits

- **Copy:** `BEATS` in `chapters/Prologue.jsx` and `chapters/Epilogue.jsx`; `collage.js`; `content.js` for project one-liners.
- **A project's model, size, turn, tint or screen footage (`still`):** `PROJECT_MODELS` in `cinema/world.js`.
- **Relight the hall:** edit the lights in `scripts/cinema/bake.py`, then rebake:

  ```sh
  blender -b hall.blend --python bake.py -- out 2048 256
  ```

  Copy `hall.glb`, the two bakes (as WebP) and `hall_gains.json` into `public/cinema/`.

## 4. Quality bar

- **Performance:**
  - The page's own JS is about 60 KB. The 3D stage is lazy-loaded: 151 KB gzipped plus about 16 MB of models and textures, with projects loading after the first frame.
  - Phones get fewer ray-march steps, fewer dust motes and smaller shadow and film-frame maps.
  - Rendering stops while paper covers the screen.
- **Accessibility:** all text and links are real DOM. Hidden beats are `inert`. Reduced motion stacks the scrapbook. The 3D sits behind an error boundary with a WebGL2 check.
- **Licensing:**
  - Photographs: Wikimedia Commons, credited in the colophon.
  - 3D models: generated with Meshy on your account.

## 5. Open items

1. **Real hardware:** check on a phone and a laptop GPU. The levers are `steps` in the volumetric pass, dust count, the recliner instance count and the shadow map size.
2. **Four portraits:** Salman Khan, Akshay Kumar, Priyanka Chopra and a new Deepika Padukone photo were picked (see `scripts/cinema/collage_jobs.json`). Wikimedia still answers 429 to scripted downloads from this machine (retried on 19 Nov). Run `python scripts/cinema/collage_photos.py scripts/cinema/collage_jobs.json salman akshay priyanka deepika2`, then add them to the cast lineups in `collage.js`.
3. **Smash Cricket link:** `smash-cricket.vercel.app` returns 404 and there is no public repo, so the link is hidden (`link: "#"` in `src/data/projectsData.js`). Put the URL back when it is redeployed.
4. **Copy pass by Tejas,** especially the prologue lines.
