import { ArrowUpRight, BriefcaseBusiness, Camera, Film, Headphones, Monitor, BookOpen, Code2, Search } from 'lucide-react';
import { desktopItems, memojiImg } from '../../data';
import DesktopWidgets from './DesktopWidgets';
const icons = { projects: Code2, 'work-ex': BriefcaseBusiness, photography: Camera, 'my-tech': Monitor, 'my-niche': Film, 'my-sound': Headphones, 'my-library': BookOpen };
const colors = ['#f48eb3', '#75d9bd', '#82c5ef', '#8d8cdb', '#eec36e', '#b2a0e3', '#86b6f2'];
export default function Home({ onOpenWindow, onContact, onSearch, activeWindows, minimizedWindows }) {
  return <main id="main-content" className="mac-desktop" tabIndex={-1} aria-label="Tejas OS desktop">
    <div className="widget-stage"><DesktopWidgets /></div>
    <section className="desktop-welcome glass-panel" aria-labelledby="desktop-greeting">
      <div className="welcome-identity"><img src={memojiImg} alt="" /><div><p className="welcome-eyebrow"><span className="pixel-mark" aria-hidden="true" /> WELCOME TO MY DESKTOP</p><h1 id="desktop-greeting">Hi, I’m Tejas.</h1><p>Computer science at the University at Buffalo.<br />Building things. Following curiosity.</p></div></div>
      <div className="welcome-actions"><button onClick={() => onOpenWindow('about')}>A little about me <ArrowUpRight size={13} /></button><button onClick={onContact}>Say hello <ArrowUpRight size={13} /></button></div>
      <button className="welcome-search" onClick={onSearch} aria-label="Open Spotlight"><Search size={14} aria-hidden="true" /><span>Spotlight Search</span><kbd>⌘ Space</kbd></button>
    </section>
    <ul className="desktop-icons-grid" aria-label="Portfolio folders">{desktopItems.map((item, index) => {
      const Icon = icons[item.id];
      return <li key={item.id}><button className={`desktop-icon ${activeWindows.includes(item.id) && !minimizedWindows.includes(item.id) ? 'is-open' : ''}`} onClick={() => onOpenWindow(item.id)} aria-label={`Open ${item.title}`}>
        <span className="finder-folder" style={{ '--folder-color': colors[index], '--folder-gradient': item.color }} aria-hidden="true"><span className="folder-tab" /><span className="folder-paper" /><span className="folder-face"><Icon size={25} strokeWidth={1.4} /></span><span className="folder-dither" /><span className="folder-pixels" /></span>
        <span className="desktop-icon-label">{item.title}</span>
      </button></li>;
    })}</ul>
  </main>;
}
