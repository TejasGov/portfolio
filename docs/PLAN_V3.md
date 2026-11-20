# Now Showing, v3: the rebuild plan

Your review, point by point:
1. The projects should play inside the screen, with no AI images.
2. The hall isn't premium; Blender should show.
3. There are no Monolith-grade transitions, and some seams have none at all.
4. The work section has no creativity.
5. The India chapter stays.

## Why it looked cheap

- **The hall.** Blender only built a grey box and baked light into it. There are no real materials (no fabric, velvet, wood or carpet) and no designed light (no sconces, no glow lines, no reflections). Bricelab reads as premium because every surface has texture and the light is designed.
- **The projects.** They stood in front of the screen as small solid models, with screenshots projected behind them, which read as clip art.
- **The seams.** Only the prologue had a transition. Paper to cinema and back was a plain scroll.

## What changes

| # | Piece | What you get | Status |
|---|---|---|---|
| 1 | **Into the screen** (Chapter Two) | From row ten the screen plays a film. The camera walks into the screen until the film is the whole frame. Inside, each project is a cloud of 150k points of light sampled from its 3D model and coloured by its real texture. It stands on a black mirror floor under a shaft of light, and each project pours into the next through a vortex. At the end the camera backs out into the hall. There are no screenshots. | Sandbox: `/lab/film.html` |
| 2 | **The seams** | Paper to cinema: the page catches like film in a hot gate and burns open onto the hall, with a white-hot edge, a charred fringe and embers. Cinema to paper: a wave of the projector's light rolls across the frame, and the page is left behind it. Both are driven by scroll, so they run in reverse too. They go on all four seams. | Sandbox: `/lab/wave.html` |
| 3 | **The hall, rebuilt in Blender** | Real CC0 materials from Poly Haven: velvet seats, a patterned carpet, acoustic fabric wall panels, wood trims and a plaster ceiling. Designed light: wall sconces throwing light scallops up the fabric, step lights on the aisles, a glowing cove around the proscenium, a fibre-optic star ceiling, and a polished stage lip that reflects the screen. Rebaked at 4K with Cycles on your GPU. | Next, after your go-ahead |
| 4 | **Work, reimagined** | One of the concepts below, in the paper craft of the India chapter. | Your pick |

### Work concepts

- **A · Filmography (recommended).** Every role is a film poster on a lobby wall. The company is the title, "Tejas Govind as Summer SWE Intern" is the billing, the dates are the release, the impact line is the tagline and the bullets are the credits block. The big roles (Daiwa, COA, Research, Sunflower) get full one-sheets; the rest are lobby cards. They slide past with the India chapter's parallax, and each poster is set in its own type style.
- **B · Ticket stubs.** Each role is a torn cinema ticket taped into the scrapbook: the screen is the place, the seat is the year, and the perforated stub holds the impact line.
- **C · End credits.** The roles roll up the cinema screen as real end credits, in two columns, with the hall lit by the screen.

## Order of work

1. You approve or redirect 1 and 2.
2. Wire 1 and 2 into the site and retime Chapter Two.
3. Rebuild and rebake the hall (3), the longest piece.
4. Build the work section (4).
5. Verify on desktop and phone frames, check performance, then push to PR #4.

## Decisions (19 Nov, after the first sandboxes)

The first film sandbox (point clouds) and the burn/ring seams were rejected. Tejas's notes: **particles again**, **not a story**, **not premium enough**. The seams should **transform the world** like Monolith's desert-to-oasis wave. The work section should be **a completely animated idea like the Monolith project** ("we've done VOX, we've done particles"): the traveller journey. Poly Haven CC0 textures are approved for the hall rebuild.

### The concept that ties it together: you are the star of every film

- **The hall** stays as the frame and is rebuilt in Blender with real CC0 materials and designed light.
- **One character, the traveller:** a small stylised you, generated with Meshy, rigged and animated (walk, idle, actions).
- **Chapter Two's films** become animated mini-scenes in an ink-and-paint style, starring the traveller and showing what each project does:
  - Smash Cricket: hand cricket against the webcam; the fingers become runs.
  - CogniFlow: at a desk, focus slipping; a gentle nudge brings it back.
  - Revere: meets someone, and the glasses whisper their name.
  - Yudhveer: sword and shield, a deflect.
  - Commit City: a city rising one commit at a time.

  The camera still walks into the screen.
- **The seams** are a world-space wave in post-processing. The 3D world turns into an ink sketch on paper (ink edges from depth and normals, hatching by light, the paper's own colour), or blooms back from the sketch into the lit, coloured world. Because the sketch sits on the paper colour, it meets the paper chapters with no visible cut.
- **Chapter Three (work)** is the traveller's journey along a path through little worlds, one per role, from Prayagraj in 2022 to New York in 2026. Each world starts as an ink sketch and blooms into colour in a wave as he arrives.

### Build order

1. The ink-sketch pass and world wave, sandboxed on the hall's seams.
2. The traveller (Meshy: concept image, image to 3D with smart topology, rig, animations).
3. One project film as a proof (Yudhveer, since the Meshy library has sword motions), then the other four.
4. The work journey: Meshy dioramas for each role, the path, and the colour waves.
5. The hall rebuild with Poly Haven materials and a 4K rebake.
6. Wire everything in, verify, and push to PR #4.

## Progress

- [x] Ink-sketch pass and world wave (`cinema/sketch.js`), on every seam:
  - India → Chapter Two: the hall in ink on the page's paper, then colour blooms from the screen.
  - Chapter Two → Three: the hall washes back to ink as the paper arrives.
  - Three → Epilogue: blooms from ink with the house lights.
- [x] The traveller: Meshy concept, model, rig, ten clips plus a walk (`public/cinema/traveller*.glb`; still uncompressed).
- [x] Five films in `cinema/films/`, wired into Chapter Two (`timeline.js` FILMS, `ChapterTwo.jsx` cards in the right third):
  - `smash.js`: floodlit ground, webcam scan, numerals, scoreboard.
  - `cogniflow.js`: desk at night, focus ring, distractions, nudge.
  - `revere.js`: POV through the glasses, face brackets, name tag.
  - `yudhveer.js`: duel with your shadow.
  - `commitcity.js`: the contribution graph rising into a city.
- [x] The old solid models, screenshot stills and point clouds are removed from the world.
- [ ] Chapter Three: the traveller's journey.
- [ ] Hall rebuild with Poly Haven materials, then rebake.
- [ ] Compress the GLBs through Blender (Draco + WebP); `npx gltf-transform` is blocked here.
- [ ] Final verification on desktop and phone.
