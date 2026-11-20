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
 * The wave is in world space: a ragged sphere growing from `origin`. Behind its front the world is in
 * full colour, ahead of it the drawing; at the front the colour bleeds into the paper like watercolour
 * and a band of light runs along it (Monolith's desert-to-oasis wave, in our own materials).
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
  float h1 = hatch(px, 0.79, 7.0 * uScale, smoothstep(0.6, 1.0, shade) * 0.8, hw) * smoothstep(0.6, 0.72, shade);
  float h2 = hatch(px, -0.62, 9.0 * uScale, smoothstep(0.8, 1.0, shade) * 0.7, hw * 1.3) * smoothstep(0.8, 0.9, shade);
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
  float d = (far ? farReach : reach) - uR + (noise3(world * 0.09 + vec3(0.0, uTime * 0.02, 0.0)) - 0.5) * uBand * 2.2;
  float behind = 1.0 - smoothstep(-0.25, 0.25, d);
  float colourK = uColorBehind > 0.5 ? behind : 1.0 - behind;
  // Watercolour bleed just on the drawing side of the front: the paper takes the world's hue.
  float ahead = uColorBehind > 0.5 ? max(d, 0.0) : max(-d, 0.0);
  float bleed = exp(-ahead / max(uBand, 0.01)) * (1.0 - colourK);
  vec3 hue = src.rgb / max(max(src.r, max(src.g, src.b)), 1e-3);
  drawing = mix(drawing, drawing * mix(vec3(1.0), hue, 0.75) * 1.05, bleed);
  vec3 col = mix(drawing, src.rgb, colourK);
  // A band of light on the crest.
  float crest = exp(-abs(d) / max(uBand * 0.2, 0.01)) * step(uR, 1e4) * (far ? 0.0 : 1.0);
  col += vec3(1.0, 0.93, 0.8) * crest * mix(0.06, 0.22, uColorBehind); // brighter when colour arrives than when it leaves
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
