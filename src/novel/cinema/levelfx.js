import * as THREE from 'three'
import { Pass } from 'postprocessing'

/*
 * The covering transitions between Chapter Four's worlds (levels.js): one full-screen pass, enabled
 * only while a transition is on screen. Each is driven by a phase 0..1; across the plateau around 0.5
 * the frame is fully covered, and the world behind it is swapped there.
 *   CLOUD  three decks of cumulus roll in from the edges of the frame, lit from the upper left, close
 *          into the white of being inside one, and part from the middle as you come down through them.
 *   TECH   the picture breaks into a mosaic of cells from the top down, the cells turn to a console of
 *          glyph rows round a boot dial, and the next world scans back in as a night-vision phosphor
 *          image that settles into its true colours.
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

void main() {
  vec3 src = texture2D(inputBuffer, vUv).rgb;
  gl_FragColor = vec4(uMode < 0.5 ? cloud(vUv, src) : tech(vUv), 1.0);
}`

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

  /** kind: 'cloud' | 'tech'; phase 0..1 through the transition (0.5 = full cover). */
  set(kind, phase, t) {
    this.uniforms.uMode.value = kind === 'tech' ? 1 : 0
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
