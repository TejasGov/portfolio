import * as THREE from 'three'
import { Pass } from 'postprocessing'

/*
 * The world as an ink drawing on the book's paper, and the wave that turns it back into the lit world.
 * One pass at the end of the chain, from depth alone:
 *   ink lines  - the Laplacian of linear depth (silhouettes and creases), wobbled by noise like a pen
 *   hatching   - diagonal strokes where a surface turns away from an upper-left key light, crossed in
 *                the deepest shade
 *   paper      - the site's paper colour with a little fibre, so the drawing meets the paper chapters
 *                with no cut
 * The wave is in world space: a wavy sphere growing from `origin` (or a plane along `dir`). Behind its
 * front the world is in full colour, ahead of it the drawing; at the front the colour bleeds into the
 * paper like watercolour, the world refracts, a crisp line of light with a
 * soft halo runs along it, and the colour arrives first as a grid of light lines. Each seam sets its
 * own crest tint, or takes the hue of the world it reveals (Monolith's wave, in our own materials).
 */
const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }`

const FRAG = /* glsl */ `
#include <common>
uniform sampler2D inputBuffer; uniform highp sampler2D depthBuffer; uniform highp sampler3D tNoise;
uniform mat4 uInvProj; uniform mat4 uCamWorld; uniform vec2 uTexel; uniform float uTime;
uniform vec3 uOrigin; uniform float uR; uniform float uBand; uniform float uColorBehind;
uniform float uPlane; uniform vec3 uDir; uniform float uLines;
uniform vec3 uTint; uniform vec3 uTint2; uniform float uAuto; uniform float uGrid; uniform float uShimmer;
uniform vec3 uPaper; uniform vec3 uInk; uniform vec3 uKey; uniform float uScale;
varying vec2 vUv;

vec3 viewAt(vec2 uv) {
  float z = texture2D(depthBuffer, uv).r;
  vec4 v = uInvProj * vec4(uv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
  return v.xyz / v.w;
}
float noise3(vec3 p) { return texture(tNoise, p).r; }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
// Hatch strokes along angle a: 1 on a stroke. Spacing in pixels; k (0..1) thickens them.
float hatch(vec2 px, float a, float spacing, float k, float wob) {
  float y = (rot(a) * px).y / spacing + wob;
  float l = abs(fract(y) - 0.5) * 2.0;
  return 1.0 - smoothstep(k * 0.55, k * 0.55 + 0.35, l);
}

void main() {
  vec4 src = texture2D(inputBuffer, vUv);
  if (uR > 1e4) { gl_FragColor = src; return; } // at rest: the lit world, untouched

  vec2 px = vUv / uTexel;
  float rawZ = texture2D(depthBuffer, vUv).r;
  bool far = rawZ > 0.999999;
  vec3 p = viewAt(vUv);
  vec3 world = (uCamWorld * vec4(p, 1.0)).xyz;

  // ---- the drawing
  // A pen never lands on the exact edge: wobble the sample offsets with slow noise.
  vec2 wob = (vec2(noise3(vec3(px * 0.004, 0.3)), noise3(vec3(px * 0.004, 0.7))) - 0.5) * 2.4;
  vec2 o = uTexel * (1.25 * uScale);
  float zc = -p.z;
  float zl = -viewAt(vUv + (vec2(-1.0, 0.0) + wob * 0.3) * o).z;
  float zr = -viewAt(vUv + (vec2(1.0, 0.0) + wob * 0.3) * o).z;
  float zd = -viewAt(vUv + (vec2(0.0, -1.0) + wob * 0.3) * o).z;
  float zu = -viewAt(vUv + (vec2(0.0, 1.0) + wob * 0.3) * o).z;
  float lap = abs(zl + zr + zd + zu - 4.0 * zc) / max(zc, 0.1);
  float line = smoothstep(0.012, 0.05, lap) * (far ? 0.0 : 1.0);
  // Pressure varies along a stroke.
  line *= 0.65 + 0.35 * noise3(vec3(px * 0.02, 0.5));

  vec3 n = normalize(cross(dFdx(p), dFdy(p)));
  vec3 nw = normalize(mat3(uCamWorld) * n);
  float lit = max(dot(nw, normalize(uKey)), 0.0);
  float shade = far ? 0.0 : 1.0 - lit;
  float hw = (noise3(vec3(px * 0.003, 1.3)) - 0.5) * 0.8;
  // A light single hatch on turned-away walls; the cross-hatch only in the deepest shade, so flat walls never moire.
  float h1 = hatch(px, 0.79, 7.0 * uScale, smoothstep(0.68, 1.0, shade) * 0.6, hw) * smoothstep(0.68, 0.8, shade);
  float h2 = hatch(px, -0.62, 9.0 * uScale, smoothstep(0.9, 1.0, shade) * 0.5, hw * 1.3) * smoothstep(0.9, 0.97, shade);
  // Fade the strokes with distance, as an illustrator would leave the back of the room loose.
  float dist = smoothstep(60.0, 8.0, zc);
  float ink = clamp(line + (h1 * 0.45 + h2 * 0.35) * dist, 0.0, 1.0) * uLines; // uLines fades the drawing on and off the page
  float fibre = noise3(vec3(px * 0.35, 2.1)) * 0.06 + noise3(vec3(px * 0.03, 4.0)) * 0.05;
  vec3 paper = uPaper * (0.97 + fibre - 0.04);
  vec3 drawing = mix(paper, uInk, ink * 0.88);

  // ---- the wave
  // A growing sphere from the origin, or (uPlane) a flat front that travels along uDir.
  float reach = uPlane > 0.5 ? dot(world - uOrigin, uDir) : length(world - uOrigin);
  // The sky: last to bloom from a point; with a travelling front, it takes the colour of where the camera stands.
  float farReach = uPlane > 0.5 ? dot(uCamWorld[3].xyz - uOrigin, uDir) : 250.0;
  // A wavy front: a long swell and a fine ripple of noise, both drifting.
  float swell = (noise3(world * 0.07 + vec3(0.0, uTime * 0.02, 0.0)) - 0.5) * uBand * 2.2;
  float ripple = (noise3(world * 0.5 + vec3(uTime * 0.06, 0.0, uTime * 0.04)) - 0.5) * uBand * 0.45;
  float d = (far ? farReach : reach) - uR + (far ? 0.0 : swell + ripple);
  // Feathered across the band and never narrower than a pixel and a half, so the front never stair-steps.
  float fw = clamp(fwidth(d), 1e-4, uBand * 0.25);
  float feather = max(uBand * 0.3, fw * 1.5);
  float behind = 1.0 - smoothstep(-feather, feather, d);
  float colourK = uColorBehind > 0.5 ? behind : 1.0 - behind;
  // Near the front the world refracts, as through a lens of moving water (one offset: a colour split read as a tear).
  vec2 grad = vec2(dFdx(d), dFdy(d));
  float near = exp(-abs(d) / max(uBand * 0.7, 0.01)) * (far ? 0.0 : 1.0) * uShimmer;
  vec3 world_col = src.rgb;
  if (near > 0.02) {
    vec2 off = grad / max(length(grad), 1e-5) * uTexel * (3.5 * uScale) * near * sin(d * 6.0 - uTime * 3.0);
    world_col = texture2D(inputBuffer, vUv + off).rgb;
  }
  // The crest's colour: the seam's own tint, two-toned along the front, or (uAuto) the hue of the world it reveals.
  vec3 hue = world_col / max(max(world_col.r, max(world_col.g, world_col.b)), 1e-3);
  vec3 tint = mix(uTint, uTint2, 0.5 + 0.5 * sin(world.y * 1.3 + world.x * 0.2 + uTime * 0.8));
  vec3 crestCol = mix(tint, mix(hue, vec3(1.0), 0.35), uAuto);
  // Watercolour bleed just on the drawing side of the front: the paper takes the world's hue.
  float ahead = uColorBehind > 0.5 ? max(d, 0.0) : max(-d, 0.0);
  float bleed = exp(-ahead / max(uBand, 0.01)) * (1.0 - colourK);
  // A tinted seam bleeds its own colour, so the journey's paper doesn't go lime from the grass.
  vec3 bleedHue = mix(tint / max(max(tint.r, max(tint.g, tint.b)), 1e-3), hue, uAuto);
  drawing = mix(drawing, drawing * mix(vec3(1.0), bleedHue, 0.75) * 1.05, bleed);
  vec3 col = mix(drawing, world_col, colourK);
  // Where colour has just arrived, the world is first drawn in lines of light: a grid that fills in.
  float since = max(-d, 0.0);
  vec3 gq = world * 1.25 + 0.137;
  vec3 gw = max(fwidth(gq) * 1.2, vec3(1e-3));
  vec3 gline = smoothstep(0.5 - gw, vec3(0.5), abs(fract(gq) - 0.5)) * (1.0 - smoothstep(0.12, 0.3, gw)); // none where they would smear
  float grid = max(gline.x, max(gline.y, gline.z)) * (far ? 0.0 : 1.0);
  col += crestCol * grid * smoothstep(0.0, uBand * 0.25, since) * exp(-since / max(uBand * 1.6, 0.01)) * colourK * uGrid * 0.55;
  // The crest: a crisp core, a soft two-scale halo and a few glints, brighter as colour arrives than as it leaves.
  float core = 1.0 - smoothstep(0.0, max(fw * 1.5, uBand * 0.02), abs(d));
  float halo = exp(-abs(d) / max(uBand * 0.18, 0.01)) * 0.55 + exp(-abs(d) / max(uBand * 0.8, 0.01)) * 0.25;
  float glint = step(0.986, fract(sin(dot(floor(px / (6.0 * uScale)) + floor(uTime * 6.0), vec2(12.99, 78.23))) * 43758.5)) * exp(-abs(d) / max(uBand * 0.3, 0.01));
  col += crestCol * (core * 0.85 + halo * 0.5 + glint * 0.9) * mix(0.35, 1.0, uColorBehind) * (far ? 0.0 : 1.0);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`

export class SketchPass extends Pass {
  constructor(camera, noise) {
    super('SketchPass')
    this.needsDepthTexture = true
    this.cam = camera
    const lin = hex => new THREE.Color(hex) // THREE.Color converts sRGB hex to linear
    this.fullscreenMaterial = new THREE.ShaderMaterial({
      uniforms: {
        inputBuffer: { value: null }, depthBuffer: { value: null }, tNoise: { value: noise },
        uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uTexel: { value: new THREE.Vector2() },
        uTime: { value: 0 }, uOrigin: { value: new THREE.Vector3() }, uR: { value: 1e5 }, uBand: { value: 1.2 }, uColorBehind: { value: 1 }, uPlane: { value: 0 }, uDir: { value: new THREE.Vector3(1, 0, 0) }, uLines: { value: 1 },
        uTint: { value: new THREE.Color() }, uTint2: { value: new THREE.Color() }, uAuto: { value: 1 }, uGrid: { value: 0.4 }, uShimmer: { value: 0.8 },
        uPaper: { value: lin('#efe8da') }, uInk: { value: lin('#1d1913') }, uKey: { value: new THREE.Vector3(-0.5, 0.8, -0.4) }, uScale: { value: 1 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthWrite: false,
      depthTest: false,
    })
    this.uniforms = this.fullscreenMaterial.uniforms
  }

  setDepthTexture(t) {
    this.uniforms.depthBuffer.value = t
  }

  setSize(w, h) {
    this.uniforms.uTexel.value.set(1 / Math.max(1, w), 1 / Math.max(1, h))
    this.uniforms.uScale.value = Math.max(1, h / 1100) // strokes keep their look on dense screens
  }

  render(renderer, inputBuffer, outputBuffer) {
    const u = this.uniforms
    u.inputBuffer.value = inputBuffer.texture
    u.uInvProj.value.copy(this.cam.projectionMatrixInverse)
    u.uCamWorld.value.copy(this.cam.matrixWorld)
    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer)
    renderer.render(this.scene, this.camera)
  }
}
