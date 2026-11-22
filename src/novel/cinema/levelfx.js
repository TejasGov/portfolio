import * as THREE from 'three'
import { Pass } from 'postprocessing'

/*
 * The covering transitions between Chapter Four's worlds (levels.js) and Chapter Five's (movies.js): one full-screen pass, enabled
 * only while a transition is on screen. Each is driven by a phase 0..1; across the plateau around 0.5
 * the frame is fully covered, and the world behind it is swapped there.
 *   CLOUD  three decks of cumulus roll in from the edges of the frame, lit from the upper left, close
 *          into the white of being inside one, and part from the middle as you come down through them.
 *   TECH   the picture breaks into a mosaic of cells from the top down, the cells turn to a console of
 *          glyph rows round a boot dial, and the next world scans back in as a night-vision phosphor
 *          image that settles into its true colours.
 *   STORM  climbing into a thunderhead: dark masses boil in from below and the edges, rain streaks
 *          past, lightning forks and lights the cloud from inside; at the middle the frame is dark,
 *          electric cloud; then it thins and tears open from the middle onto a dusk ridge.
 *   FLASH  a strike's whiteout: the picture burns out from its highlights to white; the white veil
 *          thins off the stadium and leaves thousands of soft camera flashes with short cross
 *          streaks, popping and thinning out until the crowd's own flashes take over.
 *   WHIP   a whip pan: the picture smears sideways into streaks of low sun and city light, which fill
 *          the frame and race past; coming out the warm light drains to night-blue as the pan slows.
 *   BATS   a swarm: bats (drawn in the shader, wings beating) sweep in from the right at four depths
 *          over a moonlit night until they and the dark are all there is; they leave to the left.
 *   COMIC  the picture goes to print (halftone dots), then five comic panels with ink borders and paper
 *          gutters slam onto the page one by one, a POW burst pops in the middle, and the panels slide
 *          off the page onto the next world, which prints back into colour.
 *   LASER  a security grid: thin red beams sweep across the frame and multiply into a dense lattice in a
 *          red haze until it is all there is; at the plateau a white flare blooms from the middle and
 *          fills the frame, then opens from the middle onto the next world (the white vault).
 * Every mode is whole (independent of the picture under it) across the plateau, so the swap is hidden.
 * It runs after tone mapping, on display-ready colour, so every colour below is what the screen shows.
 */
const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }`

const FRAG = /* glsl */ `
uniform sampler2D inputBuffer; uniform highp sampler3D tNoise;
uniform float uMode; uniform float uPhase; uniform float uTime; uniform vec2 uRes; uniform float uScale;
varying vec2 vUv;

float n3(vec3 p) { return texture(tNoise, p).r; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float ss(float a, float b, float x) { return smoothstep(a, b, x); }

// ---------------------------------------------------------------- cloud
// A deck's density: the volume's three octaves for the masses, a finer slice for the billows.
// One deck: its colour and how solid it is here. cov 0..1 is how far it has closed.
vec4 cumulus(vec2 uv, float scale, float z, float cov, vec2 drift, vec3 lit, vec3 shade) {
  vec2 q = uv * scale + drift;
  float mass = n3(vec3(q, z));
  // Billows at two sizes, smooth rounded lumps on the mass (no ridged abs(): its creases drew grey veins).
  float b1 = n3(vec3(q * 2.9 + 0.37, z * 1.9 + 0.5));
  float b2 = n3(vec3(q * 6.7 + 0.11, z * 3.1 + 0.2));
  float d = mass - 0.1 + (b1 - 0.3) * 0.34 + (b2 - 0.3) * 0.13;
  float th = mix(0.95, -0.1, cov);
  float a = ss(th, th + 0.18, d);
  // Lit from the upper left, by the mass alone so the light turns smoothly round each cloud: where it
  // is thicker toward the light, this side is in its shadow.
  float l = clamp(0.55 + (mass - n3(vec3(q + vec2(-0.05, 0.07), z))) * 6.0, 0.0, 1.0);
  vec3 c = mix(shade, lit, l);
  c = mix(c, lit, (1.0 - ss(th + 0.02, th + 0.16, d)) * 0.5); // the thin edge catches the light
  return vec4(c, a);
}
vec3 cloud(vec2 uv, vec3 src) {
  float ph = uPhase;
  vec2 c = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float r = length(c) / length(vec2(uRes.x / uRes.y, 1.0) * 0.5); // 0 at the centre, 1 in the corners
  // Rolling in: the edges close first, the middle last. Parting: the middle opens first.
  float cov = clamp(min(ph, 1.0 - ph) / 0.44, 0.0, 1.0); // linear: the masses build steadily, not all at once
  float lead = cov * (1.0 + 1.3 * ss(0.1, 1.0, r));
  // Inside the cloud, only as long as the swap needs (see below).
  float inside = ss(0.42, 0.44, ph) * (1.0 - ss(0.56, 0.58, ph));
  // The block world's noon sky gives way to the village's warm haze.
  float warm = ss(0.4, 0.7, ph);
  vec3 lit = mix(vec3(1.0, 1.0, 1.0), vec3(1.0, 0.985, 0.94), warm);
  vec3 shade = mix(mix(vec3(0.66, 0.75, 0.93), vec3(0.83, 0.79, 0.88), warm), lit, 0.45 * inside); // lifted inside: bright and soft
  vec3 haze = mix(vec3(0.82, 0.9, 1.0), vec3(1.0, 0.95, 0.86), warm);
  // Flying through: each deck grows as it nears, the near one fastest (parallax in depth).
  float fly = ph - 0.5;
  vec2 wind = vec2(uTime * 0.012, uTime * 0.004);
  vec3 col = mix(src, haze, 0.75 * ss(0.0, 0.5, lead)); // the world whitens before the masses close
  vec4 far = cumulus(c, 0.62 * exp(-0.5 * fly), 0.13 + uTime * 0.004, clamp(lead * 1.15, 0.0, 1.0), wind * 0.6 + vec2(0.0, fly * 0.25), mix(lit, haze, 0.35), mix(shade, haze, 0.4));
  col = mix(col, far.rgb, far.a * 0.92);
  vec4 mid = cumulus(c, 0.4 * exp(-1.0 * fly), 0.47 + uTime * 0.006, clamp(lead - 0.03, 0.0, 1.0), wind + vec2(0.3, fly * 0.5), lit, shade);
  col = mix(col, mid.rgb, mid.a);
  vec4 near = cumulus(c, 0.24 * exp(-1.7 * fly), 0.81 + uTime * 0.008, clamp(lead * 1.1 - 0.14, 0.0, 1.0), wind * 1.6 + vec2(0.7, fly * 0.9), lit, mix(shade, lit, 0.25));
  col = mix(col, near.rgb, near.a);
  // Inside the cloud, only as long as the swap needs: luminous white with slow masses in it, brighter
  // toward the sun, and one deck still streaming past the lens, so a reader who stops here is plainly
  // flying through cumulus, not looking at a blank page.
  float body =(n3(vec3(c * 0.22 + wind * 2.0, 0.3 + uTime * 0.01)) - 0.5) * 1.6 + 0.5;
  vec3 white = mix(shade * 0.94, lit, 0.1 + 0.65 * ss(0.15, 0.7, body)) + lit * 0.1 * exp(-length(c - vec2(-0.5, 0.42)) * 1.6);
  vec4 deck = cumulus(c, 0.3 * exp(-2.4 * fly), 0.29 + uTime * 0.01, 0.35, wind * 2.4 + vec2(-0.4, fly * 1.6), lit, shade * 0.85);
  white = mix(white, deck.rgb, deck.a * 0.6);
  col = mix(col, white, inside);
  // The sun through the thinning deck as it parts.
  col += vec3(1.0, 0.93, 0.78) * 0.16 * exp(-length(c - vec2(-0.5, 0.42)) * 2.2) * cov * warm;
  return col;
}

// ---------------------------------------------------------------- tech
const vec3 PHOSPHOR = vec3(0.36, 1.0, 0.55);
const vec3 AMBER = vec3(1.0, 0.74, 0.32);
// The picture as a night-vision tube shows it: luminance on green phosphor, hot highlights whitening.
vec3 phosphor(vec3 c, vec2 px) {
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  l = pow(l, 0.55) * 1.25 + 0.03; // a tube amplifies: the dark is lifted well above what the eye would see
  l += (hash(floor(px / (1.5 * uScale)) + floor(uTime * 24.0)) - 0.5) * 0.07; // tube noise
  l *= 0.88 + 0.12 * sin(px.y * 3.14159 / uScale);
  return PHOSPHOR * l + vec3(0.55, 0.9, 0.7) * pow(max(l, 0.0), 3.0) * 0.5;
}
// An original glyph: a mirrored 4 x 6 matrix of dots chosen by the cell's seed.
float glyph(vec2 f, float seed) {
  vec2 g = floor((f - vec2(0.18, 0.12)) / vec2(0.16, 0.127));
  if (g.x < 0.0 || g.x > 3.0 || g.y < 0.0 || g.y > 5.0) return 0.0;
  g.x = g.x > 1.5 ? 3.0 - g.x : g.x;
  return step(0.5, hash(vec2(seed * 17.0 + g.x, g.y + seed * 3.0)));
}
float ring(vec2 p, float r, float w) { return 1.0 - ss(w, w + 1.5 * uScale, abs(length(p) - r)); }
float box(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
vec3 tech(vec2 uv) {
  float ph = uPhase;
  float a = clamp(ph * 2.0, 0.0, 1.0), b = clamp(ph * 2.0 - 1.0, 0.0, 1.0);
  float env = ss(0.0, 0.06, ph) * (1.0 - ss(0.9, 1.0, ph)); // every overlay is gone at both ends
  vec2 px = uv * uRes;
  float cell = 22.0 * uScale;
  vec2 g = vec2(px.x, uRes.y - px.y) / cell; // rows count down from the top
  vec2 id = floor(g), f = fract(g);
  float rows = uRes.y / cell, cols = uRes.x / cell;
  float row = id.y / rows;
  float h = hash(id), hr = hash(vec2(id.y, 3.7));
  // Breaking up: a front runs down the frame; behind it each cell, at its own moment, becomes one
  // flat tile, then a phosphor tile, then a dark cell of the console.
  float ta = a * 1.7 - row * 0.5 - h * 0.3;
  // Resolving: a second front runs down; behind it each cell shows the next world, tiled then whole.
  float tb = b * 1.7 - 0.25 - row * 0.5 - h * 0.2;
  // A few rows slip sideways just as the front reaches them.
  float slip = (hash(vec2(id.y, floor(uTime * 14.0))) - 0.5) * step(0.8, hash(vec2(id.y + 9.0, floor(uTime * 7.0)))) * ss(0.0, 0.1, ta) * (1.0 - ss(0.1, 0.3, ta));
  vec2 suv = uv + vec2(slip * 0.05, 0.0);
  vec2 tile = (vec2(id.x + 0.5, rows - id.y - 0.5) * cell) / uRes;
  vec3 whole = texture2D(inputBuffer, suv).rgb;
  vec3 tiled = texture2D(inputBuffer, tile).rgb;
  float lines = max(1.0 - ss(0.0, 1.5 * uScale / cell, min(f.x, f.y)), 0.0); // the cell grid

  // ---- the console the frame becomes
  vec3 con = vec3(0.006, 0.026, 0.024) * (1.0 - 0.35 * row) + PHOSPHOR * lines * 0.07;
  // Rows of glyphs, typed left to right as the front passes: a boot log in a script of our own.
  float indent = floor(hash(vec2(id.y, 1.3)) * 4.0) * 2.0 + 2.0;
  float len = floor((0.12 + 0.6 * hash(vec2(id.y, 5.1))) * cols);
  float typed = clamp((ta - 0.46) * 5.0 + b * 0.5, 0.0, 1.0) * len;
  float at = id.x - indent;
  float blank = step(hr, 0.16); // an empty line now and then
  float on = step(0.0, at) * step(at, typed) * step(0.16, hash(id + 31.0)) * (1.0 - blank);
  float head = step(typed - 1.0, at) * step(at, typed) * step(typed, len - 0.5); // the cursor: a solid block
  float flick = floor(uTime * 9.0 + h * 7.0) * step(0.86, h); // a few glyphs keep changing
  float gl = max(glyph(f, h + flick * 0.13), head * step(0.14, f.x) * step(f.x, 0.86) * step(0.1, f.y) * step(f.y, 0.9));
  vec3 gcol = mix(PHOSPHOR, AMBER, step(0.9, hr)) * (0.35 + 0.65 * hash(vec2(id.y, 8.8))) * mix(0.75, 1.0, head);
  // The boot dial in the middle: a ring that draws itself round, ticks, brackets and a bar of segments.
  vec2 c = px - uRes * 0.5;
  c.y = -c.y;
  float S = min(uRes.x, uRes.y);
  float boot = ss(0.3, 0.62, ph);
  float hud = ss(0.3, 0.38, ph) * (1.0 - ss(0.6, 0.7, ph));
  vec2 panel = vec2(0.3, 0.2) * S;
  float inPanel = 1.0 - ss(-2.0 * uScale, 0.0, box(c, panel));
  float R = 0.085 * S;
  vec2 dc = c + vec2(0.0, 0.035 * S);
  float ang = fract(atan(dc.x, -dc.y) / 6.28318 + 1.0); // 0 at the top, clockwise
  float dial = ring(dc, R, 1.6 * uScale) * step(ang, boot);
  dial += ring(dc, R * 1.22, 0.8 * uScale) * 0.45 * step(0.5, fract(ang * 36.0)); // ticks
  dial += ring(dc, R * 0.62, 0.8 * uScale) * 0.35;
  dial += (1.0 - ss(0.0, 1.5 * uScale, length(dc) - 0.012 * S)) * (0.6 + 0.4 * sin(uTime * 6.0));
  // The bar: 14 segments under the dial, filling with the boot.
  vec2 bp = c - vec2(0.0, 0.125 * S);
  float seg = floor((bp.x / (0.2 * S) * 0.5 + 0.5) * 14.0);
  float inBar = step(abs(bp.x), 0.2 * S) * step(abs(bp.y), 0.007 * S) * step(0.12, fract((bp.x / (0.2 * S) * 0.5 + 0.5) * 14.0));
  float filled = step(seg + 0.5, boot * 14.0);
  // Corner brackets round the panel.
  vec2 q = abs(c) - panel;
  float br = step(abs(q.x), 1.0 * uScale) * step(-0.045 * S, q.y) * step(q.y, 1.0 * uScale) + step(abs(q.y), 1.0 * uScale) * step(-0.045 * S, q.x) * step(q.x, 1.0 * uScale);
  vec3 dialCol = PHOSPHOR * (dial + br * 0.8 + inBar * (0.18 + 0.82 * filled)) + AMBER * inBar * filled * step(boot * 14.0 - 1.0, seg + 0.5) * 0.8;
  con += gcol * gl * on * (1.0 - inPanel * hud);
  con = mix(con, vec3(0.004, 0.02, 0.018), inPanel * hud * 0.85) + dialCol * hud;

  // ---- going in
  vec3 col = mix(whole, tiled, step(0.03, ta));
  // The tile in four steps of phosphor, as a tube would quantise it.
  vec3 mono = PHOSPHOR * (floor(pow(dot(tiled, vec3(0.299, 0.587, 0.114)), 0.8) * 4.0 + 0.5) / 4.0 * 0.9 + 0.04);
  col = mix(col, mono, ss(0.12, 0.26, ta));
  col += PHOSPHOR * lines * 0.35 * ss(0.0, 0.12, ta) * env;
  col = mix(col, con, ss(0.32, 0.46, ta));
  // ---- coming out
  if (b > 0.0) {
    vec3 seen = mix(phosphor(tiled, px), phosphor(whole, px), ss(0.14, 0.34, tb));
    seen += PHOSPHOR * lines * 0.3 * (1.0 - ss(0.14, 0.34, tb));
    // The tube's round field darkens toward the corners while it is still a phosphor image.
    seen *= 1.0 - 0.55 * ss(0.35, 0.95, length((uv - 0.5) * vec2(uRes.x / uRes.y, 1.0)) / length(vec2(uRes.x / uRes.y, 1.0) * 0.5));
    seen = mix(seen, whole, ss(0.5, 0.97, b));
    col = mix(con, seen, ss(0.0, 0.1, tb));
  }
  // The scan bar riding each front.
  float front = b > 0.0 ? (b * 1.7 - 0.35) / 0.5 : (a * 1.7 - 0.2) / 0.5;
  float bar = exp(-abs(row - front) * rows * 0.9) + 0.25 * exp(-max(front - row, 0.0) * 9.0) * step(row, front);
  col += mix(PHOSPHOR, vec3(0.8, 1.0, 0.9), 0.5) * bar * 0.55 * env;
  return col;
}

// ---------------------------------------------------------------- storm
const vec3 BOLT = vec3(0.78, 0.88, 1.0);
// Billowing cloud: the volume's masses warped by a finer slice, so the edges curl like a thunderhead's.
float billow(vec2 q, float z) {
  vec2 w = vec2(n3(vec3(q * 0.7, z + 0.31)), n3(vec3(q * 0.7 + 4.3, z + 0.67))) - 0.5;
  q += w * 0.9;
  return n3(vec3(q, z)) * 0.65 + n3(vec3(q * 2.7 + 0.21, z * 1.7 + 0.4)) * 0.25 + n3(vec3(q * 6.1, z * 2.3 + 0.9)) * 0.1;
}
// A bolt's trunk: its x at y (0 at its top, 1 at its foot), wandering at two scales of noise.
float trunkX(float y, float x0, float s) {
  return x0 + ((n3(vec3(y * 1.4, s, 0.1)) - 0.5) * 0.9 + (n3(vec3(y * 6.0, s, 0.5)) - 0.5) * 0.22) * (0.3 + 0.7 * y);
}
// A forked bolt down the frame: the glow at c (frame units, y up). top/bot: its ends' y; s: its seed.
float bolt(vec2 c, float x0, float top, float bot, float s) {
  if (c.y > top + 0.1 || c.y < bot - 0.1) return 0.0;
  float y = (top - c.y) / (top - bot);
  float d = abs(c.x - trunkX(y, x0, s));
  float fade = ss(-0.02, 0.06, y) * (1.0 - ss(0.92, 1.03, y));
  float g = (exp(-d * 500.0 / uScale) * 1.5 + exp(-d * 60.0) * 0.4 + exp(-d * 12.0) * 0.12) * fade;
  // The fork: off the trunk a third of the way down, thinner, fading toward its tip.
  float yb = (y - 0.33) / 0.4;
  if (yb > 0.0 && yb < 1.0) {
    float side = sign(hash(vec2(s, 1.7)) - 0.5);
    float xb = trunkX(y, x0, s) + side * (yb * 0.24 + (n3(vec3(yb * 5.0, s + 0.3, 0.7)) - 0.5) * 0.12 * yb);
    float db = abs(c.x - xb);
    g += (exp(-db * 800.0 / uScale) + exp(-db * 90.0) * 0.25) * (1.0 - yb) * 0.8;
  }
  return g;
}
vec3 storm(vec2 uv, vec3 src) {
  float ph = uPhase;
  float A = uRes.x / uRes.y;
  vec2 c = (uv - 0.5) * vec2(A, 1.0);
  float r = length(c) / length(vec2(A, 1.0) * 0.5);
  float cov = clamp(min(ph, 1.0 - ph) / 0.44, 0.0, 1.0);
  // Climbing: the cloud streams down past the lens. In, it closes from below and the edges first; out,
  // it tears open from the middle.
  float climb = ph * 2.2 + uTime * 0.03;
  float lead = cov * (1.0 + 0.9 * ss(0.1, 1.0, r) + 0.5 * ss(0.2, -0.5, c.y) * step(ph, 0.5));
  float boil = uTime * 0.035;
  float far = billow(c * 1.1 + vec2(0.0, climb * 0.5), 0.2 + boil);
  float near = billow(c * 0.55 + vec2(0.3, climb), 0.6 + boil * 1.4);
  float thF = mix(0.9, 0.1, clamp(lead * 1.1, 0.0, 1.0)), thN = mix(1.0, 0.18, clamp(lead - 0.05, 0.0, 1.0));
  float aF = ss(thF, thF + 0.16, far), aN = ss(thN, thN + 0.12, near);
  // Lightning: strikes at fixed moments of the scroll (so a reader who pauses on one sees it hold and
  // stutter), and unplaced flickers in time, deep in the cloud.
  float slot = floor(uTime * 1.3), ft = fract(uTime * 1.3);
  float sh = hash(vec2(slot, 4.1));
  float flick = step(0.5, sh) * exp(-ft * 7.0) * (0.6 + 0.4 * step(0.5, fract(ft * 9.0)));
  vec2 at = vec2((hash(vec2(slot, 2.3)) - 0.5) * A * 0.8, (hash(vec2(slot, 7.9)) - 0.5) * 0.6);
  float strike = 0.0, sx = 0.0, seed = 0.0;
  for (int k = 0; k < 3; k++) {
    float m = k == 0 ? 0.28 : k == 1 ? 0.45 : 0.68; // the strikes' moments in the phase: the middle of the cover stays dark
    float e = exp(-abs(ph - m) * 32.0);
    if (e > strike) { strike = e; sx = (hash(vec2(float(k), 3.3)) - 0.5) * A * 0.6; seed = float(k) * 1.7 + 0.4; }
  }
  strike *= 0.75 + 0.25 * step(0.4, fract(uTime * 11.0));
  float inner = flick * cov * exp(-length(c - at) * 2.2) + strike * exp(-length(c - vec2(sx, 0.2)) * 1.4);
  // The cloud: slate in its body, a cold rim where the city's light (and then the dusk's) catches its
  // edges, lit through from inside where the lightning is.
  float late = ss(0.5, 0.75, ph);
  vec3 body = mix(vec3(0.03, 0.035, 0.06), vec3(0.06, 0.04, 0.07), late);
  vec3 rim = mix(vec3(0.2, 0.26, 0.38), vec3(0.42, 0.3, 0.36), late);
  vec3 cF = mix(rim * 0.7, body * 1.4, ss(thF + 0.02, thF + 0.3, far)) + BOLT * inner * (0.5 + far) * 1.1;
  vec3 cN = mix(rim, body, ss(thN + 0.01, thN + 0.22, near)) + BOLT * inner * (0.3 + near) * 0.8;
  vec3 col = mix(src, src * 0.35 + body, ss(0.0, 0.6, lead) * 0.85); // the world darkens before the masses close
  col = mix(col, cF, aF);
  col = mix(col, cN, aN);
  // Inside, at the middle: dark churning cloud, faintly electric, lit in pulses; never a flat black.
  float inside = ss(0.4, 0.44, ph) * (1.0 - ss(0.56, 0.6, ph));
  float deep = billow(c * 0.8 + vec2(0.0, climb * 0.8), 0.9 + boil * 2.0);
  vec3 dark = body * (0.7 + 1.6 * deep) + BOLT * (0.03 * deep + inner * (0.4 + deep) * 0.8);
  col = mix(col, dark, inside);
  // The bolts themselves, in front of all but the nearest wisps.
  float b = strike * bolt(c, sx, 0.55, -0.45 - 0.3 * hash(vec2(seed, 9.1)), seed);
  b += flick * cov * step(0.8, sh) * bolt(c, at.x, 0.55, at.y - 0.1, slot * 0.37) * 0.8;
  col += BOLT * b * (1.0 - aN * 0.6);
  // Rain: long thin streaks on a slant at two depths, heaviest at the middle.
  vec2 rp = vec2(c.x + c.y * 0.18, c.y) * vec2(uRes.y / (3.0 * uScale), 1.0);
  float rain = 0.0;
  for (int k = 0; k < 2; k++) {
    vec2 q = rp * vec2(k == 0 ? 1.0 : 0.55, 1.0);
    float h = hash(vec2(floor(q.x), float(k) + 1.0));
    float y = fract(q.y * (0.8 + h) * 1.4 + uTime * (2.4 + h * 1.6) * (1.0 + float(k) * 0.5) + h * 7.0);
    rain += step(0.84, h) * ss(0.0, 0.08, y) * (1.0 - ss(0.12, 0.3, y)) * (1.0 - ss(0.15, 0.5, abs(fract(q.x) - 0.5) * 2.0)) * (k == 0 ? 0.5 : 0.28);
  }
  col += mix(vec3(0.5, 0.58, 0.72), BOLT, clamp(inner, 0.0, 1.0)) * rain * ss(0.05, 0.4, cov) * (0.35 + 0.65 * max(aN, inside));
  // A near strike flashes the whole frame electric blue-white.
  col += BOLT * 0.12 * strike * cov;
  return col;
}

// ---------------------------------------------------------------- flash
const vec3 STRIKE = vec3(0.92, 0.95, 1.0);
const vec3 POP = vec3(0.95, 0.97, 1.0); // one colour temperature through the cover: no cream step
vec3 flash(vec2 uv, vec3 src) {
  float ph = uPhase;
  float A = uRes.x / uRes.y;
  vec2 c = (uv - 0.5) * vec2(A, 1.0);
  // ---- the whiteout: the picture burns out from its highlights, then a burst from the strike (high in
  // the middle) spreads to every corner; the frame is white by the plateau.
  float burn = ss(0.0, 0.4, ph);
  vec3 hot = vec3(1.0) - exp(-src * (1.0 + 40.0 * burn * burn));
  float front = ss(0.12, 0.44, ph) * 2.2 - length(c - vec2(0.0, 0.18)) * 1.1;
  vec3 col = mix(src, hot, ss(0.0, 0.12, ph));
  col = mix(col, STRIKE, ss(0.0, 0.5, front));
  if (ph < 0.5) return col;
  // ---- breaking up: the white veil thins off the stadium and leaves a sea of camera flashes, each a
  // soft point (a few pixels across) with a short cross streak, at first a steady glare and then
  // popping on its own clock, fewer and fewer: added light over the picture, never a mask.
  float b = ss(0.5, 0.95, ph);
  vec2 px = uv * uRes;
  float veil = 1.0 - ss(0.0, 0.5, b);
  float acc = 0.0;
  for (int L = 0; L < 2; L++) {
    float cell = (L == 0 ? 26.0 : 12.0) * uScale;
    vec2 g = px / cell, id = floor(g);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 n = id + vec2(float(i), float(j));
      float h = hash(n + float(L) * 17.0), h2 = hash(n * 1.37 + 3.1 + float(L));
      vec2 d = (g - (n + 0.5 + (vec2(h, h2) - 0.5) * 0.8)) * cell / uScale; // from its centre, in css pixels
      float live = step(h2, 1.0 - 0.9 * b); // the crowd's flashes thin out
      float I = live * mix(1.0, exp(-fract(uTime * (0.6 + h2) + h * 9.0) * 4.0), ss(0.1, 0.4, b));
      float rc = mix(9.0, 1.0 + 3.0 * h2, ss(0.0, 0.35, b)); // its core shrinks to 2-8 px across
      float core = exp(-dot(d, d) / (rc * rc));
      float len = L == 0 ? 5.0 + 8.0 * h : 3.0 + 2.0 * h;
      float streak = exp(-abs(d.x) / len) * exp(-d.y * d.y / 1.2) + exp(-abs(d.y) / len) * exp(-d.x * d.x / 1.2);
      acc += I * (core + 0.5 * streak * ss(0.05, 0.3, b)) * (L == 0 ? 1.0 : 0.6);
    }
  }
  col = mix(src, STRIKE, veil) + POP * acc * 1.2;
  return mix(col, src, ss(0.85, 1.0, ph)); // and the last pops give way to the stadium's own
}

// ---------------------------------------------------------------- whip
// The cover's own picture: the low sun and the city smeared into horizontal light by a pan too fast to
// see, warm on the way in and night-blue on the way out. Independent of the frame, so the swap is hidden.
vec3 smear(vec2 c, float ph, float night) {
  float run = ph * 9.0 + uTime * 0.6; // the pan: everything races left, faster at the middle
  vec3 sky = mix(mix(vec3(1.0, 0.62, 0.3), vec3(0.42, 0.2, 0.3), ss(-0.1, 0.5, c.y)), mix(vec3(0.05, 0.07, 0.17), vec3(0.01, 0.015, 0.05), ss(-0.2, 0.5, c.y)), night);
  vec3 col = sky * (0.75 + 0.5 * n3(vec3(c.x * 0.04 + run * 0.05, c.y * 2.5, 0.37)));
  // Streaks at three sizes: the volume's noise stretched forty times along x is a field of light lines.
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float s = n3(vec3(c.x * (0.05 + 0.03 * fk) + run * (0.12 + 0.06 * fk), c.y * (7.0 + 9.0 * fk), 0.13 + 0.29 * fk));
    float line = pow(ss(0.45, 0.85, s), 3.0) * (0.9 - 0.25 * fk);
    vec3 hue = mix(mix(vec3(1.0, 0.86, 0.6), vec3(1.0, 0.55, 0.25), fk * 0.5), mix(vec3(0.55, 0.7, 1.0), vec3(1.0, 0.7, 0.35), fk * 0.5), night);
    col += hue * line;
  }
  return col;
}
vec3 whip(vec2 uv, vec3 src) {
  float ph = uPhase;
  vec2 c = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float cov = clamp(min(ph, 1.0 - ph) / 0.44, 0.0, 1.0);
  float night = ss(0.42, 0.58, ph);
  // Motion blur along x, longer as the pan speeds up: the picture smears into its own streaks.
  float len = 0.28 * cov * cov;
  vec3 acc = vec3(0.0);
  for (int k = 0; k < 12; k++) acc += texture2D(inputBuffer, vec2(uv.x + (float(k) / 11.0 - 0.5) * len, uv.y)).rgb;
  vec3 col = mix(src, acc / 12.0, ss(0.0, 0.3, cov));
  // Going in, the sun's warmth floods the smear; coming out, the dusk drains to night as the pan slows.
  col *= mix(mix(vec3(1.0), vec3(1.12, 0.96, 0.8), ss(0.0, 0.5, cov)), mix(vec3(1.0), vec3(0.78, 0.86, 1.08), ss(0.0, 0.6, cov)), night);
  vec3 lines = smear(c, ph, night);
  col += lines * 0.35 * ss(0.15, 0.7, cov) * (1.0 - ss(0.75, 1.0, cov)); // the first streaks over the smear
  return mix(col, lines, ss(0.6, 1.0, cov)); // whole by the plateau
}

// ---------------------------------------------------------------- bats
const vec3 NIGHT_INK = vec3(0.008, 0.01, 0.02);
// A bat, wingspan 2 across x in its own frame, y up; flap -1..1 (wings down..up). Returns how much of the
// pixel it covers, px being a pixel's size in its frame.
float bat(vec2 p, float flap, float px) {
  float ax = abs(p.x);
  float body = (length(p / vec2(0.12, 0.3)) - 1.0) * 0.12;
  vec2 e = vec2(ax - 0.07, p.y - 0.28);
  float ear = max(abs(e.x) - 0.035 * (1.0 - e.y / 0.12), max(-e.y, e.y - 0.12)); // two pointed ears
  float tip = 0.1 + 0.6 * flap;
  float top = mix(0.14, tip, ax) + 0.1 * sin(ax * 3.14159) * (0.4 + 0.6 * flap); // the leading edge, arched
  float bot = top - mix(0.4, 0.04, ax) + 0.12 * abs(sin(ax * 9.42)) * ss(0.12, 0.3, ax); // scalloped trailing edge
  float wing = max(max(p.y - top, bot - p.y), ax - 1.0);
  float d = min(min(body, ear), wing);
  return 1.0 - ss(-px, px, d);
}
vec3 bats(vec2 uv, vec3 src) {
  float ph = uPhase;
  float A = uRes.x / uRes.y;
  vec2 c = (uv - 0.5) * vec2(A, 1.0);
  float cov = clamp(min(ph, 1.0 - ph) / 0.44, 0.0, 1.0);
  // The swarm sweeps in from the right and leaves to the left: its front crosses the frame each way.
  float x01 = uv.x;
  float lead = clamp(cov * 1.6 - (ph < 0.5 ? 1.0 - x01 : x01) * 0.6, 0.0, 1.0);
  // Behind the swarm, a moonlit night: deep blue, a pale crescent moon high right, thin cloud across it.
  // A crescent, not a full disc: a bat crossing a full moon reads as a bat-signal (no logos).
  vec2 moon = vec2(A * 0.22, 0.24);
  float m = length(c - moon);
  float crescent = (1.0 - ss(0.07, 0.075, m)) * ss(0.062, 0.067, length(c - moon - vec2(-0.03, 0.022)));
  vec3 back = mix(vec3(0.03, 0.04, 0.08), vec3(0.08, 0.1, 0.17), ss(0.5, -0.5, c.y));
  back += vec3(0.55, 0.6, 0.72) * (exp(-m * 5.0) * 0.32 + crescent * 0.8);
  back *= 0.8 + 0.4 * n3(vec3(c * vec2(0.35, 1.2) + vec2(uTime * 0.01, 0.0), 0.61));
  vec3 col = mix(src, src * 0.3 + back * 0.4, ss(0.0, 0.8, lead) * 0.85); // the light goes as they come
  col = mix(col, back, ss(0.55, 1.0, cov));
  // Four depths of bats, near ones bigger, faster and fewer; each cell of a layer holds at most one.
  float shade = 0.0;
  for (int L = 0; L < 4; L++) {
    float fl = float(L);
    float cell = 0.06 + 0.07 * fl;
    vec2 q = c * vec2(1.0, 1.0) + vec2(uTime * (0.25 + 0.2 * fl) + ph * (2.0 + 1.5 * fl), uTime * 0.05 * (fl - 1.5));
    q.y += sin(q.x * 2.3 + fl) * 0.04;
    vec2 g = q / cell, id = floor(g), f = fract(g) - 0.5;
    float h = hash(id + fl * 13.1), h2 = hash(id * 1.7 + fl * 5.3);
    float dens = clamp(lead * (1.35 - 0.2 * fl) - h * 0.9, 0.0, 1.0);
    if (dens <= 0.0) continue;
    vec2 jit = (vec2(h2, hash(id + 3.3)) - 0.5) * 0.3;
    float s = (0.2 + 0.08 * h) * ss(0.0, 0.3, dens);
    float flap = sin(uTime * (11.0 + 6.0 * h) + h * 40.0);
    vec2 p = (f - jit) / s;
    p.y -= 0.12 * flap; // the body rises as the wings beat down
    float b = bat(p, flap, 1.6 * uScale / (uRes.y * cell * s));
    shade = max(shade, b);
  }
  // Silhouettes, a faint cold rim where the moon catches them.
  return mix(col, NIGHT_INK + vec3(0.02, 0.025, 0.04) * exp(-m * 3.0), shade);
}

// ---------------------------------------------------------------- comic
// Five panels on a page with slanted gutters, laid across a landscape frame or down a portrait one.
// q is the page (0..1 both ways); returns the panel under it.
int panelOf(vec2 q) {
  if (q.x < 0.44 + 0.06 * (q.y - 0.5)) return q.y > 0.58 + 0.04 * q.x ? 0 : 1;
  return q.y > 0.68 - 0.05 * q.x ? 2 : q.y > 0.3 + 0.05 * q.x ? 3 : 4;
}
// Distance (in page pixels) from q to the nearest edge of its own panel.
float panelEdge(vec2 q, vec2 res) {
  float d = min(min(q.x, 1.0 - q.x) * res.x, min(q.y, 1.0 - q.y) * res.y);
  d = min(d, abs(q.x - 0.44 - 0.06 * (q.y - 0.5)) * res.x);
  if (q.x < 0.44 + 0.06 * (q.y - 0.5)) d = min(d, abs(q.y - 0.58 - 0.04 * q.x) * res.y);
  else d = min(min(d, abs(q.y - 0.68 + 0.05 * q.x) * res.y), abs(q.y - 0.3 - 0.05 * q.x) * res.y);
  return d;
}
vec2 panelCentre(int i) {
  return i == 0 ? vec2(0.22, 0.8) : i == 1 ? vec2(0.22, 0.3) : i == 2 ? vec2(0.72, 0.85) : i == 3 ? vec2(0.72, 0.5) : vec2(0.72, 0.15);
}
// Halftone dots on a 45 degree screen: tone 0..1 is how much of the cell the dot covers.
float dots(vec2 px, float cell, float tone) {
  vec2 r = mat2(0.7071, -0.7071, 0.7071, 0.7071) * px / cell;
  float d = length(fract(r) - 0.5);
  float rad = 0.72 * sqrt(clamp(tone, 0.0, 1.0));
  return 1.0 - ss(rad - 0.06, rad + 0.06, d);
}
vec3 panelArt(int i, vec2 q, vec2 px, float flash) {
  vec3 ink = vec3(0.04, 0.03, 0.05);
  vec3 a = i == 0 ? vec3(1.0, 0.84, 0.08) : i == 1 ? vec3(0.08, 0.62, 0.95) : i == 2 ? vec3(0.93, 0.13, 0.17) : i == 3 ? vec3(1.0, 0.84, 0.08) : vec3(0.93, 0.13, 0.17);
  vec3 paper = mix(vec3(1.0, 0.97, 0.9), a, 0.25);
  vec2 k = q - panelCentre(i);
  float cell = 9.0 * uScale;
  vec3 col;
  if (i == 1 || i == 3) {
    // Speed lines bursting from a point: black rays on the panel's colour.
    float ang = atan(k.y, k.x * 1.6);
    float ray = step(0.62, hash(vec2(floor(ang * 26.0), float(i)))) * ss(0.04, 0.25, length(k));
    col = mix(mix(paper, a, dots(px, cell, 0.25 + 0.5 * length(k) * 2.0)), ink, ray * 0.9);
  } else {
    // A flat colour in big dots, denser toward the panel's lower corner.
    float tone = 0.25 + 0.7 * ss(-0.3, 0.35, -k.y + k.x * 0.3);
    col = mix(paper, a, dots(px, cell, tone));
  }
  return mix(col, vec3(1.0), flash);
}
// One stroke of a letter: distance to the segment a-b.
float seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
// The burst word, in its own frame (letters 0.16 tall): the distance to its strokes' centre lines.
float powWord(vec2 p) {
  vec2 P = p + vec2(0.17, 0.0), O = p, W = p - vec2(0.17, 0.0);
  float bowl = P.x > -0.01 ? abs(length(P - vec2(-0.01, 0.035)) - 0.045) : 1.0;
  float dP = min(min(seg(P, vec2(-0.05, -0.08), vec2(-0.05, 0.08)), bowl), min(seg(P, vec2(-0.05, 0.08), vec2(-0.01, 0.08)), seg(P, vec2(-0.05, -0.01), vec2(-0.01, -0.01))));
  float dO = abs(length(O / vec2(0.055, 0.08)) - 1.0) * 0.055;
  float dW = min(min(seg(W, vec2(-0.07, 0.08), vec2(-0.035, -0.08)), seg(W, vec2(-0.035, -0.08), vec2(0.0, 0.035))), min(seg(W, vec2(0.0, 0.035), vec2(0.035, -0.08)), seg(W, vec2(0.035, -0.08), vec2(0.07, 0.08))));
  return min(min(dP, dO), dW);
}
vec3 comic(vec2 uv, vec3 src) {
  float ph = uPhase;
  float A = uRes.x / uRes.y;
  bool tall = A < 0.85;
  vec2 res = tall ? uRes.yx : uRes;
  // Each panel slams in at its own moment (in) and slides off the page (out).
  float T0 = 0.04, DT = 0.075;
  // The page shakes as each one lands.
  vec2 shake = vec2(0.0);
  for (int i = 0; i < 5; i++) {
    float at = T0 + DT * float(i) + 0.035;
    float e = step(at, ph) * exp(-(ph - at) * 90.0);
    shake += e * vec2(hash(vec2(float(i), 1.0)) - 0.5, hash(vec2(float(i), 2.0)) - 0.5) * 0.012;
  }
  vec2 u = uv + shake * step(ph, 0.5);
  vec2 page = tall ? vec2(1.0 - u.y, u.x) : u;
  // Before the panels, the world itself goes to print: posterised colour in halftone dots, and back.
  float print = ss(0.0, 0.14, ph) * (1.0 - ss(0.86, 1.0, ph));
  float lum = dot(src, vec3(0.299, 0.587, 0.114));
  vec3 poster = floor(src / max(lum, 0.02) * 2.0 + 0.5) / 2.0 * 0.85 + 0.1;
  // Two screens, as a press prints: the hue in fine dots on the paper, and black in dots where it is dark.
  vec3 hue = mix(vec3(1.0, 0.97, 0.9), poster, dots(uv * uRes, 8.0 * uScale, 0.55));
  hue *= 1.0 - 0.92 * dots(uv * uRes * 1.13 + 3.0, 8.0 * uScale, clamp(1.0 - lum * 1.8, 0.0, 1.0));
  vec3 col = mix(src, hue, print * 0.9);
  vec3 ink = vec3(0.04, 0.03, 0.05);
  float G = 6.0 * uScale, B = 4.5 * uScale; // half a gutter (paper) and the ink border, in pixels
  for (int i = 0; i < 5; i++) {
    float at = T0 + DT * float(i), out0 = 0.6 + 0.07 * float(i);
    float in1 = ss(at, at + 0.035, ph);
    if (in1 <= 0.0) continue;
    vec2 ctr = panelCentre(i);
    // Slam: it lands from larger, fast; leave: it slides off the page outward.
    float s = 1.0 + 0.35 * (1.0 - in1) * (1.0 - in1);
    float go = ss(out0, out0 + 0.09, ph);
    vec2 away = vec2(ctr.x < 0.5 ? -1.0 : 1.0, (ctr.y - 0.5) * 0.6) * 1.25 * go * go;
    vec2 q = ctr + (page - ctr) / s - away;
    if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0 || panelOf(q) != i) continue;
    float d = panelEdge(q, res);
    float flash = (1.0 - ss(at + 0.035, at + 0.07, ph)) * 0.8;
    vec3 art = panelArt(i, q, q * res, flash);
    col = d < G ? vec3(1.0, 0.98, 0.94) : d < G + B ? ink : art;
  }
  // The burst at the middle of the cover: a jagged star in yellow and red, ink-outlined, and its word.
  float pop = ss(0.36, 0.4, ph) * (1.0 - ss(0.62, 0.66, ph));
  if (pop > 0.0) {
    float S = tall ? A : 1.0;
    vec2 c = (uv - 0.5) * vec2(A, 1.0) / S;
    float rot = -0.12;
    c = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * c;
    float sc = pop * (1.0 + 0.25 * (1.0 - ss(0.36, 0.42, ph)));
    c /= max(sc, 1e-3);
    float ang = atan(c.y, c.x) / 6.28318 + 0.5;
    float sp = fract(ang * 14.0), si = floor(ang * 14.0);
    float R = 0.27 * (0.72 + 0.28 * (1.0 - abs(sp - 0.5) * 2.0) * (0.6 + 0.4 * hash(vec2(si, 4.0))));
    float r = length(c * vec2(0.85, 1.0));
    float px = 1.5 * uScale / (uRes.y / S * max(sc, 1e-3));
    vec3 burst = mix(vec3(0.93, 0.13, 0.17), vec3(1.0, 0.84, 0.08), ss(R * 0.55, R * 0.8, r));
    burst = mix(burst, ink, ss(R - 0.012 - px, R - 0.012, r));
    col = mix(col, burst, 1.0 - ss(R - px, R, r));
    float w = powWord(c * 1.25) / 1.25;
    col = mix(col, ink, 1.0 - ss(0.034, 0.034 + px, w));
    col = mix(col, vec3(1.0, 0.96, 0.75), 1.0 - ss(0.017, 0.017 + px, w));
  }
  return col;
}

// ---------------------------------------------------------------- laser
const vec3 RED = vec3(1.0, 0.07, 0.05);
const vec3 HOT = vec3(1.0, 0.62, 0.56);
const vec3 VAULT = vec3(0.93, 0.96, 1.0); // the flare's white: cool, the vault's own
// A beam's light at distance d (frame units) from its line: a hot core a pixel or two wide and its glow in the haze.
vec3 beam(float d, float px) {
  float core = exp(-d * d / (px * px * 1.6));
  return RED * (core * 1.4 + exp(-abs(d) * 26.0) * 0.22) + HOT * core * 0.6;
}
vec3 laser(vec2 uv, vec3 src) {
  float ph = uPhase;
  float A = uRes.x / uRes.y;
  vec2 c = (uv - 0.5) * vec2(A, 1.0);
  float r = length(c) / length(vec2(A, 1.0) * 0.5);
  float px = 1.4 * uScale / uRes.y;
  // Going in: the light goes and the air fills with red haze as the beams multiply; by the plateau's
  // start (0.44) the frame is all grid, whatever was under it.
  float dark = ss(0.0, 0.44, ph);
  float hz = n3(vec3(c * 0.5 + vec2(uTime * 0.01, 0.0), 0.41 + uTime * 0.006));
  vec3 haze = vec3(0.09, 0.006, 0.012) * (0.6 + 0.8 * hz) * (0.5 + 1.5 * dark);
  vec3 col = mix(src, src * 0.18 + haze, ss(0.0, 0.3, dark));
  col = mix(col, haze, ss(0.25, 1.0, dark));
  // Sweeping beams: each comes on at its own moment, crosses the frame at its own angle and keeps turning.
  vec3 light = vec3(0.0);
  float count = 1.0 + 13.0 * ss(0.02, 0.4, ph);
  for (int k = 0; k < 14; k++) {
    float fk = float(k);
    float on = ss(fk, fk + 1.0, count);
    if (on <= 0.0) break;
    float h = hash(vec2(fk, 2.7)), h2 = hash(vec2(fk, 8.1));
    float a = (h - 0.5) * 2.4 + sin(uTime * (0.3 + 0.3 * h2) + fk) * 0.25;
    vec2 n = vec2(sin(a), cos(a));
    float o = sin(uTime * (0.4 + 0.5 * h) + h2 * 6.28 + ph * 6.0) * 0.45;
    light += beam(dot(c, n) - o, px) * on;
  }
  // ...and the lattice they become: two crossed families of parallel beams, closing in toward the plateau.
  float dens = ss(0.12, 0.44, ph);
  if (dens > 0.0) {
    float sp = mix(0.3, 0.045, dens);
    for (int k = 0; k < 2; k++) {
      float a = k == 0 ? 0.42 : -0.42;
      vec2 n = vec2(sin(a), cos(a));
      float x = dot(c, n) / sp + uTime * (k == 0 ? 0.05 : -0.04) + ph * 2.0;
      light += beam((fract(x) - 0.5) * sp, px) * dens * 0.8;
    }
  }
  col += light * (1.0 - ss(0.47, 0.5, ph)); // the beams switch off under the flare
  // The white flare: a burst from the middle across the plateau, the whole frame white by its middle.
  float burst = ss(0.44, 0.5, ph) * 2.4 - r;
  col = mix(col, VAULT, ss(0.0, 0.35, burst));
  // Coming out: the white opens from the middle onto the world; the last of the flare lingers at the edges.
  if (ph > 0.56) {
    float open = ss(0.56, 0.95, ph) * 1.7 - r * 0.6;
    col = mix(VAULT, src, ss(0.0, 0.9, open)) + VAULT * 0.25 * (1.0 - ss(0.56, 1.0, ph)) * ss(0.4, 1.0, r);
  }
  return col;
}

void main() {
  vec3 src = texture2D(inputBuffer, vUv).rgb;
  gl_FragColor = vec4(
    uMode < 0.5 ? cloud(vUv, src) : uMode < 1.5 ? tech(vUv) : uMode < 2.5 ? storm(vUv, src) : uMode < 3.5 ? flash(vUv, src)
    : uMode < 4.5 ? whip(vUv, src) : uMode < 5.5 ? bats(vUv, src) : uMode < 6.5 ? comic(vUv, src) : laser(vUv, src), 1.0);
}`

const MODES = { cloud: 0, tech: 1, storm: 2, flash: 3, whip: 4, bats: 5, comic: 6, laser: 7 }

export class LevelFxPass extends Pass {
  constructor(noise) {
    super('LevelFxPass')
    this.enabled = false
    this.fullscreenMaterial = new THREE.ShaderMaterial({
      uniforms: {
        inputBuffer: { value: null }, tNoise: { value: noise },
        uMode: { value: 0 }, uPhase: { value: 0 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uScale: { value: 1 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthWrite: false,
      depthTest: false,
    })
    this.uniforms = this.fullscreenMaterial.uniforms
  }

  /** kind: 'cloud' | 'tech' | 'storm' | 'flash' | 'whip' | 'bats' | 'comic' | 'laser'; phase 0..1 through the transition (0.5 = full cover). */
  set(kind, phase, t) {
    this.uniforms.uMode.value = MODES[kind] ?? 0
    this.uniforms.uPhase.value = phase
    this.uniforms.uTime.value = t
  }

  setSize(w, h) {
    this.uniforms.uRes.value.set(Math.max(1, w), Math.max(1, h))
    this.uniforms.uScale.value = Math.max(1, h / 1100) // cells and strokes keep their look on dense screens
  }

  render(renderer, inputBuffer, outputBuffer) {
    this.uniforms.inputBuffer.value = inputBuffer.texture
    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer)
    renderer.render(this.scene, this.camera)
  }
}
