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
    tech: d.tech ?? d.stack?.join?.(', ') ?? '',
    link: real(d.link),
    linkLabel: d.linkLabel ?? 'Open',
    github: real(d.github),
  }
})

/** Every role, newest first, for Chapter Three's index. */
export const ALL_ROLES = workData.map(w => ({ org: w.org, role: w.role, period: w.period, year: w.year, place: w.location, type: w.type, impact: w.impact, bullets: w.bullets, current: w.current, future: w.future }))

/** A shorter list of headline roles. */
export const ROLES = ['Daiwa Capitals Market America', 'COA', 'UB College of Arts & Sciences', 'MedTourEasy', 'Sunflower Association'].map(org => {
  const w = role(org)
  return { org: w.org, role: w.role, period: w.period, place: w.location, impact: w.impact }
})

export const CONTACT = {
  email: 'tejasgov2005@gmail.com',
  links: [
    { label: 'GitHub', href: 'https://github.com/TejasGov' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/tejas-govind-29520a2b2/' },
    { label: 'Instagram', href: 'https://www.instagram.com/tejasgovind_' },
    { label: 'X', href: 'https://x.com/TejasGovin17982' },
  ],
}
