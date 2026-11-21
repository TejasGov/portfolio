/*
 * Chapter One's scrapbook, as data. Six spreads, each 100vw wide. Positions are % of the spread;
 * w is width in vw (clamped in CSS for small screens); r is the resting rotation.
 * Every claim here is either Tejas's own ("things I loved as a kid") or a plain public fact.
 *
 * Each spread can stand on a torn sheet of coloured paper (sheet: % of the spread, the edge it is
 * laid from; grid rules it like a drawing sheet), and each poster word has its own entrance (fx):
 * stamp, build, steam, bounce or marquee.
 *
 * On a portrait screen a spread is one screen wide, so each piece (and sheet) carries its own phone
 * placement, pt: { x, y, w?, size?, r? } (sheet: { x, y, w, h } in %), or pt: false to sit that spread out.
 * Phone x allows for parallax: at a spread's centre a piece has drifted depth × 60px left.
 */
const C = '/novel/collage/'

export const SPREADS = [
  {
    id: 'title',
    items: [
      { kind: 'note', text: '25.4358° N, 81.8463° E', x: 63, y: 21, size: 2.1, r: -1.2, pt: { x: 46, y: 8.5 } },
      { kind: 'note', text: '← Where the flashback starts', x: 64, y: 27.5, size: 1.7, r: 1, pt: { x: 34, y: 13 } },
      { kind: 'about', x: 7, y: 44, r: -1, pt: { x: 12.25, y: 44 } },
      { kind: 'note', text: 'Things I loved as a kid in Prayagraj →', x: 58, y: 86, size: 2.2, r: -1.2, pt: { x: 4, y: 90.4 } },
      { kind: 'map', x: 60, y: 36, w: 30, r: -2, depth: 0.35, pt: false },
    ],
  },
  {
    id: 'prayagraj',
    label: 'Prayagraj',
    sheet: { color: '#86b7d6', x: 3, y: 6, w: 56, h: 68, r: -1.5, from: 'left', pt: { x: 3, y: 6, w: 92, h: 52 } }, // the rivers' blue
    items: [
      { kind: 'poster', text: 'HOME', fx: 'stamp', x: 6, y: 12, size: 15, color: 'var(--stamp)', r: -3, depth: -0.3, pt: { x: 6, y: 9 } },
      { kind: 'img', src: 'sangam-t', x: 18, y: 26, w: 40, r: -2.5, depth: 0.25, tape: [[8, -3, -8], [88, -2, 10]], cap: 'fig. 1 — Triveni Sangam, where the Ganga meets the Yamuna.', pt: { x: 10, y: 21, w: 44 } },
      { kind: 'img', src: 'naini-bridge-t', x: 56, y: 12, w: 27, r: 4, depth: 0.5, tape: [[50, -4, 3]], cap: 'fig. 2 — New Yamuna Bridge, dusk.', pt: { x: 22, y: 51.5, w: 32 } },
      { kind: 'img', src: 'mela-night-t', x: 60, y: 56, w: 22, r: -6, depth: 0.8, tape: [[12, -3, -14]], cap: 'fig. 3 — Kumbh Mela at night, 2013.', pt: false },
      { kind: 'stamp', text: 'PRAYAGRAJ · U.P. · 211001', x: 82, y: 82, r: -9, pt: false },
      { kind: 'note', text: 'Home.', x: 33, y: 82, size: 3.4, r: -1.4, circle: true, pt: { x: 72, y: 12 } },
    ],
  },
  {
    id: 'architecture',
    label: 'Architecture',
    sheet: { color: '#e4b98f', x: 30, y: 4, w: 66, h: 66, r: -0.8, from: 'top', grid: true, pt: { x: 5, y: 5, w: 90, h: 50 } }, // sandstone, ruled like a drawing sheet
    items: [
      { kind: 'poster', text: 'ARCHES', fx: 'build', x: 35, y: 7, size: 13, color: 'var(--ink)', r: -1, depth: -0.3, pt: { x: 8, y: 9, size: 15 } },
      { kind: 'img', src: 'khusro-bagh-t', x: 4, y: 16, w: 29, r: -3, depth: 0.3, tape: [[10, -3, -10], [86, -3, 8]], cap: 'fig. 4 — Khusro Bagh: Nithar Begum’s tomb, Mughal, 1624–25.', pt: { x: 10, y: 20, w: 36 } },
      { kind: 'img', src: 'cathedral-t', x: 34, y: 30, w: 28, r: 2.5, depth: 0.5, tape: [[50, -4, 4]], cap: 'fig. 5 — All Saints Cathedral, Gothic revival, consecrated 1887.', pt: { x: 22, y: 49, w: 34 } },
      { kind: 'img', src: 'muir-college-t', x: 65, y: 24, w: 27, r: -2, depth: 0.4, tape: [[14, -3, -10], [84, -3, 9]], cap: 'fig. 6 — Muir Central College, Indo-Saracenic.', pt: false },
      { kind: 'img', src: 'thornhill-t', x: 72, y: 62, w: 18, r: 5, depth: 0.7, tape: [[20, -3, -12]], cap: 'fig. 7 — Thornhill Mayne Memorial, the public library.', pt: false },
      { kind: 'note', text: '← Same architect: William Emerson →', x: 40, y: 72, size: 1.8, r: -1, pt: false },
      { kind: 'stamp', text: 'MUGHAL · GOTHIC · INDO-SARACENIC', x: 6, y: 74, r: -6, pt: false },
      { kind: 'note', text: 'The buildings I loved', x: 42, y: 81, size: 3, r: -1.3, mark: true, pt: { x: 32, y: 74 } },
    ],
  },
  {
    id: 'chai',
    label: 'Chai',
    sheet: { color: '#e3a073', x: 2, y: 8, w: 44, h: 70, r: 1.2, from: 'bottom', pt: { x: 3, y: 5, w: 92, h: 52 } }, // kulhad terracotta
    items: [
      { kind: 'poster', text: 'CHAI', fx: 'steam', x: 4, y: 12, size: 24, color: 'var(--ink)', r: 0, depth: -0.4, outline: true, pt: { x: 8, y: 9 } },
      { kind: 'img', src: 'chaiwala-t', x: 46, y: 14, w: 34, r: 3, depth: 0.3, tape: [[10, -3, -12], [86, -3, 8]], cap: 'fig. 8 — the kettle that never stops.', pt: { x: 13, y: 28, w: 44 } },
      { kind: 'img', src: 'kulhad-s', x: 14, y: 30, w: 25, r: -6, depth: 0.9, steam: true, pt: { x: 33, y: 61 } },
      { kind: 'img', src: 'kulhad-trio-s', x: 79, y: 60, w: 15, r: 9, depth: 0.6, pt: false },
      { kind: 'note', text: 'In a kulhad. Always.', x: 40, y: 80, size: 3, r: -1.2, mark: true, pt: { x: 46, y: 56.5 } },
      { kind: 'tag', text: '₹10', x: 34, y: 28, r: 12, pt: { x: 70, y: 65 } },
    ],
  },
  {
    id: 'cricket',
    label: 'Cricket',
    sheet: { color: '#f3cd45', x: 1, y: 4, w: 50, h: 78, r: -1, from: 'top', pt: { x: 3, y: 6, w: 92, h: 70 } }, // yellow, for the stands
    items: [
      { kind: 'poster', text: 'CRICKET', fx: 'bounce', x: 3, y: 64, size: 16, color: 'var(--ink)', r: -2, depth: -0.4, pt: { x: 5, y: 41, size: 15 } },
      { kind: 'img', src: 'wc2011-t', x: 4, y: 9, w: 33, r: -3, depth: 0.25, tape: [[12, -3, -10], [84, -2, 8]], cap: 'fig. 9 — 2 April 2011, Pune, the night India won the World Cup.', pt: { x: 10, y: 10.5, w: 44 } },
      { kind: 'img', src: 'dhoni2-s', x: 39, y: 6, w: 24, r: 2, depth: 0.7, pt: { x: 51, y: 53, w: 26 } },
      { kind: 'img', src: 'csk-t', x: 66, y: 12, w: 22, r: 5, depth: 0.4, tape: [[50, -4, 4]], cap: 'fig. 10 — Chepauk in yellow.', pt: false },
      { kind: 'img', src: 'gully-cricket-t', x: 68, y: 56, w: 19, r: -5, depth: 0.55, tape: [[20, -3, -12]], cap: 'fig. 11 — every gali is a pitch.', pt: false },
      { kind: 'img', src: 'bat-s', x: 90, y: 10, w: 4.5, r: 16, depth: 0.9, pt: false },
      { kind: 'img', src: 'ball-s', x: 59, y: 70, w: 7, r: 0, depth: 1, whoosh: true, fly: true, pt: false },
      { kind: 'note', text: 'MSD', x: 58, y: 7, size: 3.2, r: -1.4, circle: true, pt: { x: 30, y: 54 } },
      { kind: 'note', text: 'Whistle Podu!', x: 40, y: 84, size: 2.8, r: -1.2, mark: true, pt: { x: 8, y: 68 } },
      { kind: 'stamp', text: 'CHENNAI SUPER KINGS · YELLOVE', x: 66, y: 45, r: -7, pt: false },
      { kind: 'note', text: '2011 ★', x: 28, y: 50, size: 3, r: 1.4, pt: { x: 12, y: 61 } },
    ],
  },
  {
    id: 'cinema',
    label: 'Cinema',
    sheet: { color: '#efa3bb', x: 2, y: 2, w: 64, h: 74, r: 0.8, from: 'right', pt: { x: 3, y: 5, w: 92, h: 52 } }, // poster pink
    items: [
      { kind: 'poster', text: 'CINEMA', fx: 'marquee', x: 4, y: 6, size: 14, color: 'var(--stamp)', r: 0, depth: -0.4, pt: { x: 8, y: 9 } },
      { kind: 'img', src: 'pvr-t', x: 4, y: 33, w: 23, r: -4, depth: 0.25, tape: [[14, -3, -10]], cap: 'fig. 12 — PVR. Recliners, popcorn, Friday.', pt: { x: 10, y: 20.5, w: 36 } },
      // The billing block. (Salman, Akshay and Priyanka join when their photos can be fetched.)
      { kind: 'cast', x: 32, y: 22, w: 36, r: -1, depth: 0.55, people: [['Shah Rukh', 'srk2-s'], ['Ranbir', 'ranbir-s'], ['Amitabh', 'amitabh2-s']], pt: { x: 31, y: 50.5 } },
      { kind: 'cast', x: 50, y: 58, w: 25, r: 2, depth: 0.8, people: [['Kareena', 'kareena-s'], ['Deepika', 'deepika-s']], pt: false },
      { kind: 'img', src: 'reel-s', x: 84, y: 12, w: 12, r: 0, depth: 0.9, spin: true, pt: false },
      { kind: 'ticket', tone: 'pvr', kicker: 'PVR · Audi 03', title: 'Friday · first show', meta: 'Recliner · Row J', x: 8, y: 82, r: -6, pt: { x: 5, y: 68 } },
      { kind: 'note', text: 'Friday = new release', x: 34, y: 86, size: 2.4, r: -1.1, mark: true, pt: { x: 46, y: 77 } },
      { kind: 'note', text: 'The whole billing block, please', x: 76, y: 52, size: 1.9, r: 1.3, pt: { x: 28, y: 46.5 } },
    ],
  },
  {
    id: 'outro',
    label: 'Then',
    items: [
      { kind: 'img', src: 'sunflower-s', x: 8, y: 22, w: 24, r: -5, depth: 0.7, pt: { x: 18, y: 9, w: 24 } },
      { kind: 'card', x: 36, y: 24, r: 1.5, year: '2022', text: 'Co-founded the Sunflower Association in Prayagraj: food, healthcare and clothing drives across the city.', pt: { x: 31, y: 27 } },
      { kind: 'line', text: 'Somewhere in there, I started building things.', x: 36, y: 62, pt: { x: 8, y: 54 } },
    ],
  },
]

export const src = name => `${C}${name}.webp`
