import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

/* ============================================================
   THE LIBRARY — v4 · real collection, categorized shelves
   ============================================================ */

const CANVAS_W = 1340;
const CANVAS_H = 1720;
const ROW_H = 256;
const TOP_PAD = 120;
const SEED = 20260711;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SPINE_PALETTE = [
  "#8C3B2E","#A65E2E","#6B7F59","#41586B","#8A6D3B",
  "#5C4A72","#3F5B54","#9C7A4D","#704241","#31485A",
  "#7A5230","#4E5D45","#6E4460","#3D6B6B","#886644",
];

const gr = (t, a) =>
  `https://www.goodreads.com/search?q=${encodeURIComponent(t + " " + a)}`;
const mk = (title, author, blurb, isbn) => ({
  id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  title, author, blurb,
  coverUrl: isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : null,
  goodreadsUrl: gr(title, author),
});

/* ── THE REAL SHELF ── books ordered by row so the queue lines up exactly */
const BOOKS = [
  // ── Row 0: GAME THEORY (3) + STARTUP (2) = 5 books ──
  mk("The Art of Strategy","Dixit & Nalebuff","Thinking strategically in business, politics, and daily life. Game theory made practical — every chapter is a new way to see decisions.","9780393337174"),
  mk("Games of Strategy","Dixit, Skeath & Reiley","The textbook that makes game theory click. Rigorous enough for a course, readable enough for a train ride.","9780393919684"),
  mk("Game Theory","Steven Tadelis","The graduate-level treatment — clean, precise, and builds intuition from axioms up. Not light reading, but it sticks.","9780691129082"),
  mk("The Lean Startup","Eric Ries","Build, measure, learn — on a loop. The book that made 'pivot' a verb and gave startups permission to ship before it's perfect.","9780307887894"),
  mk("Zero to One","Peter Thiel","Notes on building things that don't exist yet. Contrarian, compact, and worth arguing with.","9780804139298"),

  // ── Row 1: LIFE HACKS (5) = 5 books ──
  mk("Tiny Habits","BJ Fogg","Forget motivation — design for behaviour. Start laughably small, anchor to something you already do, and let the system compound.","9780358003328"),
  mk("The Courage to Be Disliked","Kishimi & Koga","Adlerian psychology as a Socratic dialogue. The thesis: you choose your suffering, and you can stop. Infuriating and liberating in equal measure.","9781501197277"),
  mk("The Happiness Trap","Russ Harris","Stop chasing happiness and it shows up anyway. ACT therapy distilled into something you can actually use on a bad Tuesday.","9781590305843"),
  mk("The 48 Laws of Power","Robert Greene","Three thousand years of power moves, distilled into 48 laws with historical examples. Machiavelli as a coffee-table book.","9780140280197"),
  mk("33 Strategies of War","Robert Greene","Grand strategy, tactical warfare, and dirty tricks — applied to boardrooms, relationships, and everyday conflict. Dense and obsessive.","9780143112785"),

  // ── Row 2: HINDU MYTHOLOGY (3) + Gita inserted separately = 4 books ──
  mk("Ramayana","R. K. Narayan","The great epic retold with a novelist's touch — lean, vivid, and deeply human. Narayan strips away the ornamentation and finds the story.","9780143039679"),
  mk("Mahabharata","C. Rajagopalachari","The longest poem ever written, compressed into a single readable volume. Every family, every betrayal, every lesson — still here.","9788172764050"),
  mk("Ramcharitmanas","Tulsidas","Rama's story in Awadhi verse — devotion as literature. The version that lives in the hearts of North India.","9788129306197"),

  // ── Row 3: AI (5) + STATISTICS (1) = 6 books ──
  mk("Co-Intelligence","Ethan Mollick","The first practical book on actually working alongside AI. Not hype, not fear — just: here's what changes, here's how to use it.","9780593716717"),
  mk("The Coming Wave","Suleyman & Bhaskar","AI and synthetic biology are coming whether we're ready or not. A containment problem framed with genuine urgency.","9780593593950"),
  mk("The Drunkard's Walk","Leonard Mlodinow","Randomness runs your life more than you think. A tour through probability that makes you distrust every pattern you've ever seen.","9780307275172"),
  mk("Material World","Ed Conway","Six materials that built the modern world — sand, salt, iron, copper, oil, lithium. The physical layer under the digital one.","9780593534069"),
  mk("You Look Like a Thing","Janelle Shane","AI is dumber and funnier than you think. The gap between what neural nets do and what we imagine they do is comedy gold.","9780316525244"),
  mk("Signal and the Noise","Nate Silver","Why most predictions fail and some don't. Bayesian thinking applied to elections, earthquakes, and poker — by someone who does all three.","9780143125082"),

  // ── Row 4: WW2 (4) + POLITICS (3) = 7 books ──
  mk("The Second World War","Antony Beevor","The definitive single-volume history. Beevor moves between Eastern Front and Pacific with terrifying clarity — the scale never numbs.","9780316023740"),
  mk("Rise and Fall of the Third Reich","William Shirer","Shirer was there. A correspondent's history of Nazi Germany from the inside — exhaustive, first-person, and still unmatched.","9781451642599"),
  mk("Bloodlands","Timothy Snyder","The killing fields between Hitler and Stalin. Fourteen million dead in the lands caught between two regimes. Unforgettable and necessary.","9780465031474"),
  mk("Inside the Third Reich","Albert Speer","Hitler's architect tells his version. Self-serving, fascinating, and chilling — you watch a smart man explain how he chose not to see.","9780684829494"),
  mk("Great Power Politics","John Mearsheimer","States want power, and the structure of the system guarantees conflict. Offensive realism stated plainly, with uncomfortable implications.","9780393349276"),
  mk("Diplomacy","Henry Kissinger","Four centuries of statecraft through the eyes of its most controversial practitioner. Agree or not, the strategic thinking is razor-sharp.","9780671510992"),
  mk("The India Way","S. Jaishankar","India's foreign policy from the man running it. Strategic autonomy, multi-alignment, and why Delhi won't pick a side.","9789353573553"),

  // ── Row 5: RANDOM (8) = 8 books ──
  mk("Reinventing You","Dorie Clark","How to rebrand yourself without faking it. Practical, specific, and written for people mid-career who feel stuck.","9781422144138"),
  mk("Short History of Everything","Bill Bryson","From the Big Bang to civilization, told by the funniest man in popular science. You'll learn something on every page and laugh on most.","9780767908184"),
  mk("Bollywood: A History","Mihir Bose","A hundred years of Hindi cinema — the business, the spectacle, the nation it mirrors. More industry history than film criticism.","9780752220345"),
  mk("The Heights","Kate Ascher","How skyscrapers actually work — foundations, elevators, plumbing, wind. Engineering as visual storytelling. Gorgeous and nerdy.","9781594203039"),
  mk("Project Hail Mary","Andy Weir","A lone astronaut wakes up with no memory and one impossible job: save Earth. Science as a buddy comedy — the last hundred pages are pure joy.","9780593135204"),
  mk("Discovery of India","Jawaharlal Nehru","Written in prison, a sweeping meditation on what India is and has been. Part history, part love letter, entirely personal.","9780143031031"),
  mk("Macbeth","Shakespeare","Ambition, guilt, and a Scottish castle full of blood. The shortest tragedy, the sharpest — 'tomorrow and tomorrow and tomorrow' still echoes.","9780743477109"),
  mk("Julius Caesar","Shakespeare","Et tu, Brute? The assassination and its aftermath — rhetoric as weapon, loyalty as trap. Every political speech since borrows from this.","9780743482745"),
];

const GITA = {
  ...mk("Bhagavad Gita","tr. Eknath Easwaran","A conversation on a battlefield that became a philosophy of living — duty, detachment, and doing the work without clinging to the result. The oldest book on this shelf, and the one I reread the most.","9781586380199"),
  special: "gita",
};

/* ── row plans: slot counts MUST match category sizes above ──
   Row 0: 5b  |  Row 1: 5b  |  Row 2: 3b+gita  |  Row 3: 6b  |  Row 4: 7b  |  Row 5: 8b */
const ROW_PLANS = [
  ["d:bookendL","b","b","b","d:globe","b","b","f:box"],
  ["b","d:pothos","b","e:nymug","b","d:candle","b","b"],
  ["b","e:ganesha","gita","b","d:bookendL","b","e:diya","f:box"],
  ["b","b","e:pc","b","b","d:bookendL","b","b"],
  ["b","b","b","e:empire","b","b","d:bookendL","b","b"],
  ["f:stack","b","b","e:mjolnir","b","b","d:monstera","b","b","e:rickshaw","b","b"],
];

const SHELF_LABELS = [
  ["GAME THEORY","STRATEGY","STARTUP"],
  ["LIFE HACKS","SELF","POWER"],
  ["DHARMA","EPICS","SCRIPTURE"],
  ["AI","DATA","STATISTICS"],
  ["WW2","POLITICS","HISTORY"],
  ["RANDOM","STORIES","CURIOSITY"],
];

function buildRows() {
  const rng = mulberry32(SEED);
  const queue = [...BOOKS];
  return ROW_PLANS.map((plan, rowIdx) => {
    const groups = [];
    let cluster = null;
    const pushCluster = () => { if (cluster && cluster.books.length) groups.push(cluster); cluster = null; };
    plan.forEach((tok) => {
      if (tok === "b" || tok === "gita") {
        const book = tok === "gita" ? GITA : queue.shift();
        if (!book) return;
        if (!cluster) cluster = { type: "cluster", books: [] };
        cluster.books.push({
          ...book,
          w: 32 + Math.round(rng() * 18),
          h: 155 + Math.round(rng() * 60),
          spineColor: book.special === "gita" ? "#B8802F" : SPINE_PALETTE[Math.floor(rng() * SPINE_PALETTE.length)],
          band: rng() > 0.45,
          orn: rng() > 0.55,
          lean: 0,
        });
      } else {
        pushCluster();
        const [kind, name] = tok.split(":");
        groups.push({ type: kind === "e" ? "egg" : kind === "d" ? "decor" : "filler", name });
      }
    });
    pushCluster();
    groups.forEach((g) => {
      if (g.type === "cluster" && g.books.length >= 3 && rng() > 0.4) {
        g.books[g.books.length - 1].lean = -(3 + rng() * 5);
      }
    });
    return { row: rowIdx, groups };
  });
}

/* ============================ decor & eggs ============================ */

const Tooltip = ({ label }) => <span className="lib-tip">{label}</span>;
function Egg({ label, children, width, style }) {
  return (
    <div className="lib-egg" style={{ width, ...style }} aria-hidden="true">
      <Tooltip label={label} />
      {children}
    </div>
  );
}

const BookendL = () => (
  <div className="lib-decor" style={{ width: 18 }} aria-hidden="true">
    <svg viewBox="0 0 18 100" width="18" height="100">
      <rect x="0" y="0" width="6" height="100" rx="1" fill="#8a6d3b" />
      <rect x="0" y="88" width="18" height="12" rx="1" fill="#8a6d3b" />
      <rect x="0" y="0" width="6" height="100" fill="url(#be)" opacity="0.5" />
      <defs><linearGradient id="be" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#b8942f"/><stop offset="1" stopColor="#6b4e22"/>
      </linearGradient></defs>
    </svg>
  </div>
);

const Candle = () => (
  <div className="lib-decor" style={{ width: 38 }} aria-hidden="true">
    <svg viewBox="0 0 38 64" width="38" height="64">
      <path className="lib-flicker2" d="M19 6 q4 6 0 12 q-4 -6 0 -12 z" fill="#f4b555" opacity="0.9" />
      <path d="M19 10 q2 3 0 7 q-2 -3 0 -7 z" fill="#fde3ae" />
      <line x1="19" y1="16" x2="19" y2="22" stroke="#3d2a10" strokeWidth="1.2" />
      <rect x="5" y="20" width="28" height="44" rx="4" fill="#e9e1d2" />
      <rect x="5" y="20" width="28" height="8" rx="4" fill="#d8cfc0" />
      <ellipse cx="19" cy="60" rx="16" ry="3" fill="#0a0804" opacity="0.25" />
    </svg>
  </div>
);

const Rickshaw = () => (
  <Egg label="Horn OK Please" width={72}>
    <svg viewBox="0 0 72 56" width="72" height="56">
      <path d="M12 18 h42 q8 0 8 8 v18 h-56 v-18 q0 -8 6 -8 z" fill="#2a8c4a" />
      <path d="M16 18 q4 -14 22 -14 q14 0 18 14 z" fill="#f4d54a" />
      <rect x="16" y="18" width="26" height="16" rx="2" fill="#8ec8d8" opacity="0.85" />
      <circle cx="16" cy="48" r="8" fill="#2a2420" /><circle cx="16" cy="48" r="4" fill="#5a5348" />
      <circle cx="54" cy="48" r="8" fill="#2a2420" /><circle cx="54" cy="48" r="4" fill="#5a5348" />
      <line x1="8" y1="24" x2="4" y2="16" stroke="#5a5348" strokeWidth="3" strokeLinecap="round" />
    </svg>
  </Egg>
);

const Mjolnir = () => (
  <Egg label="Whosoever holds this hammer…" width={90} style={{ position:"relative" }}>
    <div style={{ position:"absolute", bottom:0, left:0, width:48, display:"flex", flexDirection:"column", alignItems:"center" }}>
      {[["#5C4A72",46,15],["#704241",42,13]].map(([c,w,h],i)=>(
        <div key={i} style={{ width:w, height:h, background:`linear-gradient(#ffffff12,#00000028),${c}`,
          borderRadius:2, marginTop:i?1:0, boxShadow:"0 2px 3px rgba(0,0,0,.35)" }} />
      ))}
    </div>
    <svg viewBox="0 0 74 100" width="74" height="100"
      style={{ position:"absolute", bottom:1, left:4, transform:"rotate(-25deg)", transformOrigin:"72% 96%" }}>
      <rect x="33" y="24" width="7" height="72" rx="3" fill="#6b4a2f" />
      <rect x="33" y="64" width="7" height="8" fill="#8a6a45" />
      <path d="M30 92 q8 6 12 0" stroke="#8a6a45" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M8 4 h56 q4 0 4 4 v22 q0 4-4 4 h-56 q-4 0-4-4 v-22 q0-4 4-4 z" fill="url(#mj)" />
      <rect x="4" y="8" width="64" height="3.5" fill="#9aa3ad" opacity="0.45" />
      <rect x="4" y="26" width="64" height="3.5" fill="#565e66" opacity="0.45" />
      <defs><linearGradient id="mj" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#8a919a"/><stop offset=".5" stopColor="#636b74"/><stop offset="1" stopColor="#4a525a"/>
      </linearGradient></defs>
    </svg>
  </Egg>
);

const PCTower = () => (
  <Egg label="The rig · RGB adds 15 FPS" width={46}>
    <svg viewBox="0 0 46 150" width="46" height="150">
      <rect x="1" y="0" width="44" height="146" rx="3" fill="#1e2228" />
      <rect x="4" y="3" width="24" height="140" rx="2" fill="#141820" />
      <rect x="7" y="6" width="18" height="134" rx="1.5" fill="#0c0f14" />
      <rect x="31" y="3" width="11" height="140" rx="2" fill="#12151a" />
      <circle cx="37" cy="12" r="2.5" fill="#2a3038" />
      <circle cx="37" cy="12" r="1.2" fill="#e8a85c" className="lib-rgb" />
      <rect className="lib-rgb" x="8" y="10" width="2.5" height="124" rx="1.2" fill="#e8a85c" opacity="0.85" />
      <circle className="lib-rgb2" cx="17" cy="60" r="10" fill="none" stroke="#e8a85c" strokeWidth="1.5" opacity="0.55" />
      <circle cx="17" cy="60" r="5" fill="#1a1e24" />
      <rect x="4" y="146" width="7" height="4" rx="2" fill="#0a0c0f" />
      <rect x="35" y="146" width="7" height="4" rx="2" fill="#0a0c0f" />
    </svg>
  </Egg>
);

const NYMug = () => (
  <Egg label="Souvenir from the city that never sleeps" width={52}>
    <svg viewBox="0 0 52 68" width="52" height="68">
      <path d="M40 26 q10 3 10 14 q0 11-10 14" fill="none" stroke="#d4cabb" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M6 14 h34 l-2 54 h-30 z" fill="#e9e1d2" />
      <ellipse cx="23" cy="14" rx="17" ry="3.5" fill="#f2ece0" />
      <text x="23" y="42" textAnchor="middle" fontSize="10" fontWeight="800" fill="#3a3a3a" fontFamily="Inter,sans-serif">I</text>
      <text x="31" y="42" textAnchor="middle" fontSize="10" fontWeight="800" fill="#c0342e" fontFamily="Inter,sans-serif">♥</text>
      <text x="23" y="56" textAnchor="middle" fontSize="12" fontWeight="800" fill="#3a3a3a" fontFamily="Inter,sans-serif">NY</text>
      <line x1="18" y1="14" x2="13" y2="-6" stroke="#8a6d3b" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="26" y1="14" x2="30" y2="-10" stroke="#41586b" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="30" cy="-10" r="2" fill="#41586b" />
    </svg>
  </Egg>
);

const EmpireState = () => (
  <Egg label="Empire State of mind" width={42}>
    <svg viewBox="0 0 42 168" width="42" height="168">
      <rect x="4" y="130" width="34" height="38" fill="#5a5348" />
      <rect x="7" y="102" width="28" height="32" fill="#665e51" />
      <rect x="11" y="60" width="20" height="46" fill="#736a5b" />
      <rect x="15" y="32" width="12" height="30" fill="#7d7363" />
      <rect x="19" y="10" width="4" height="24" fill="#8a8070" />
      <rect x="20" y="0" width="2" height="12" fill="#95897a" />
      <circle cx="21" cy="0" r="1.5" fill="#e8a85c" className="lib-blink" />
      {[0,1,2,3].map(i=>(
        <React.Fragment key={i}>
          <rect x={9+i*7} y="138" width="2.5" height="10" fill="#e8a85c" opacity="0.28" />
          <rect x={12+i*5} y="110" width="2" height="7" fill="#e8a85c" opacity="0.22" />
        </React.Fragment>
      ))}
    </svg>
  </Egg>
);

const Diya = () => (
  <Egg label="Diya — a little light for the shelf" width={58}>
    <svg viewBox="0 0 58 52" width="58" height="52">
      <ellipse cx="29" cy="50" rx="24" ry="5" fill="#e8a85c" opacity="0.07" />
      <path className="lib-flicker" d="M29 6 q7 8 0 16 q-7-8 0-16 z" fill="#f4b555" />
      <path d="M29 12 q3.5 4 0 9 q-3.5-4 0-9 z" fill="#fde3ae" />
      <line x1="29" y1="20" x2="29" y2="26" stroke="#3d2a10" strokeWidth="1.2" />
      <path d="M6 30 q23-10 46 0 q-4 18-23 22 q-19-4-23-22 z" fill="url(#brass)" />
      <ellipse cx="29" cy="30" rx="23" ry="5" fill="#a87830" opacity="0.45" />
      <path d="M48 32 q7-2 9 2 q-2 4-7 3" fill="#b88a3a" />
      <defs><linearGradient id="brass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#d1a24a"/><stop offset="1" stopColor="#8a6224"/>
      </linearGradient></defs>
    </svg>
  </Egg>
);

const Ganesha = () => (
  <Egg label="Ganesha — remover of obstacles" width={56}>
    <svg viewBox="0 0 56 120" width="56" height="120">
      <ellipse cx="28" cy="118" rx="22" ry="3.5" fill="#1a130d" opacity="0.45" />
      <rect x="8" y="106" width="40" height="14" rx="3" fill="url(#brass2)" />
      <rect x="8" y="106" width="40" height="3.5" rx="2" fill="#d9b35a" opacity="0.55" />
      <circle cx="28" cy="46" r="24" fill="none" stroke="#c9973f" strokeWidth="1" opacity="0.25" />
      <path d="M13 106 q-4-24 7-34 q-6-8-6-18 q0-18 14-18 t14 18 q0 10-6 18 q11 10 7 34 z" fill="url(#brass2)" />
      <path d="M28 62 q-3 10-7 14 q6 4 7 11 q1-7 7-11 q-4-4-7-14 z" fill="#8a6224" opacity="0.5" />
      <path d="M25 58 q-1 12-6 18 q2 5 8 5" fill="none" stroke="#6f4e1c" strokeWidth="3" strokeLinecap="round" />
      <circle cx="22" cy="48" r="1.7" fill="#3d2a10" /><circle cx="34" cy="48" r="1.7" fill="#3d2a10" />
      <path d="M16 46 q-8 2-8 11 q0 7 6 8" fill="none" stroke="#b8802f" strokeWidth="3.5" strokeLinecap="round" opacity="0.85" />
      <path d="M40 46 q8 2 8 11 q0 7-6 8" fill="none" stroke="#b8802f" strokeWidth="3.5" strokeLinecap="round" opacity="0.85" />
      <path d="M19 36 l3-8 l3 5 l3-7 l3 5 l3-8 l3 8 q-5 3-18 5 z" fill="#d1a24a" opacity="0.75" />
      <defs><linearGradient id="brass2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#d1a24a"/><stop offset="1" stopColor="#8a6224"/>
      </linearGradient></defs>
    </svg>
  </Egg>
);

const Monstera = () => (
  <div className="lib-decor lib-sway-soft" style={{ width:140, position:"relative" }} aria-hidden="true">
    <svg viewBox="0 0 140 200" width="140" height="200" style={{ overflow:"visible" }}>
      <path d="M70 132 q-6-44-36-62" fill="none" stroke="#3f5b3c" strokeWidth="3" />
      <path d="M70 132 q8-50 42-66" fill="none" stroke="#3f5b3c" strokeWidth="3" />
      <path d="M70 132 q-1-38 3-74" fill="none" stroke="#3f5b3c" strokeWidth="3" />
      <path d="M70 132 q-14-30-50-38" fill="none" stroke="#3a5636" strokeWidth="2.2" />
      <path d="M70 132 q16-34 52-44" fill="none" stroke="#3a5636" strokeWidth="2.2" />
      <path d="M34 70 q-32-12-26-44 q32-4 36 28 q1 10-10 16 z" fill="#4e7048" stroke="#3a5636" strokeWidth="1.5" />
      <path d="M18 40 l10 20 M12 50 l14 12" stroke="#3a5636" strokeWidth="1.2" opacity="0.45" />
      <path d="M112 62 q34-14 28-48 q-34-2-38 30 q-1 12 10 18 z" fill="#557a4e" stroke="#3a5636" strokeWidth="1.5" />
      <path d="M126 30 l-12 22 M132 42 l-14 12" stroke="#3a5636" strokeWidth="1.2" opacity="0.45" />
      <path d="M73 58 q-16-28 5-48 q24 16 6 46 q-4 6-11 2 z" fill="#476a42" stroke="#3a5636" strokeWidth="1.5" />
      <path d="M20 94 q-18-6-18-24 q20-3 24 16 q1 6-6 8 z" fill="#5a8052" stroke="#3a5636" strokeWidth="1.2" />
      <path d="M122 88 q18-6 16-26 q-20-2-22 18 q0 6 6 8 z" fill="#4e7048" stroke="#3a5636" strokeWidth="1.2" />
      <rect x="42" y="126" width="56" height="10" rx="3" fill="#b86830" />
      <path d="M45 136 h50 l-6 64 h-38 z" fill="url(#pot)" />
      <defs><linearGradient id="pot" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#a45e28"/><stop offset="1" stopColor="#7a3f1c"/>
      </linearGradient></defs>
    </svg>
  </div>
);

const Pothos = () => (
  <div className="lib-decor" style={{ width:72, position:"relative" }} aria-hidden="true">
    <svg viewBox="0 0 72 90" width="72" height="90" style={{ overflow:"visible" }}>
      <path d="M32 18 q8-14 16 0 q-8 10-16 0 z" fill="#4e7048" />
      <path d="M40 18 q-5-12-12-2 q4 7 12 2 z" fill="#5a8252" />
      <line x1="38" y1="34" x2="38" y2="20" stroke="#3f5b3c" strokeWidth="2.2" />
      <rect x="22" y="32" width="32" height="7" rx="2" fill="#cbc2b1" />
      <path d="M25 39 h26 l-4 51 h-18 z" fill="#b7ad9c" />
      <path d="M28 39 q-16 18-18 60 q-1 16 4 44" fill="none" stroke="#4e7048" strokeWidth="2.2" />
      <path d="M46 39 q14 22 12 68 q-1 18 5 42" fill="none" stroke="#4e7048" strokeWidth="2.2" />
      <path d="M37 39 q-5 26-1 52 q3 20-3 40" fill="none" stroke="#3f5b3c" strokeWidth="1.8" />
      {[[10,80,-18],[56,86,16],[30,90,-28],[14,118,-8],[60,124,20],[34,126,-22],[18,148,-12],[54,156,18]].map(([x,y,r],i)=>(
        <path key={i} d={`M${x} ${y} q6-3 8 4 q-6 5-8-4 z`} fill={i%2?"#557a4e":"#4e7048"}
          transform={`rotate(${r} ${x} ${y})`} />
      ))}
    </svg>
  </div>
);

const Globe = () => (
  <div className="lib-decor" style={{ width:64 }} aria-hidden="true">
    <svg viewBox="0 0 64 110" width="64" height="110">
      <path d="M18 106 h28 l-3-5 h-22 z" fill="#5c4232" />
      <rect x="29" y="80" width="6" height="22" fill="#5c4232" />
      <ellipse cx="32" cy="44" rx="28" ry="30" fill="none" stroke="#8a6d3b" strokeWidth="2.5" transform="rotate(16 32 44)" />
      <circle cx="32" cy="44" r="24" fill="#31485a" />
      <path d="M32 20 a24 24 0 0 1 0 48 a12 24 0 0 1 0-48" fill="none" stroke="#5b7488" strokeWidth="1.3" opacity="0.65" />
      <path d="M8 44 h48 M12 32 q20 8 40 0 M12 56 q20-8 40 0" fill="none" stroke="#5b7488" strokeWidth="1.1" opacity="0.55" />
      <path d="M22 36 q7-7 12-2 t10 2 q-3 8-12 7 t-10-7 z" fill="#6b7f59" opacity="0.75" />
    </svg>
  </div>
);

const FillerBox = ({ variant }) => (
  <div className="lib-filler" aria-hidden="true"
    style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end" }}>
    <div className="lib-box" style={{ width:88, height:32, background:"#443a30" }}>
      <div className="lib-box-lid"/><div className="lib-box-label">MISC</div>
    </div>
    <div className="lib-box" style={{ width:100, height:50, background:variant?"#4a4038":"#514639", marginTop:2 }}>
      <div className="lib-box-lid"/><div className="lib-box-label">{variant?"DRAFTS '24":"ARCHIVE"}</div>
    </div>
  </div>
);

const FlatStack = () => (
  <div className="lib-filler" aria-hidden="true"
    style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end" }}>
    {[["#704241",90,16],["#41586B",82,14],["#8A6D3B",86,15]].map(([c,w,h],i)=>(
      <div key={i} style={{
        width:w, height:h,
        background:`linear-gradient(90deg,rgba(0,0,0,.25),rgba(255,255,255,.08) 15%,rgba(255,255,255,.02) 50%,rgba(0,0,0,.2)),${c}`,
        borderRadius:2, marginTop:i?2:0, transform:`translateX(${(i-1)*4}px)`,
        boxShadow:"0 2px 4px rgba(0,0,0,.4)",
      }} />
    ))}
  </div>
);

const DECOR_MAP = {
  mjolnir:Mjolnir, pc:PCTower, nymug:NYMug, empire:EmpireState,
  diya:Diya, ganesha:Ganesha, monstera:Monstera, pothos:Pothos,
  globe:Globe, bookendL:BookendL, candle:Candle, rickshaw:Rickshaw,
};

/* ============================ book spine ============================ */

function BookSpine({ book, isSelected, onOpen, dragMoved }) {
  const maxChars = Math.max(8, Math.floor((book.h - 52) / 10.5));
  const spineTitle = book.title.length > maxChars
    ? book.title.slice(0, maxChars - 1).trimEnd() + "…" : book.title;
  return (
    <button className={`lib-book ${isSelected?"is-open":""}`}
      style={{ width:book.w, height:book.h, background:book.spineColor,
        transform:book.lean?`rotate(${book.lean}deg)`:undefined,
        transformOrigin:"bottom left" }}
      aria-label={`${book.title} by ${book.author}`}
      onClick={()=>{if(!dragMoved.current) onOpen(book);}}>
      {book.band && <span className="lib-band"/>}
      <span className="lib-title">{spineTitle}</span>
      {book.orn && <span className="lib-orn"/>}
    </button>
  );
}

/* ============================ drawer ============================ */

function DrawerCover({ book }) {
  const [imgFailed, setImgFailed] = useState(false);
  
  if (book.coverUrl && !imgFailed) {
    return (
      <div className="lib-cover-wrap">
        <img
          className="lib-cover-img"
          src={book.coverUrl}
          alt={`Cover of ${book.title}`}
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }
  
  return (
    <div className="lib-cover-wrap">
      <div className="lib-cover" style={{ background: `linear-gradient(160deg, ${book.spineColor}, #1c1610 160%)` }}>
        <div className="lib-cover-frame">
          <div className="lib-cover-title">{book.title}</div>
          <div className="lib-cover-rule" />
          <div className="lib-cover-author">{book.author}</div>
        </div>
      </div>
    </div>
  );
}

function Drawer({ book, onClose }) {
  useEffect(()=>{
    const onKey=(e)=>{if(e.key==="Escape") onClose();};
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[onClose]);

  return (
    <>
      <div className={`lib-scrim ${book?"on":""}`} onClick={onClose} />
      <aside className={`lib-drawer ${book?"on":""}`} role="dialog" aria-modal="true" aria-label="Book details">
        {book && (
          <div className="lib-drawer-inner">
            <button className="lib-close" onClick={onClose} aria-label="Close">×</button>
            <DrawerCover book={book} />
            <h2 className="lib-h2">{book.title}</h2>
            <div className="lib-author">{book.author}</div>
            <p className="lib-blurb">{book.blurb}</p>
            <a className="lib-gr" href={book.goodreadsUrl} target="_blank" rel="noopener noreferrer">
              <span>View on Goodreads</span>
              <span className="lib-gr-btn" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
            </a>
          </div>
        )}
      </aside>
    </>
  );
}

/* ============================ main ============================ */

export default function TheLibrary({ theme: themeProp } = {}) {
  const rows = useMemo(buildRows, []);
  const [selected, setSelected] = useState(null);
  const [hintGone, setHintGone] = useState(false);

  const [theme, setTheme] = useState(() => {
    if (themeProp) return themeProp;
    if (typeof document !== "undefined") {
      const isBodyDark = document.body.classList.contains('dark-mode');
      return isBodyDark ? 'dark' : 'light';
    }
    if (typeof window !== "undefined" && 
        window.matchMedia("(prefers-color-scheme:light)").matches) return "light";
    return "dark";
  });

  // Sync with document.body class changes (global theme toggles)
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const isBodyDark = document.body.classList.contains('dark-mode');
      setTheme(isBodyDark ? 'dark' : 'light');
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const dragMoved = useRef(false);
  const selectedRef = useRef(null);
  selectedRef.current = selected;

  useLayoutEffect(()=>{
    const vp=viewportRef.current, cv=canvasRef.current;
    if(!vp||!cv) return;
    const reduced=window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    const s={x:0,y:0,vx:0,vy:0,down:false,px:0,py:0,startX:0,startY:0};
    let raf=null, hinted=false;

    const bounds=()=>{
      const r=vp.getBoundingClientRect();
      const bx=r.width>=CANVAS_W?[(r.width-CANVAS_W)/2,(r.width-CANVAS_W)/2]:[r.width-CANVAS_W,0];
      const by=r.height>=CANVAS_H?[(r.height-CANVAS_H)/2,(r.height-CANVAS_H)/2]:[r.height-CANVAS_H,0];
      return {minX:bx[0],maxX:bx[1],minY:by[0],maxY:by[1],vw:r.width,vh:r.height};
    };
    const apply=()=>{
      cv.style.transform=`translate3d(${s.x}px,${s.y}px,0)`;
    };
    const rubber=(v,min,max)=>v<min?min+(v-min)*0.28:v>max?max+(v-max)*0.28:v;
    const settle=()=>{
      const b=bounds();
      s.vx*=0.93;s.vy*=0.93;s.x+=s.vx;s.y+=s.vy;
      if(s.x<b.minX){s.x+=(b.minX-s.x)*0.2;s.vx=0;}
      if(s.x>b.maxX){s.x+=(b.maxX-s.x)*0.2;s.vx=0;}
      if(s.y<b.minY){s.y+=(b.minY-s.y)*0.2;s.vy=0;}
      if(s.y>b.maxY){s.y+=(b.maxY-s.y)*0.2;s.vy=0;}
      apply();
      if(!(Math.abs(s.vx)<0.08&&Math.abs(s.vy)<0.08&&s.x>=b.minX-0.5&&s.x<=b.maxX+0.5&&s.y>=b.minY-0.5&&s.y<=b.maxY+0.5))
        raf=requestAnimationFrame(settle);
    };
    const onDown=(e)=>{
      if(selectedRef.current||e.button&&e.button!==0) return;
      s.down=true;dragMoved.current=false;
      s.px=e.clientX;s.py=e.clientY;s.startX=e.clientX;s.startY=e.clientY;
      s.vx=0;s.vy=0;if(raf)cancelAnimationFrame(raf);
    };
    const onMove=(e)=>{
      if(!s.down) return;
      const dx=e.clientX-s.px,dy=e.clientY-s.py;s.px=e.clientX;s.py=e.clientY;
      if(!dragMoved.current&&Math.hypot(e.clientX-s.startX,e.clientY-s.startY)>6){
        dragMoved.current=true;vp.setPointerCapture?.(e.pointerId);
        vp.classList.add("grabbing");if(!hinted){hinted=true;setHintGone(true);}
      }
      if(!dragMoved.current)return;
      const b=bounds();
      s.x=rubber(s.x+dx,b.minX,b.maxX);s.y=rubber(s.y+dy,b.minY,b.maxY);
      s.vx=0.75*dx+0.25*s.vx;s.vy=0.75*dy+0.25*s.vy;apply();
    };
    const onUp=()=>{
      if(!s.down)return;s.down=false;vp.classList.remove("grabbing");
      if(reduced){const b=bounds();s.x=Math.min(b.maxX,Math.max(b.minX,s.x));
        s.y=Math.min(b.maxY,Math.max(b.minY,s.y));s.vx=0;s.vy=0;apply();
      }else{raf=requestAnimationFrame(settle);}
    };
    const b0=bounds();
    s.x=Math.min(b0.maxX,Math.max(b0.minX,(b0.vw-CANVAS_W)/2));
    s.y=Math.min(b0.maxY,Math.max(b0.minY,(b0.vh-CANVAS_H)/2));apply();
    const ro=new ResizeObserver(()=>{const b=bounds();
      s.x=Math.min(b.maxX,Math.max(b.minX,s.x));s.y=Math.min(b.maxY,Math.max(b.minY,s.y));apply();});
    ro.observe(vp);
    vp.addEventListener("pointerdown",onDown);
    window.addEventListener("pointermove",onMove);
    window.addEventListener("pointerup",onUp);
    window.addEventListener("pointercancel",onUp);
    return ()=>{if(raf)cancelAnimationFrame(raf);ro.disconnect();
      vp.removeEventListener("pointerdown",onDown);window.removeEventListener("pointermove",onMove);
      window.removeEventListener("pointerup",onUp);window.removeEventListener("pointercancel",onUp);};
  },[]);

  return (
    <div className="lib-root" data-theme={theme}>
      <style>{CSS}</style>
      <div className="lib-viewport" ref={viewportRef}>
        <div className="lib-canvas" ref={canvasRef} style={{width:CANVAS_W,height:CANVAS_H}}>
          {[{x:340,drop:88},{x:980,drop:108}].map((b,i)=>(
            <div key={i} className="lib-bulb lib-sway" style={{left:b.x,height:b.drop}}>
              <div className="lib-cord"/><div className="lib-glass"/><div className="lib-glow"/>
            </div>
          ))}
          {rows.map(({row,groups})=>(
            <div key={row} className="lib-row" style={{top:TOP_PAD+row*ROW_H,height:ROW_H}}>
              <div className="lib-row-items">
                {groups.map((g,gi)=>{
                  if(g.type==="cluster") return (
                    <div className="lib-cluster" key={gi}>
                      {g.books.map(bk=>(
                        <BookSpine key={bk.id} book={bk} isSelected={selected?.id===bk.id}
                          onOpen={setSelected} dragMoved={dragMoved}/>
                      ))}
                    </div>
                  );
                  if(g.type==="filler") return g.name==="stack"?<FlatStack key={gi}/>:<FillerBox key={gi} variant={gi%2}/>;
                  const D=DECOR_MAP[g.name]; return D?<D key={gi}/>:null;
                })}
              </div>
              <div className="lib-plank">
                <div className="lib-plank-edge"/>
                <div className="lib-labels-row">
                  {SHELF_LABELS[row].map((lbl,li)=>(<span className="lib-shelf-label" key={li}>{lbl}</span>))}
                </div>
              </div>
            </div>
          ))}
          <div className="lib-baseboard"/><div className="lib-canvas-vignette"/>
        </div>
        <div className="lib-vignette"/><div className="lib-grain"/>
        <div className={`lib-hint ${hintGone?"off":""}`}>Drag to wander · click a spine</div>

        <Drawer book={selected} onClose={()=>setSelected(null)}/>
      </div>
    </div>
  );
}

/* ============================ styles ============================ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;800&display=swap');

/* ═══════════ THEME TOKENS ═══════════ */
.lib-root{
  /* ── dark (default) ── */
  --lb-bg1:#241c15; --lb-bg2:#1b140e;
  --lb-wall1:#2b2119; --lb-wall2:#241b13; --lb-wall3:#1d150e;
  --lb-glow1:rgba(232,168,92,.12); --lb-glow2:rgba(232,168,92,.10);
  --lb-plank1:#6b4e36; --lb-plank2:#503823; --lb-plankedge1:#8a6a48;
  --lb-baseboard1:#3a2c1e; --lb-baseboard2:#241a10;
  --lb-vignette:rgba(10,7,4,.8); --lb-vignette2:rgba(8,5,3,.5);
  --lb-grain:.045;
  --lb-shadow:.5; --lb-shadow-heavy:.55;
  --lb-book-shadow:rgba(0,0,0,.45); --lb-book-hover-shadow:rgba(0,0,0,.5);
  --lb-spine-text:rgba(244,233,214,.92); --lb-spine-band:rgba(244,233,214,.5);
  --lb-label-bg:#e9e1d2; --lb-label-text:#3a2c1e; --lb-label-shadow:rgba(0,0,0,.35);
  --lb-box-bg1:#443a30; --lb-box-bg2:#514639; --lb-box-label-bg:#e9dcc3; --lb-box-label-text:#4a3a28;
  --lb-tip-bg:#14100b; --lb-tip-text:#e9dcc3; --lb-tip-border:rgba(232,168,92,.25);
  --lb-cord:#0f0b07;
  --lb-bulb-shadow:0 0 16px 5px rgba(232,168,92,.55);
  --lb-bulb-glow:rgba(255,200,130,.14);
  --lb-hint-bg:rgba(16,12,8,.55); --lb-hint-text:#cdbfa4; --lb-hint-border:rgba(232,168,92,.2);
  --lb-mm-bg:rgba(14,10,6,.7); --lb-mm-border:rgba(232,168,92,.18);
  --lb-scrim:rgba(8,5,3,.5);
  --lb-drawer-bg1:#221a12; --lb-drawer-bg2:#191209; --lb-drawer-border:rgba(232,168,92,.22);
  --lb-close-border:rgba(232,168,92,.3); --lb-close-text:#e9dcc3;
  --lb-cover-shadow:rgba(0,0,0,.55);
  --lb-cover-frame:rgba(244,233,214,.45); --lb-cover-title:#f4e9d6; --lb-cover-author:rgba(244,233,214,.8);
  --lb-h2:#f4e9d6; --lb-author:#b9a687; --lb-blurb:#d8cbb0;
  --lb-gr-text:#f4e9d6; --lb-gr-border:rgba(232,168,92,.35); --lb-gr-btn-bg:#e8a85c; --lb-gr-btn-text:#241a10;
  --lb-accent:#e8a85c;
  --lb-candle-body:#e9e1d2; --lb-candle-rim:#d8cfc0;
  --lb-mug-body:#e9e1d2;
  --lb-flame-glow:1;
  --lb-diya-glow:.07;
  width:100%;height:100%;font-family:Inter,system-ui,sans-serif;
}

/* ── light theme override ── */
.lib-root[data-theme="light"] {
  --lb-bg1:#e8e0d4; --lb-bg2:#ddd5c8;
  --lb-wall1:#ebe4d8; --lb-wall2:#e2dace; --lb-wall3:#d9d1c4;
  --lb-glow1:rgba(232,168,92,.04); --lb-glow2:rgba(232,168,92,.03);
  --lb-plank1:#a8845e; --lb-plank2:#8a6a48; --lb-plankedge1:#c4a478;
  --lb-baseboard1:#8a7460; --lb-baseboard2:#7a6450;
  --lb-vignette:rgba(180,170,155,.15); --lb-vignette2:rgba(160,150,135,.08);
  --lb-grain:.02;
  --lb-shadow:.18; --lb-shadow-heavy:.22;
  --lb-book-shadow:rgba(0,0,0,.18); --lb-book-hover-shadow:rgba(0,0,0,.25);
  --lb-spine-text:rgba(255,250,240,.95); --lb-spine-band:rgba(255,250,240,.6);
  --lb-label-bg:#f5f0e8; --lb-label-text:#5a4a38; --lb-label-shadow:rgba(0,0,0,.12);
  --lb-box-bg1:#c4b8a6; --lb-box-bg2:#bab0a0; --lb-box-label-bg:#f5f0e8; --lb-box-label-text:#5a4a38;
  --lb-tip-bg:#f5f0e8; --lb-tip-text:#3a2c1e; --lb-tip-border:rgba(160,130,80,.3);
  --lb-cord:#8a7a68;
  --lb-bulb-shadow:0 0 8px 2px rgba(232,168,92,.25);
  --lb-bulb-glow:rgba(255,200,130,.04);
  --lb-hint-bg:rgba(245,240,232,.75); --lb-hint-text:#6a5a48; --lb-hint-border:rgba(160,130,80,.25);
  --lb-mm-bg:rgba(245,240,232,.8); --lb-mm-border:rgba(160,130,80,.3);
  --lb-scrim:rgba(240,235,225,.5);
  --lb-drawer-bg1:#f8f4ee; --lb-drawer-bg2:#f2ece4; --lb-drawer-border:rgba(160,130,80,.2);
  --lb-close-border:rgba(160,130,80,.3); --lb-close-text:#4a3a28;
  --lb-cover-shadow:rgba(0,0,0,.2);
  --lb-cover-frame:rgba(244,233,214,.6); --lb-cover-title:#f4e9d6; --lb-cover-author:rgba(244,233,214,.85);
  --lb-h2:#2a2018; --lb-author:#6a5a48; --lb-blurb:#4a3e32;
  --lb-gr-text:#2a2018; --lb-gr-border:rgba(160,130,80,.35); --lb-gr-btn-bg:#c8944c; --lb-gr-btn-text:#fff;
  --lb-accent:#c8944c;
  --lb-candle-body:#f5f0e8; --lb-candle-rim:#e8e0d4;
  --lb-mug-body:#f5f0e8;
  --lb-flame-glow:.4;
  --lb-diya-glow:.03;
}

/* ═══════════ LAYOUT ═══════════ */
.lib-viewport{position:relative;width:100%;height:100%;overflow:hidden;border-radius:14px;cursor:grab;touch-action:none;background:linear-gradient(var(--lb-bg1),var(--lb-bg2));user-select:none;-webkit-user-select:none}
.lib-viewport.grabbing{cursor:grabbing}
.lib-canvas{position:absolute;top:0;left:0;will-change:transform;
  background:radial-gradient(900px 600px at 26% 8%,var(--lb-glow1),transparent 55%),radial-gradient(800px 500px at 74% 6%,var(--lb-glow2),transparent 55%),linear-gradient(var(--lb-wall1) 0%,var(--lb-wall2) 60%,var(--lb-wall3) 100%)}
.lib-canvas-vignette{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 140px 50px var(--lb-vignette)}
.lib-vignette{position:absolute;inset:0;pointer-events:none;background:radial-gradient(110% 85% at 50% 42%,transparent 50%,var(--lb-vignette2) 100%)}
.lib-grain{position:absolute;inset:0;pointer-events:none;opacity:var(--lb-grain);mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E")}

/* ── shelves ── */
.lib-row{position:absolute;left:40px;right:40px;overflow:visible}
.lib-row-items{position:absolute;left:8px;right:8px;bottom:22px;display:flex;align-items:flex-end;justify-content:space-evenly;gap:0;overflow:visible}
.lib-plank{position:absolute;left:-10px;right:-10px;bottom:0;height:22px;background:linear-gradient(var(--lb-plank1),var(--lb-plank2));border-radius:3px;box-shadow:0 8px 16px rgba(0,0,0,var(--lb-shadow));z-index:1}
.lib-plank-edge{position:absolute;left:0;right:0;top:0;height:6px;background:linear-gradient(var(--lb-plankedge1),var(--lb-plank1));border-radius:3px 3px 0 0}
.lib-labels-row{position:absolute;left:24px;right:24px;top:0;bottom:0;display:flex;align-items:center;justify-content:space-evenly;pointer-events:none}
.lib-shelf-label{font-family:Inter,system-ui,sans-serif;font-size:7.5px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--lb-label-text);background:var(--lb-label-bg);padding:2.5px 9px;border-radius:1.5px;box-shadow:0 1px 2px var(--lb-label-shadow);user-select:none}
.lib-baseboard{position:absolute;left:0;right:0;bottom:0;height:30px;background:linear-gradient(var(--lb-baseboard1),var(--lb-baseboard2))}

/* ── books ── */
.lib-cluster{display:flex;align-items:flex-end;gap:2px}
.lib-book{position:relative;border:none;padding:0;cursor:pointer;border-radius:3px 3px 1px 1px;overflow:hidden;background-image:linear-gradient(90deg,rgba(0,0,0,.32),rgba(255,255,255,.10) 18%,rgba(255,255,255,.02) 50%,rgba(0,0,0,.28));box-shadow:0 3px 6px var(--lb-book-shadow),inset 0 -6px 8px rgba(0,0,0,.25);transition:transform .22s cubic-bezier(.2,.8,.3,1.2),box-shadow .22s ease}
.lib-book:hover,.lib-book:focus-visible{transform:translateY(-10px);z-index:3;box-shadow:0 14px 20px var(--lb-book-hover-shadow),inset 0 -6px 8px rgba(0,0,0,.25)}
.lib-book.is-open{transform:translateY(-14px);z-index:3;box-shadow:0 16px 24px var(--lb-book-hover-shadow)}
.lib-book:focus-visible{outline:2px solid var(--lb-accent);outline-offset:3px}
.lib-title{position:absolute;top:12px;bottom:26px;left:0;right:0;margin:auto;writing-mode:vertical-rl;text-orientation:mixed;font-family:Inter,sans-serif;font-size:10px;font-weight:600;letter-spacing:.06em;color:var(--lb-spine-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;justify-content:center}
.lib-band{position:absolute;left:0;right:0;top:7px;height:3px;background:var(--lb-spine-band);box-shadow:0 6px 0 var(--lb-spine-band)}
.lib-orn{position:absolute;left:50%;bottom:11px;width:6px;height:6px;transform:translateX(-50%) rotate(45deg);background:var(--lb-spine-band)}

/* ── decor ── */
.lib-decor,.lib-egg,.lib-filler{flex-shrink:0;overflow:visible}
.lib-egg{position:relative;overflow:visible}
.lib-tip{position:absolute;bottom:calc(100% + 10px);left:50%;transform:translateX(-50%) translateY(4px);background:var(--lb-tip-bg);color:var(--lb-tip-text);font-size:11px;font-weight:500;letter-spacing:.02em;padding:6px 10px;border-radius:6px;white-space:nowrap;border:1px solid var(--lb-tip-border);opacity:0;transition:opacity .2s ease,transform .2s ease;pointer-events:none;z-index:5}
.lib-egg:hover .lib-tip{opacity:1;transform:translateX(-50%) translateY(0)}
.lib-box{position:relative;border-radius:3px;box-shadow:0 3px 5px rgba(0,0,0,var(--lb-shadow));background-image:linear-gradient(rgba(255,255,255,.06),rgba(0,0,0,.18))}
.lib-box-lid{position:absolute;top:0;left:0;right:0;height:7px;background:rgba(0,0,0,.15);border-radius:3px 3px 0 0}
.lib-box-label{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--lb-box-label-bg);color:var(--lb-box-label-text);font-size:7.5px;font-weight:600;letter-spacing:.14em;padding:2px 6px;border-radius:1px;opacity:.85}

/* ── bulbs & glow ── */
.lib-bulb{position:absolute;top:0;width:2px;transform-origin:top center}
.lib-cord{width:2px;height:100%;background:var(--lb-cord);margin:0 auto}
.lib-glass{position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);width:20px;height:24px;border-radius:50% 50% 46% 46%;background:radial-gradient(circle at 50% 38%,#ffe9c4,#e8a85c 65%,#b97a34);box-shadow:var(--lb-bulb-shadow)}
.lib-glow{position:absolute;bottom:-140px;left:50%;transform:translateX(-50%);width:380px;height:260px;pointer-events:none;background:radial-gradient(closest-side,var(--lb-bulb-glow),transparent 70%)}

/* ── hint + minimap ── */
.lib-hint{position:absolute;top:16px;left:50%;transform:translateX(-50%);color:var(--lb-hint-text);font-size:11px;letter-spacing:.14em;text-transform:uppercase;background:var(--lb-hint-bg);border:1px solid var(--lb-hint-border);padding:6px 13px;border-radius:999px;backdrop-filter:blur(4px);transition:opacity .6s ease;pointer-events:none}
.lib-hint.off{opacity:0}
.lib-minimap{position:absolute;right:14px;bottom:14px;border-radius:5px;background:var(--lb-mm-bg);border:1px solid var(--lb-mm-border);overflow:hidden;pointer-events:none}
.lib-mm-view{position:absolute;top:0;left:0;border:1px solid var(--lb-accent);border-radius:2px;background:rgba(232,168,92,.12)}

/* ── drawer ── */
.lib-scrim{position:absolute;inset:0;background:var(--lb-scrim);opacity:0;pointer-events:none;transition:opacity .3s ease;z-index:8}
.lib-scrim.on{opacity:1;pointer-events:auto}
.lib-drawer{position:absolute;top:0;right:0;bottom:0;width:min(320px,92%);background:linear-gradient(var(--lb-drawer-bg1),var(--lb-drawer-bg2));border-left:1px solid var(--lb-drawer-border);transform:translateX(102%);transition:transform .38s cubic-bezier(.32,.72,.24,1);z-index:9;box-shadow:-24px 0 48px rgba(0,0,0,var(--lb-shadow));overflow-y:auto;touch-action:pan-y;pointer-events:auto}
.lib-drawer.on{transform:translateX(0)}
.lib-drawer-inner{padding:16px 20px 20px}
.lib-close{position:absolute;top:12px;right:14px;width:30px;height:30px;border-radius:50%;border:1px solid var(--lb-close-border);background:transparent;color:var(--lb-close-text);font-size:16px;line-height:1;cursor:pointer;transition:background .2s;z-index:10}
.lib-close:hover{background:rgba(232,168,92,.14)}
.lib-cover-wrap{display:flex;justify-content:center;padding:4px 0 8px;perspective:800px}
.lib-cover{width:120px;aspect-ratio:2/3;border-radius:4px 8px 8px 4px;box-shadow:0 12px 24px var(--lb-cover-shadow),inset 4px 0 8px rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;transition:transform .4s ease;transform:rotateY(-7deg)}
.lib-cover:hover{transform:rotateY(2deg) translateY(-4px)}
.lib-cover-img {
  width: 120px;
  border-radius: 4px 8px 8px 4px;
  box-shadow: 0 12px 24px var(--lb-cover-shadow), inset 4px 0 8px rgba(255,255,255,.08);
  transition: transform .4s ease;
  transform: rotateY(-7deg);
}
.lib-cover-img:hover {
  transform: rotateY(2deg) translateY(-4px);
}
.lib-cover-frame{border:1px solid var(--lb-cover-frame);margin:8px;padding:12px 8px;height:calc(100% - 16px);width:calc(100% - 16px);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.lib-cover-title{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:13px;line-height:1.25;color:var(--lb-cover-title)}
.lib-cover-rule{width:22px;height:1px;background:var(--lb-cover-frame);margin:6px 0}
.lib-cover-author{font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--lb-cover-author)}
.lib-h2{font-family:Fraunces,Georgia,serif;font-weight:700;font-size:18px;color:var(--lb-h2);margin:8px 0 2px;line-height:1.15}
.lib-author{color:var(--lb-author);font-size:12px;margin-bottom:8px}
.lib-blurb{color:var(--lb-blurb);font-size:12.5px;line-height:1.5;margin:0 0 14px}
.lib-gr{display:flex;align-items:center;justify-content:space-between;gap:10px;text-decoration:none;color:var(--lb-gr-text);font-weight:600;font-size:12.5px;border:1px solid var(--lb-gr-border);border-radius:10px;padding:8px 12px;transition:background .2s ease,border-color .2s ease}
.lib-gr:hover{background:rgba(232,168,92,.1);border-color:rgba(232,168,92,.6)}
.lib-gr-btn{width:26px;height:26px;border-radius:50%;background:var(--lb-gr-btn-bg);color:var(--lb-gr-btn-text);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform .2s ease}
.lib-gr:hover .lib-gr-btn{transform:translateX(3px)}
.lib-gr:focus-visible,.lib-close:focus-visible{outline:2px solid var(--lb-accent);outline-offset:2px}
.lib-gr:hover .lib-gr-btn{transform:translateX(3px)}
.lib-gr:focus-visible,.lib-close:focus-visible{outline:2px solid var(--lb-accent);outline-offset:2px}

/* ═══════════ ANIMATIONS ═══════════ */
@keyframes lib-sway{0%,100%{transform:rotate(-1.1deg)}50%{transform:rotate(1.1deg)}}
@keyframes lib-sway-soft{0%,100%{transform:rotate(-.6deg)}50%{transform:rotate(.6deg)}}
@keyframes lib-flicker{0%,100%{transform:scale(1);opacity:1}40%{transform:scale(.94) translateY(.6px);opacity:.85}70%{transform:scale(1.05)}}
@keyframes lib-flicker2{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(.9) translateY(.5px);opacity:.7}80%{transform:scale(1.06)}}
@keyframes lib-breathe{0%,100%{opacity:.9}50%{opacity:.35}}
@keyframes lib-blink{0%,92%,100%{opacity:1}96%{opacity:.2}}
.lib-sway{animation:lib-sway 7s ease-in-out infinite}
.lib-sway-soft{transform-origin:bottom center;animation:lib-sway-soft 9s ease-in-out infinite}
.lib-flicker{transform-origin:29px 22px;animation:lib-flicker 2.2s ease-in-out infinite;opacity:var(--lb-flame-glow)}
.lib-flicker2{transform-origin:19px 12px;animation:lib-flicker2 3s ease-in-out infinite;opacity:var(--lb-flame-glow)}
.lib-rgb{animation:lib-breathe 4s ease-in-out infinite}
.lib-rgb2{animation:lib-breathe 4s ease-in-out infinite reverse}
.lib-blink{animation:lib-blink 5s linear infinite}

@media(prefers-reduced-motion:reduce){
  .lib-sway,.lib-sway-soft,.lib-flicker,.lib-flicker2,.lib-rgb,.lib-rgb2,.lib-blink{animation:none}
  .lib-book,.lib-drawer,.lib-cover,.lib-gr-btn{transition:none}
}
`;
