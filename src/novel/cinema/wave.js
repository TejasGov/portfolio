import * as THREE from 'three'
import { Pass } from 'postprocessing'

/*
 * The seam between the cinema and a paper chapter, as one last pass over the 3D frame. It turns the
 * frame into a mask with an organic, growing front, and the page underneath shows through:
 *   burn (paper → cinema): the film catches in the gate. A white-hot edge with a charred fringe eats
 *        a hole through the page, and the cinema is inside it.
 *   wave (cinema → paper): a wave of the projector's light rolls out across the frame. Ahead of it the
 *        picture ripples; behind it the page is left, lit for a moment by the bloom.
 * Driven by scroll (p in 0..1), so both run backwards too. At rest (wave, p = 0) the frame is opaque.
 */
const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }`

const FRAG = /* glsl */ `
#include <common>
uniform sampler2D inputBuffer; uniform highp sampler3D tNoise;
uniform float uP; uniform float uMode; uniform vec2 uOrigin; uniform float uAspect; uniform float uTime;
varying vec2 vUv;
float fbm(vec3 p) { return texture(tNoise, p).r * 0.55 + texture(tNoise, p * 2.03).r * 0.3 + texture(tNoise, p * 4.1).r * 0.15; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 q = (vUv - uOrigin) * vec2(uAspect, 1.0);
  float r = length(q);
  vec2 dir = q / max(r, 1e-4);
  float reach = length(max(abs(uOrigin - vec2(0.0)), abs(uOrigin - vec2(1.0))) * vec2(uAspect, 1.0));
  // Big lobes from noise around the origin, a fine ragged fringe from noise in the plane.
  float lobes = fbm(vec3(dir * 0.55 + 0.5, uTime * 0.02));
  float fringe = fbm(vec3(q * 2.6 + 3.0, uTime * 0.05)) - 0.5;
  float R = uP * reach * 1.45 * (0.7 + 0.6 * lobes) + fringe * 0.07 * sin(3.14159 * uP);
  float d = r - R + 0.003; // < 0 behind the front
  float aa = 1.5 / 900.0;
  vec3 rgb; float a;
  if (uMode < 0.5) {
    // burn: cinema inside the hole, paper outside with a scorched, glowing edge
    float hole = 1.0 - smoothstep(-aa, aa, d);
    float out_ = max(d, 0.0);
    float char_ = (1.0 - smoothstep(0.0, 0.07 + 0.05 * fringe, out_)) * (1.0 - hole);
    float glow = exp(-out_ * 70.0) * (1.0 - hole);
    float core = exp(-abs(d) * 420.0);
    float ember = step(0.992, hash(floor(vUv * vec2(uAspect, 1.0) * 220.0) + floor(uTime * 12.0))) * exp(-out_ * 25.0) * (1.0 - hole);
    vec3 scene = texture2D(inputBuffer, vUv).rgb;
    vec3 heat = vec3(1.0, 0.42, 0.08) * glow * 2.2 + vec3(1.0, 0.9, 0.75) * core * 3.0 + vec3(1.0, 0.6, 0.2) * ember * 3.0;
    vec3 charC = vec3(0.09, 0.045, 0.015);
    float charA = char_ * 0.92;
    rgb = scene * hole + (charC * charA + heat) * (1.0 - hole);
    a = hole + (1.0 - hole) * clamp(charA + dot(heat, vec3(0.3, 0.5, 0.2)), 0.0, 1.0);
  } else {
    // wave: cinema outside the front (rippling just ahead of it), paper behind it, a bloom on the crest
    float keep = smoothstep(-aa, aa, d);
    float ahead = max(d, 0.0);
    vec2 push = dir / vec2(uAspect, 1.0) * 0.035 * exp(-ahead * 9.0) * sin(ahead * 70.0 - uTime * 5.0) * sin(3.14159 * uP);
    vec3 scene = texture2D(inputBuffer, vUv - push).rgb;
    float crest = exp(-abs(d) * 60.0) * 1.6 + exp(-abs(d) * 9.0) * 0.45;
    float behind = (1.0 - keep) * exp(min(d, 0.0) * 6.0); // the page, still washed in light near the crest
    vec3 light = vec3(0.75, 0.86, 1.0) * crest * sin(3.14159 * min(uP * 1.4, 1.0)) + vec3(0.92, 0.95, 1.0) * behind * 0.6 * (1.0 - uP);
    rgb = scene * keep + light;
    a = keep + (1.0 - keep) * clamp(dot(light, vec3(0.3, 0.5, 0.2)), 0.0, 1.0);
  }
  gl_FragColor = vec4(rgb, 1.0);
  #include <colorspace_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * a, a); // premultiplied, for the page underneath
}`

export class WavePass extends Pass {
  constructor(noise) {
    super('WavePass')
    this.fullscreenMaterial = new THREE.ShaderMaterial({
      uniforms: {
        inputBuffer: { value: null }, tNoise: { value: noise }, uP: { value: 0 }, uMode: { value: 1 },
        uOrigin: { value: new THREE.Vector2(0.5, 0.5) }, uAspect: { value: 1 }, uTime: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthWrite: false,
      depthTest: false,
    })
    this.uniforms = this.fullscreenMaterial.uniforms
  }

  setSize(w, h) {
    this.uniforms.uAspect.value = w / Math.max(1, h)
  }

  render(renderer, inputBuffer, outputBuffer) {
    this.uniforms.inputBuffer.value = inputBuffer.texture
    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer)
    renderer.render(this.scene, this.camera)
  }
}
