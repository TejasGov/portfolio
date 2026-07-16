const fs = require('fs');
const svg = fs.readFileSync('public/MyTech/MyTech.svg', 'utf8');
const maskRxG = /x="(-?\d+(?:\.\d+)?)" y="(-?\d+(?:\.\d+)?)" width="(-?\d+(?:\.\d+)?)" height="(-?\d+(?:\.\d+)?)"/g;
let m;
while ((m = maskRxG.exec(svg)) !== null) {
  const [_, x, y, w, h] = m.map(Number);
  if (w > 30 && h > 30) {
    console.log(`w:${w.toFixed(0)} h:${h.toFixed(0)} -> x:${(x/1269*100).toFixed(1)}% y:${(y/660*100).toFixed(1)}%`);
  }
}
