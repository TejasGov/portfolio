import { projectsData } from '@/data/projectsData'
import { workData } from '@/data/workData'

const project = id => projectsData.find(p => p.id === id)
const role = org => workData.find(w => w.org === org)
const real = url => (url && url !== '#' ? url : null)

/** The five films of Chapter Two, in order. Each id has a scene in cinema/films/. */
export const PROJECTS = [
  { id: 'smash-cricket', shape: 'hand', line: 'Hand cricket, played with your actual hand. A webcam reads 1–6 fingers in under half a second.' },
  { id: 'cognifight', shape: 'brain', title: 'CogniFlow', line: 'Predicting when someone with ADHD is about to abandon a task, early enough to help.' },
  { id: 'revere', shape: 'glasses', line: 'Smart glasses that quietly tell someone with Alzheimer’s who they’re talking to.' },
  { id: 'yudhveer', shape: 'sword', line: 'A sword-and-shield campaign in the browser: five chapters, bosses, deflects.' },
  { id: 'commit-city', shape: 'city', line: 'A year of GitHub commits, built into a city you can fly around.' },
].map(p => {
  const d = project(p.id)
  return {
    ...p,
    title: p.title ?? d.title.replace(/ – .*/, ''),
    category: d.category,
    shortCategory: d.shortCategory,
    tech: d.tech ?? d.stack?.join?.(', ') ?? '',
    link: real(d.link),
    linkLabel: d.linkLabel ?? 'Open',
    github: real(d.github),
  }
})

/** Chapter Two's lobby wall: one poster each. `bill` is the poster's credit block (its key tech). */
export const ALSO_SHOWING = [
  { id: 'echoscribe', line: 'An ambient clinical scribe: a doctor and patient talk, and a structured SOAP note writes itself.', bill: 'FastAPI · React · Whisper · PyAnnote · FHIR R4' },
  { id: 'whattowatch-tonight', title: 'WhatToWatch Tonight', tag: 'One film. Everyone agrees.', line: 'Movie night for a group: everyone ranks, a Borda count combines the votes, one film wins.', bill: 'React · TypeScript · Vite · Tailwind · OMDb' },
  { id: 'backpack-brain', tag: 'Snap the notice. Know what to do.', line: 'School flyers, bills and invites, turned into clear action cards for busy families.', bill: 'React · TypeScript · Tailwind · Supabase' },
  { id: 'gotta-get-rich', line: 'A retro pixel-art life sim: pick a career, buy property, play the stock market.', bill: 'Next.js · TypeScript · Tailwind · shadcn/ui' },
].map(p => {
  const d = project(p.id)
  return { ...p, title: p.title ?? d.title, category: d.category, link: real(d.link), github: real(d.github) }
})

/**
 * Chapter Two's lab list: the machine-learning repos (private, so no code link). `does` is from the repo
 * description, `how` from its README, and `result` (when present) is the README's own words.
 */
export const LAB = [
  { id: 'gpt-from-scratch', does: 'A GPT-style transformer written from scratch in PyTorch and trained on TinyStories.', how: ['BPE tokenizer', 'Attention, implemented by hand', 'Sampling', 'Attention visualiser'] },
  { id: 'llm-router', does: 'Learned routing between cheap and expensive LLMs (Qwen2.5 0.5B–7B), plus intent routing with out-of-scope rejection.', how: ['Matrix factorization router', 'TF-IDF + logistic regression', 'Accuracy-vs-cost curves', 'Out-of-scope rejection'], result: 'Intent routing (CLINC150, semantic router): 0.884 overall accuracy, 0.834 out-of-scope recall' },
  { id: 'agent-harness', does: 'An agent harness from scratch: tool calling, permissions, budgets, tracing and replay.', how: ['Tool calling and permissions', 'Tracing and replay', 'Five workflow patterns', 'Deterministic eval suite'], result: 'ToolBench-Lite pass@1 (48 multi-step tasks, T = 0): 25% → 48% → 60% → 69% from 0.5B to 7B.' },
  { id: 'movie-recommender', does: 'Five movie recommenders on MovieLens, from a popularity baseline to learned embeddings.', how: ['Item-KNN', 'Matrix factorisation, BPR and EASE', 'Ranking metrics', 'Leakage check'], result: 'EASE wins: NDCG@10 0.126 and a 50.6% hit rate, against 0.077 and 32.4% for the popularity baseline.' },
  { id: 'spam-detector', does: 'An SMS spam detector with honest evaluation, error analysis and a Streamlit demo.', how: ['TF-IDF word and character n-grams', 'Logistic regression', 'Threshold tuning', 'Error analysis'], result: 'Test F1 (spam) 0.977: catches 125 of 128 spam, with 3 false alarms out of 904 ham' },
].map(p => {
  const d = project(p.id)
  return { ...p, title: d.title, stack: d.tech.replace(/, /g, ' · ') }
})

/** Every role, newest first, for Chapter Three's index. */
export const ALL_ROLES = workData.map(w => ({ org: w.org, role: w.role, team: w.team, period: w.period, year: w.year, place: w.location, type: w.type, impact: w.impact, bullets: w.bullets, current: w.current, future: w.future }))

/** A shorter list of headline roles. */
export const ROLES = ['Daiwa Capital Markets America', 'COA', 'UB College of Arts & Sciences', 'MedTourEasy', 'Sunflower Association'].map(org => {
  const w = role(org)
  return { org: w.org, role: w.role, period: w.period, place: w.location, impact: w.impact }
})

export const RESUME = '/Tejas_Govind_Resume.pdf' // public/

/** The two résumé projects that are not among the five films. */
export const ALSO_BUILT = [
  { title: 'Afim', href: 'https://github.com/TejasGov/Afim' },
  { title: 'Shadow Cohort', href: 'https://github.com/atshalahmedkhan/Hackathon_UD' },
]

export const CONTACT = {
  email: 'tejasgov2005@gmail.com',
  // Résumé first: every contact row (Contents, epilogue, colophon) maps this list.
  links: [
    { label: 'Résumé', href: RESUME },
    { label: 'GitHub', href: 'https://github.com/TejasGov' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/tejas-govind-29520a2b2/' },
    { label: 'Instagram', href: 'https://www.instagram.com/tejasgovind_' },
    { label: 'X', href: 'https://x.com/TejasGovin17982' },
  ],
}

/*
 * Chapter Three: the traveller's journey, oldest first. Each stop is a little world (a Meshy diorama in
 * public/cinema/journey/) with the roles that belong to that place and time.
 */
const STOPS = [
  { id: 'prayagraj', when: '2022', place: 'Prayagraj', orgs: ['Sunflower Association'] },
  { id: 'campus', when: '2024', place: 'Buffalo', orgs: ['Clean Campus', 'UB Campus Dining & Shops'] },
  { id: 'gym', when: '2025', place: 'UB Athletics', orgs: ['UB Athletics'] },
  { id: 'library', when: '2025', place: 'Libraries & labs', orgs: ['UB Libraries', 'UB College of Arts & Sciences'] },
  { id: 'garage', when: '2025–26', place: 'Remote & Buffalo', orgs: ['MedTourEasy', 'COA', 'University at Buffalo', 'Society of Computing at UB'] },
  { id: 'nyc', when: '2026', place: 'New York', orgs: ['Daiwa Capital Markets America'] },
]
export const JOURNEY = STOPS.map(s => ({ ...s, roles: ALL_ROLES.filter(r => s.orgs.includes(r.org)).reverse() }))

/*
 * The box office (boxoffice/): every showing, as a programme. A group is the front door's ticket; its
 * `showings` are the box office's (a group without them is its own one showing). `go` is where a ticket
 * jumps: { chapter, i | k } for Book.jsx goTo, or { id } for goToId, with `or` when the id may not exist
 * yet. `worlds` are the 3D worlds warmed (Stage.jsx 'novel:warm') before the jump.
 */
const FIVE = { chapter: 'five' }
export const PROGRAMME = [
  { id: 'about', screen: 'Screen 1', time: '1 min', title: 'About me', line: 'A scrapbook: who I am, where I’m from.', go: { chapter: 'one' } },
  {
    id: 'work', screen: 'Screen 2', time: '5 min', title: 'Now Showing', line: 'Five films of things I built, then the lobby.', go: { chapter: 'two', i: 0 },
    showings: [
      ...PROJECTS.map((p, i) => ({ id: p.id, time: '1 min', title: p.title, line: p.line, go: { chapter: 'two', i } })),
      { id: 'also', time: '1 min', title: 'Also showing', line: 'Four more projects, one poster each.', go: { id: 'also' } },
      { id: 'lab', time: '2 min', title: 'In the lab', line: 'Machine-learning experiments, with their results.', go: { id: 'lab' } },
    ],
  },
  { id: 'worked', screen: 'Screen 3', time: '3 min', title: 'Places I worked', line: 'Prayagraj to New York, in six stops.', go: { id: 'three' }, worlds: ['journey'] },
  {
    id: 'games', screen: 'Screen 4', time: '4 min', title: 'Press Start', line: 'An ode to the games I grew up on.', go: { id: 'four' }, worlds: ['arcade'],
    showings: [
      { id: 'arcade', time: '1 min', title: 'Neon coast', line: 'A boardwalk at dusk. Reach the arcade.', go: { id: 'scene-arcade' }, worlds: ['arcade'] },
      { id: 'blocks', time: '1 min', title: 'Block world', line: 'A wave turns the coast to blocks.', go: { id: 'scene-blocks' }, worlds: ['arcade'] },
      { id: 'village', time: '1 min', title: 'The village', line: 'Clouds part on a village to build.', go: { id: 'scene-village' }, worlds: ['village'] },
      { id: 'ops', time: '1 min', title: 'Night ops', line: 'A night exercise. Reach the helicopter.', go: { id: 'scene-ops' }, worlds: ['ops'] },
    ],
  },
  {
    id: 'screen', screen: 'Screen 5', time: '6 min', title: 'The Big Screen', line: 'A fan’s tribute: the scenes I’d jump into.', go: FIVE, worlds: ['swing'],
    showings: [
      { id: 'swing', time: '1 min', title: 'Spider-Man', line: 'Golden hour on a copper dome. One leap, then the swing.', go: { id: 'scene-swing', or: FIVE }, worlds: ['swing'] },
      { id: 'dive', time: '1 min', title: 'Iron Man', line: 'Off the tower’s landing pad and into the suit.', go: { id: 'scene-dive', or: FIVE }, worlds: ['dive'] },
      { id: 'landing', time: '1 min', title: 'Thor', line: 'Out of the lightning, Stormbreaker in hand.', go: { id: 'scene-landing', or: FIVE }, worlds: ['landing'] },
      { id: 'chase', time: '1 min', title: 'The Dark Knight', line: 'A night chase under the tracks.', go: { id: 'scene-chase', or: FIVE }, worlds: ['chase'] },
      { id: 'final', time: '1 min', title: 'Argentina 2022', line: 'The final, 18 December 2022.', go: { id: 'scene-final', or: FIVE }, worlds: ['final'] },
      { id: 'dance', time: '1 min', title: 'Deadpool & Wolverine', line: 'Bye Bye Bye, and a snowy clearing full of henchmen.', go: { id: 'scene-dance', or: FIVE }, worlds: ['dance'] },
    ],
  },
  { id: 'contact', screen: 'The lobby', time: '1 min', title: 'Contact', line: 'House lights up, and how to reach me.', go: { id: 'epilogue' } },
]
