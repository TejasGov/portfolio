/*
 * Chapter One's scrapbook, as data. Six spreads, each 100vw wide. Positions are % of the spread;
 * w is width in vw (clamped in CSS for small screens); r is the resting rotation.
 * Every claim here is either Tejas's own ("things I loved as a kid") or a plain public fact.
 */
const C = '/novel/collage/'

export const SPREADS = [
  {
    id: 'title',
    items: [
      { kind: 'note', text: '25.4358° N, 81.8463° E', x: 63, y: 22, size: 2.1, r: -4 },
      { kind: 'note', text: '← that dot on the orb', x: 64, y: 29, size: 1.7, r: -3 },
      { kind: 'note', text: 'things I loved as a kid in Prayagraj', x: 8, y: 78, size: 2.4, r: -2 },
      { kind: 'map', x: 60, y: 36, w: 30, r: -2, depth: 0.35 },
    ],
  },
  {
    id: 'prayagraj',
    label: 'Prayagraj',
    items: [
      { kind: 'poster', text: 'HOME', x: 6, y: 12, size: 15, color: 'var(--stamp)', r: -3, depth: -0.3 },
      { kind: 'img', src: 'sangam-t', x: 18, y: 26, w: 40, r: -2.5, depth: 0.25, tape: [[8, -3, -8], [88, -2, 10]], cap: 'fig. 1 — Triveni Sangam, where the Ganga meets the Yamuna.' },
      { kind: 'img', src: 'naini-bridge-t', x: 56, y: 12, w: 27, r: 4, depth: 0.5, tape: [[50, -4, 3]], cap: 'fig. 2 — New Yamuna Bridge, dusk.' },
      { kind: 'img', src: 'mela-night-t', x: 60, y: 56, w: 22, r: -6, depth: 0.8, tape: [[12, -3, -14]], cap: 'fig. 3 — Kumbh Mela at night, 2013.' },
      { kind: 'stamp', text: 'PRAYAGRAJ · U.P. · 211001', x: 82, y: 82, r: -9 },
      { kind: 'note', text: 'home.', x: 33, y: 82, size: 3.4, r: -5, circle: true },
    ],
  },
  {
    id: 'chai',
    label: 'Chai',
    items: [
      { kind: 'poster', text: 'CHAI', x: 4, y: 12, size: 24, color: 'var(--ink)', r: 0, depth: -0.4, outline: true },
      { kind: 'img', src: 'chaiwala-t', x: 46, y: 14, w: 34, r: 3, depth: 0.3, tape: [[10, -3, -12], [86, -3, 8]], cap: 'fig. 4 — the kettle that never stops.' },
      { kind: 'img', src: 'kulhad-s', x: 14, y: 30, w: 25, r: -6, depth: 0.9, steam: true },
      { kind: 'img', src: 'kulhad-trio-s', x: 79, y: 60, w: 15, r: 9, depth: 0.6 },
      { kind: 'note', text: 'in a kulhad. always.', x: 40, y: 80, size: 3, r: -3, mark: true },
      { kind: 'tag', text: '₹10', x: 34, y: 28, r: 12 },
    ],
  },
  {
    id: 'cricket',
    label: 'Cricket',
    items: [
      { kind: 'poster', text: 'CRICKET', x: 3, y: 62, size: 17, color: 'var(--ink)', r: -2, depth: -0.4 },
      { kind: 'img', src: 'gully-cricket-t', x: 6, y: 8, w: 36, r: -3, depth: 0.25, tape: [[50, -3, -2]], cap: 'fig. 5 — every gali is a pitch.' },
      { kind: 'img', src: 'dhoni-s', x: 46, y: 10, w: 30, r: 2, depth: 0.7 },
      { kind: 'img', src: 'bat-s', x: 80, y: 14, w: 5.5, r: 18, depth: 0.9 },
      { kind: 'img', src: 'ball-s', x: 84, y: 66, w: 9, r: 0, depth: 1, whoosh: true },
      { kind: 'note', text: 'MSD', x: 52, y: 11, size: 3.2, r: -8, circle: true },
      { kind: 'note', text: 'Captain Cool.', x: 56, y: 80, size: 2.6, r: -3 },
      { kind: 'note', text: '2011 ★ World Cup!', x: 74, y: 48, size: 2.2, r: 6 },
    ],
  },
  {
    id: 'cinema',
    label: 'Cinema',
    items: [
      { kind: 'poster', text: 'CINEMA', x: 30, y: 12, size: 17, color: 'var(--stamp)', r: 0, depth: -0.4 },
      { kind: 'img', src: 'elgin-talkies-t', x: 4, y: 30, w: 30, r: -4, depth: 0.25, tape: [[14, -3, -10]], cap: 'fig. 6 — single screens, balcony seats.' },
      { kind: 'img', src: 'amitabh-t', x: 62, y: 46, w: 28, r: 5, depth: 0.3, duotone: true, tape: [[80, -3, 12]], cap: 'fig. 7 — the baritone.' },
      { kind: 'img', src: 'srk-s', x: 33, y: 26, w: 15, r: -3, depth: 0.8 },
      { kind: 'img', src: 'deepika-s', x: 48, y: 22, w: 17, r: 4, depth: 0.7 },
      { kind: 'img', src: 'reel-s', x: 80, y: 14, w: 14, r: 0, depth: 0.9, spin: true },
      { kind: 'ticket', x: 8, y: 80, r: -6 },
      { kind: 'note', text: 'Friday = new release', x: 38, y: 84, size: 2.4, r: -2, mark: true },
    ],
  },
  {
    id: 'outro',
    label: 'Then',
    items: [
      { kind: 'img', src: 'sunflower-s', x: 8, y: 22, w: 24, r: -5, depth: 0.7 },
      { kind: 'card', x: 36, y: 24, r: 1.5, year: '2022', text: 'Co-founded the Sunflower Association in Prayagraj: food, healthcare and clothing drives across the city.' },
      { kind: 'line', text: 'Somewhere in there, I started building things.', x: 36, y: 62 },
    ],
  },
]

export const src = name => `${C}${name}.webp`
