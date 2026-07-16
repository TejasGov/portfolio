#!/usr/bin/env node
/**
 * parse-svg-hotspots.cjs
 * Scans BOTH MyTech.svg (light) and MyTechDarkMode.svg (dark).
 *
 * Dark SVG has semantic <g id="GPU">, <g id="Monitor"> etc. → used as source of truth.
 * Light SVG has only numbered masks → matched to dark elements by nearest center point.
 *
 * Outputs: hotspot (light coords) and hotspotDark (dark coords) for each element.
 * Usage:  node scripts/parse-svg-hotspots.cjs
 */

const fs   = require('fs');
const path = require('path');

const DARK_SVG_PATH  = path.join(__dirname, '../public/MyTech/MyTechDarkMode.svg');
const LIGHT_SVG_PATH = path.join(__dirname, '../public/MyTech/MyTech.svg');
const darkSvg  = fs.readFileSync(DARK_SVG_PATH,  'utf8');
const lightSvg = fs.readFileSync(LIGHT_SVG_PATH, 'utf8');

const DW = 1275, DH = 660;   // Dark  SVG dimensions
const LW = 1269, LH = 660;   // Light SVG dimensions

// ────────────────────────────────────────────────────────────────
// 1. DARK SVG — named groups → first child mask bounding box
// ────────────────────────────────────────────────────────────────
const SKIP   = /^(Clip path|Group|Mask group|Vector_\d|[a-f0-9]{8,})/i;
const maskRx = /x="(-?\d+(?:\.\d+)?)" y="(-?\d+(?:\.\d+)?)" width="(-?\d+(?:\.\d+)?)" height="(-?\d+(?:\.\d+)?)"/;
const gRx    = /<g id="([^"]+)"/g;

const darkGroups = [];
let m;
while ((m = gRx.exec(darkSvg)) !== null) {
  if (!SKIP.test(m[1])) darkGroups.push({ id: m[1], offset: m.index });
}

const darkElements = [];
for (let i = 0; i < darkGroups.length; i++) {
  const { id, offset } = darkGroups[i];
  const end   = i + 1 < darkGroups.length ? darkGroups[i + 1].offset : darkSvg.length;
  const block = darkSvg.slice(offset, Math.min(end, offset + 10000));

  // Prefer <mask> bounding box, then fall back to first <rect>
  const maskMatch = maskRx.exec(block);
  const rectMatch = /x="(-?\d+(?:\.\d+)?)" y="(-?\d+(?:\.\d+)?)" width="(\d+(?:\.\d+)?)" height="(\d+(?:\.\d+)?)"/.exec(block);
  const hit = maskMatch || rectMatch;

  if (hit) {
    const [, x, y, w, h] = hit.map(Number);
    if (w > 5 && h > 5) {
      darkElements.push({
        id,
        dark: { x, y, w, h },
        cx: x + w / 2, cy: y + h / 2,
      });
    }
  }
}

// ────────────────────────────────────────────────────────────────
// 2. LIGHT SVG — extract ALL mask bounding boxes (width/height > 5px)
// ────────────────────────────────────────────────────────────────
const maskRxG = /x="(-?\d+(?:\.\d+)?)" y="(-?\d+(?:\.\d+)?)" width="(-?\d+(?:\.\d+)?)" height="(-?\d+(?:\.\d+)?)"/g;
const lightMasks = [];
let lm;
while ((lm = maskRxG.exec(lightSvg)) !== null) {
  const [, x, y, w, h] = lm.map(Number);
  if (w > 5 && h > 5) lightMasks.push({ x, y, w, h, cx: x + w / 2, cy: y + h / 2, used: false });
}

// ────────────────────────────────────────────────────────────────
// 3. MATCH each dark element to nearest unused light mask
//    (distance normalised by each SVG's dimensions)
// ────────────────────────────────────────────────────────────────
function normDist(de, lm) {
  const dx = de.cx / DW - lm.cx / LW;
  const dy = de.cy / DH - lm.cy / LH;
  return Math.sqrt(dx * dx + dy * dy);
}

const results = [];
for (const de of darkElements) {
  let best = null, bestD = Infinity;
  for (const lm of lightMasks) {
    if (lm.used) continue;
    const d = normDist(de, lm);
    if (d < bestD) { bestD = d; best = lm; }
  }

  let light = null;
  if (best && bestD < 0.12) { best.used = true; light = best; }

  results.push({ id: de.id, dark: de.dark, light, matchDist: bestD.toFixed(4) });
}

// ────────────────────────────────────────────────────────────────
// 4. OUTPUT
// ────────────────────────────────────────────────────────────────
const pct = (v, max, dec = 1) => (v / max * 100).toFixed(dec) + '%';
const fmt  = ({ x, y, w, h }, W, H) =>
  `{ x: '${pct(x,W)}', y: '${pct(y,H)}', width: '${pct(w,W)}', height: '${pct(h,H)}' }`;

console.log('\n=== Hotspots (light + dark) ===\n');
for (const r of results) {
  const dStr = fmt(r.dark, DW, DH);
  const lStr = r.light ? fmt(r.light, LW, LH) : 'null /* no match */';
  const warn = r.light ? (parseFloat(r.matchDist) > 0.05 ? ' ⚠️ FUZZY' : '') : ' ❌ UNMATCHED';
  console.log(`// ${r.id}  dist=${r.matchDist}${warn}`);
  console.log(`hotspot:     ${lStr},`);
  console.log(`hotspotDark: ${dStr},\n`);
}

// Write JSON for the auto-generator
fs.writeFileSync(
  path.join(__dirname, 'hotspots-both.json'),
  JSON.stringify(results, null, 2)
);
console.log('✅  Written to scripts/hotspots-both.json');
