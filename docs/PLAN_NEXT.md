# Next version: plan for approval

Status: **built** on the `cinema` branch (see `docs/REDESIGN_PLAN.md`). This file is kept as the original proposal and research notes.

## 1. What the reference sites actually do

I recorded frames from each site and read its code and asset lists.

| Site | Why it feels premium | The technique underneath |
|---|---|---|
| **bricelab.dev** | A dark concrete atrium that looks rendered, not real-time. The intro wireframe "solidifies" into the lit room. Projects pour out of a ceiling emitter as glittering point clouds. | The room is modelled in Blender. Its lighting is baked into lightmaps, including directional ones (`lm_*`, `lmdir_*`), with real concrete, pillar and plant textures. Light shafts are ray-marched (`shaftSteps`), with mist and rain curtains, smoke, screen-space reflections on the wet floor, and bloom, on WebGPU. Project shapes are pre-sampled point files (`*.points.bin`). |
| **themonolithproject.net** | One continuous hand-painted world: ink outlines, flat colour, fog. Act titles burn away. Scene changes are events: a dive through speed lines that blooms into pink fog, and a hold on the monolith that sends an aqua wave across the desert, turning it into an oasis. | A deferred outline pass draws the ink lines. Transitions are materials that blend two rendered worlds (`MaterialTransitionMix`, `MaterialTransitionZoom`, a swirl). A dissolve shader burns the letters, and a ripple wave drives the world swap. It loads 44 GLB models and 104 KTX2 hand-painted textures. |
| **theramayanamovie.com** | Film-grade frames. A golden lotus of god rays blooms to a full-screen white-gold flash, then cuts to the arena. | The arena is one painted render plus a depth map (`arena.webp` + `arena_depth.webp`), shown with depth parallax. Only the bow is a real 3D model, with full textures. The burst is a video, and every beat has sound. |
| **StringTune** | One hero object, a katana, carried through the whole scroll; blade and scabbard separate. Pixel-block mosaics dissolve into a painted cloud scene. Words sharpen from blur. Big shape wipes (an arch, an octagon) flip between light and dark. | Layered painted art with real parallax depth: clouds in front of and behind the blade. CSS-first scroll animation. |
| **socra-edu.com** | A single floating diorama. The camera climbs the stairs while the sky moves from 2 a.m. through dawn to sunrise. | three.js with a scroll-driven camera path and a sky gradient tied to scroll. |

**The lesson:** none of these is "particles plus bloom". Each has a lit world (baked, painted or rendered), heavy atmosphere (haze, fog, light shafts), a cinematic transition between scenes, and one hero object you remember. The orb had none of that, so it goes.

## 2. Direction: *Now Showing*

The site is a night at the movies. It's yours, not borrowed from any reference: you grew up on Friday releases, and a projector beam produces exactly what made the first version's opening good (pixels of dust in a vortex of light) plus everything the references prove works (light shafts, haze, a bloom takeover).

| Chapter | World | What happens |
|---|---|---|
| **Prologue · The beam** | Night (3D) | A dark hall, rows of seats in silhouette, one projector port. Its blue-white beam cuts through drifting haze, and dust motes spiral inside it (the pixel vortex, now with a reason to exist). Your name is in the light. Scroll and the camera rises into the beam until the lamp **blooms blue-white and takes over the screen**. |
| **I · Flashback: Prayagraj** | Paper | The light breaks into **animated pixel blocks** that sweep across and resolve into the paper scrapbook. Keep the current spreads and parallax, and upgrade the cast: SRK, Ranbir, Amitabh, Salman and Akshay, then Kareena, Priyanka and Deepika as a stacked cut-out lineup. Cricket gets Dhoni in CSK yellow, the 2011 World Cup night and CSK. Cinema moves to a PVR night, not a single screen. |
| **II · Now showing: things I built** | Night (3D) | Back in the hall. Each project is "screened": dust in the beam condenses onto a real 3D object, which then **materializes** into a solid, lit model with a glowing dissolve edge, beside its editorial card. Smash Cricket (ball and bat), CogniFlow (a brain), Revere (the glasses), Yudhveer (a sword), Commit City (towers). |
| **III · Credits** | Paper | Every role, set as end credits: the index you have now, restyled as a credit roll. |
| **Epilogue · House lights** | Night to warm | The lamp dims and house lights fade up warm; contact details and colophon. The old OS site stays in the footer. |

**Transitions are events, not fades.** Three of them:
1. **Bloom flood** (night → light): lamp exposure and bloom ramp until the frame is blue-white.
2. **Pixel sweep** (light → paper): a ragged front of small pixels with coarse blocks filling behind it, driven by scroll so it runs backwards too.
3. **Film burn** (paper → night): a warm burn-through edge eats the paper back to the dark hall.

## 3. How it gets to "AAA"

- **Volumetric light:** a ray-marched beam (a rectangular projector frustum) through animated 3D haze, with forward scattering. Seats and walls occlude it.
- **Dust:** 30–60k motes. Each is lit only inside the beam, so they sparkle there and vanish outside it. Depth of field makes in-focus motes crisp square pixels and out-of-focus ones soft bokeh.
- **Lens:** an anamorphic blue streak and a hot core on the port, mipmap bloom, AgX tone mapping, film grain, a little chromatic aberration and a vignette.
- **Hall (phase 2, Blender):** model the cinema in Blender 5.2: seats, booth wall, curtains, carpet. Bake its lighting with Cycles on your Radeon (lightmaps, Bricelab's trick), then ship it as GLB with KTX2 textures. The real-time beam and dust sit on top. I've checked that headless Blender 5.2.2 sees the RX 9060 XT for GPU rendering (HIP), so this runs locally. The sandbox hall is instanced placeholder geometry.
- **Project models:** clean, licence-safe models, built in Blender or code, or CC-licensed from Sketchfab with credit. Optionally, Meshy generation, which costs Meshy credits; I'd ask first.
- **Budget:** phones get fewer ray-march steps, half the motes and no reflections. WebGL stops on paper chapters, as it does now.

## 4. Sandbox (open `/lab/` on the dev server)

| Page | What you're judging |
|---|---|
| `/lab/beam.html` | The dreamy 3D: beam, haze, dust vortex and title, then scroll for the blue bloom takeover and the animated pixel sweep into paper. |
| `/lab/screening.html` | How a project appears: dust condenses, then the object materializes in the beam (shown with Revere's glasses). |
| `/lab/india.html` | The upgraded Chapter One: actor lineup, cricket and PVR spreads, in the real scrapbook code. |

## 5. After you approve

1. Build the hall in Blender, bake it, and wire the prologue to the real scroll.
2. Port the transitions into the chapter seams.
3. Make the five project models and the screening sequence.
4. Restyle Chapter Three as credits; build the epilogue.
5. Mobile tuning, a real-GPU performance pass, then a PR.

## 6. What I need from you

- Approve, or redirect, each sandbox page.
- Say yes or no to spending Meshy credits on project models (the alternative is Blender or CC models).
