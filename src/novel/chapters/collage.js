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
      { kind: 'note', text: '← where the flashback starts', x: 64, y: 29, size: 1.7, r: -3 },
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
      { kind: 'poster', text: 'CRICKET', x: 3, y: 64, size: 16, color: 'var(--ink)', r: -2, depth: -0.4 },
      { kind: 'img', src: 'wc2011-t', x: 4, y: 9, w: 33, r: -3, depth: 0.25, tape: [[12, -3, -10], [84, -2, 8]], cap: 'fig. 5 — 2 April 2011, Pune, the night India won the World Cup.' },
      { kind: 'img', src: 'dhoni2-s', x: 39, y: 6, w: 24, r: 2, depth: 0.7 },
      { kind: 'img', src: 'csk-t', x: 66, y: 12, w: 22, r: 5, depth: 0.4, tape: [[50, -4, 4]], cap: 'fig. 6 — Chepauk in yellow.' },
      { kind: 'img', src: 'gully-cricket-t', x: 68, y: 56, w: 19, r: -5, depth: 0.55, tape: [[20, -3, -12]], cap: 'fig. 7 — every gali is a pitch.' },
      { kind: 'img', src: 'bat-s', x: 90, y: 10, w: 4.5, r: 16, depth: 0.9 },
      { kind: 'img', src: 'ball-s', x: 59, y: 70, w: 7, r: 0, depth: 1, whoosh: true },
      { kind: 'note', text: 'MSD', x: 58, y: 7, size: 3.2, r: -8, circle: true },
      { kind: 'note', text: 'Whistle Podu!', x: 40, y: 84, size: 2.8, r: -4, mark: true },
      { kind: 'stamp', text: 'CHENNAI SUPER KINGS · YELLOVE', x: 66, y: 45, r: -7 },
      { kind: 'note', text: '2011 ★', x: 28, y: 50, size: 3, r: 6 },
    ],
  },
  {
    id: 'cinema',
    label: 'Cinema',
    items: [
      { kind: 'poster', text: 'CINEMA', x: 4, y: 6, size: 14, color: 'var(--stamp)', r: 0, depth: -0.4 },
      { kind: 'img', src: 'pvr-t', x: 4, y: 33, w: 23, r: -4, depth: 0.25, tape: [[14, -3, -10]], cap: 'fig. 8 — PVR. Recliners, popcorn, Friday.' },
      // The billing block. (Salman, Akshay and Priyanka join when their photos can be fetched.)
      { kind: 'cast', x: 32, y: 22, w: 36, r: -1, depth: 0.55, people: [['Shah Rukh', 'srk2-s'], ['Ranbir', 'ranbir-s'], ['Amitabh', 'amitabh2-s']] },
      { kind: 'cast', x: 50, y: 58, w: 25, r: 2, depth: 0.8, people: [['Kareena', 'kareena-s'], ['Deepika', 'deepika-s']] },
      { kind: 'img', src: 'reel-s', x: 84, y: 12, w: 12, r: 0, depth: 0.9, spin: true },
      { kind: 'ticket', tone: 'pvr', kicker: 'PVR · Audi 03', title: 'Friday · first show', meta: 'Recliner · Row J', x: 8, y: 82, r: -6 },
      { kind: 'note', text: 'Friday = new release', x: 34, y: 86, size: 2.4, r: -2, mark: true },
      { kind: 'note', text: 'the whole billing block, please', x: 78, y: 52, size: 1.9, r: 5 },
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
