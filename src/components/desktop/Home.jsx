import { ArrowUpRight, ArrowDown, Braces, BriefcaseBusiness, Camera, Monitor, Film, AudioLines, BookOpen } from 'lucide-react';
const sections = [
  { id: 'projects', title: 'Selected work', caption: 'Ideas, made real', icon: Braces },
  { id: 'work-ex', title: 'Experience', caption: 'The journey so far', icon: BriefcaseBusiness },
  { id: 'photography', title: 'Photography', caption: 'Through my lens', icon: Camera },
  { id: 'my-tech', title: 'My setup', caption: 'Tools of the trade', icon: Monitor },
  { id: 'my-niche', title: 'Off the clock', caption: 'A few obsessions', icon: Film },
  { id: 'my-sound', title: 'On repeat', caption: 'The soundtrack', icon: AudioLines },
  { id: 'my-library', title: 'The bookshelf', caption: 'Between the lines', icon: BookOpen },
];
export default function Home({ onOpenWindow, onContact, activeWindows, minimizedWindows }) {
  return <main id="main-content" className="home-scroll" tabIndex={-1}>
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-intro">
        <p className="eyebrow hero-eyebrow"><span className="status-dot" /> ENGINEER, BUILDER & CURIOUS HUMAN</p>
        <h1 id="hero-title">A little logic.<br />A lot of <em>curiosity.</em><span className="pixel-spark" aria-hidden="true">✳</span></h1>
        <p className="hero-description">I’m Tejas, a computer science student at the University at Buffalo. I build thoughtful digital experiences — and follow the things that make me curious.</p>
        <div className="hero-actions"><button className="primary-button" onClick={() => onOpenWindow('projects')}>Explore my work <ArrowUpRight size={18} /></button><button className="text-button" onClick={() => onOpenWindow('about')}>The person behind it <ArrowUpRight size={16} /></button></div>
      </div>
      <aside className="hero-note" aria-label="Current chapter"><div className="note-mark" aria-hidden="true">[ TG — 01 ]</div><p className="eyebrow">CURRENT CHAPTER</p><p>Computer science.<br /><em>Human possibilities.</em></p><span>University at Buffalo · Class of 2027</span><button onClick={onContact}>Let’s make something good <ArrowUpRight size={14} /></button></aside>
      <a className="hero-scroll-hint" href="#directory"><ArrowDown size={13} /> A LITTLE MORE OF MY WORLD</a>
    </section>
    <section id="directory" className="directory" aria-labelledby="directory-title">
      <div className="directory-heading"><div><p className="eyebrow">THE DIRECTORY</p><h2 id="directory-title">Many interests. One very curious mind.</h2></div><span className="directory-hint">Pick a folder. Stay a while. <ArrowUpRight size={14} /></span></div>
      <div className="directory-grid">{sections.map(({ id, title, caption, icon: Icon }, i) => <button key={id} className={`directory-item ${activeWindows.includes(id) ? 'is-open' : ''}`} onClick={() => onOpenWindow(id)} aria-label={`Open ${title}`}><span className="directory-item-top"><span className="directory-number">0{i + 1}</span><ArrowUpRight className="directory-arrow" size={15} /></span><span className="directory-symbol" aria-hidden="true"><Icon size={28} strokeWidth={1.2} /></span><span className="desktop-icon-label">{title}</span><span className="directory-caption">{caption}</span>{activeWindows.includes(id) && <span className="directory-open-label">{minimizedWindows.includes(id) ? 'Minimized' : 'Open'}</span>}</button>)}</div>
    </section>
    <footer className="home-footer"><span>BUILT WITH INTENTION. A LITTLE PLAY, TOO.</span><button onClick={onContact}>Have something in mind? <ArrowUpRight size={13} /></button></footer>
  </main>;
}
