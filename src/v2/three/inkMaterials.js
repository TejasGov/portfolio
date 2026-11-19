import * as THREE from 'three'

// Simplex 3D noise — Ashima Arts / Ian McEwan, MIT licence (webgl-noise).
const noise = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+10.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 105.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`

export const palette = {
  paper: new THREE.Color('#f4efe8'),
  shade: new THREE.Color('#ddd2c4'),
  deep: new THREE.Color('#b3a594'),
  ink: new THREE.Color('#201e1f'),
}

// Light comes from upper-left-front, like a studio still life.
export const light = new THREE.Vector3(-0.55, 0.85, 0.55).normalize()

/** Paper keeps its hand-picked warm greys; any other base colour derives its own shade/deep bands. */
export function toneBands(base) {
  if (base.equals(palette.paper)) return [palette.paper, palette.shade, palette.deep]
  return [base.clone(), base.clone().multiplyScalar(0.72), base.clone().multiplyScalar(0.45)]
}

// Shared toon logic: three bands from the light, hatching in the deepest band.
const toonGLSL = /* glsl */ `
vec3 toon(vec3 n, vec3 base, vec3 shade, vec3 deep, vec3 ink, vec3 L, vec2 frag) {
  float d = dot(n, L);
  vec3 col = d > 0.55 ? base : d > -0.05 ? shade : deep;
  float hatch = step(0.62, fract((frag.x + frag.y) / 7.0));
  return mix(col, ink, (d > -0.05 ? 0.0 : 0.22) * hatch);
}`

/**
 * Inked toon surface. Optional procedural details, all in object space so they ride with the mesh:
 *  - contours: drifting topographic lines (the orb; the milk swirl in the chai)
 *  - seam: a cricket ball's raised seam with two rows of stitches (seam plane x = 0)
 *  - reel: film-reel face with five punched holes and a hub (face normal ±z)
 */
export function toonMaterial({ base = palette.paper, contours = false, contourScale = 0.9, contourBands = 4, seam = false, reel = false } = {}) {
  const [b, s, d] = toneBands(base)
  return new THREE.ShaderMaterial({
    defines: {
      ...(contours && { CONTOURS: '' }),
      ...(seam && { SEAM: '' }),
      ...(reel && { REEL: '' }),
    },
    uniforms: {
      uTime: { value: 0 },
      uLight: { value: light },
      uBase: { value: b },
      uShade: { value: s },
      uDeep: { value: d },
      uInk: { value: palette.ink },
      uPaper: { value: palette.paper },
      uContourScale: { value: contourScale },
      uContourBands: { value: contourBands },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormalW;
      varying vec3 vNormalO;
      varying vec3 vPosO;
      void main() {
        vPosO = position;
        vNormalO = normal;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uContourScale, uContourBands;
      uniform vec3 uLight, uBase, uShade, uDeep, uInk, uPaper;
      varying vec3 vNormalW;
      varying vec3 vNormalO;
      varying vec3 vPosO;
      ${noise}
      ${toonGLSL}
      float inkLine(float b, float weight) {
        float dist = min(fract(b), 1.0 - fract(b));
        float w = fwidth(b);
        return 1.0 - smoothstep(w * 0.5 * weight, w * 1.5 * weight, dist);
      }
      void main() {
        vec3 n = normalize(vNormalW);
        float d = dot(n, uLight);
        vec3 base = uBase;
        vec3 shade = uShade;
        vec3 deep = uDeep;

        #ifdef REEL
          // Holes and hub are painted in the deep tone, ringed in ink; only on the flat faces.
          if (abs(vNormalO.z) > 0.8) {
            vec2 q = vPosO.xy;
            float r = length(q);
            float hole = 1.0;
            for (int k = 0; k < 5; k++) {
              float a = float(k) * 1.2566 + 0.3;
              hole = min(hole, length(q - 0.4 * vec2(cos(a), sin(a))) - 0.15);
            }
            float hub = r - 0.09;
            float cut = min(hole, hub);
            if (cut < 0.0) { base = uDeep; shade = uDeep * 0.8; deep = uDeep * 0.6; }
            float ring = min(abs(cut), abs(r - 0.66));
            float w = fwidth(r) * 1.2;
            base = mix(base, uInk, 1.0 - smoothstep(w, w * 2.0, ring));
            shade = mix(shade, uInk, 1.0 - smoothstep(w, w * 2.0, ring));
          }
        #endif

        vec3 col = toon(n, base, shade, deep, uInk, uLight, gl_FragCoord.xy);

        #ifdef CONTOURS
          float h = snoise(vPosO * uContourScale + vec3(0.0, uTime * 0.035, 0.0))
                  + 0.3 * snoise(vPosO * uContourScale * 2.1 - vec3(uTime * 0.025));
          // Lines get a touch heavier in shadow, like a pen pressing harder.
          col = mix(col, uInk, inkLine(h * uContourBands, d > -0.05 ? 1.0 : 1.6) * 0.9);
        #endif

        #ifdef SEAM
          float x = abs(vPosO.x);
          float valley = 1.0 - smoothstep(0.012, 0.022, x);
          float angle = atan(vPosO.y, vPosO.z);
          float dash = step(0.45, fract(angle * 9.55)); // ~60 stitches round the ball
          float stitch = (1.0 - smoothstep(0.01, 0.018, abs(x - 0.052))) * dash;
          col = mix(col, uPaper * (d > -0.05 ? 1.0 : 0.75), stitch);
          col = mix(col, uInk, valley * 0.85);
        #endif

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  })
}

/**
 * Inverted-hull silhouette: the mesh pushed out along its normals and drawn back-faces-only in ink.
 * Width wobbles with noise that "boils" at 8 fps, so the outline reads as hand-drawn.
 */
export function inkOutlineMaterial({ width = 0.03 } = {}) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uTime: { value: 0 },
      uWidth: { value: width },
      uInk: { value: palette.ink },
    },
    vertexShader: /* glsl */ `
      uniform float uTime, uWidth;
      ${noise}
      void main() {
        float boil = floor(uTime * 8.0) / 8.0;
        float n = snoise(position * 3.5 + boil * 2.3);
        vec3 p = position + normal * uWidth * (1.0 + 0.55 * n);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uInk;
      void main() {
        gl_FragColor = vec4(uInk, 1.0);
        #include <colorspace_fragment>
      }`,
  })
}

/**
 * The morphing pixel: surface samples of two objects, mixed by uMix, scattered by uScatter,
 * toon-shaded per point and snapped to a screen-space grid so they read as square pixels.
 */
export function pixelMorphMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMix: { value: 0 },
      uScatter: { value: 0 },
      uTime: { value: 0 },
      uCell: { value: 6 },
      uViewport: { value: new THREE.Vector2(1, 1) },
      uLight: { value: light },
      uInk: { value: palette.ink },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aTo;
      attribute vec3 aNormTo;
      attribute vec3 aColFrom;
      attribute vec3 aColTo;
      attribute float aRand;
      uniform float uMix, uScatter, uTime, uCell;
      uniform vec2 uViewport;
      uniform vec3 uLight;
      varying vec3 vColor;
      varying float vBand;
      void main() {
        // Each pixel leaves on its own schedule, so the object crumbles rather than cross-fades.
        float m = smoothstep(aRand * 0.45, 0.55 + aRand * 0.45, uMix);
        vec3 p = mix(position, aTo, m);
        vec3 dir = normalize(vec3(sin(aRand * 91.7), cos(aRand * 37.3) * 0.6 + 0.4, sin(aRand * 53.1 + 1.3)));
        p += dir * uScatter * (0.25 + 0.75 * aRand) * 0.8;
        p.y += sin(uTime * 1.3 + aRand * 20.0) * 0.04 * uScatter;

        vec3 n = normalize(mat3(modelMatrix) * normalize(mix(normal, aNormTo, m)));
        float d = dot(n, uLight);
        vBand = d > 0.55 ? 1.0 : d > -0.05 ? 0.78 : 0.55;
        vColor = mix(aColFrom, aColTo, m);

        vec4 clip = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        // Grid-lock: snap the point's centre to the nearest cell on screen.
        vec2 px = (clip.xy / clip.w * 0.5 + 0.5) * uViewport;
        px = (floor(px / uCell) + 0.5) * uCell;
        clip.xy = (px / uViewport * 2.0 - 1.0) * clip.w;
        gl_Position = clip;
        gl_PointSize = uCell;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uInk;
      varying vec3 vColor;
      varying float vBand;
      void main() {
        // A hairline ink gap between cells keeps the grid legible, like the pixel field at the top.
        vec2 c = abs(gl_PointCoord - 0.5);
        if (max(c.x, c.y) > 0.42) discard;
        gl_FragColor = vec4(vColor * vBand, 1.0);
        #include <colorspace_fragment>
      }`,
  })
}
