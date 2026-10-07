import { useEffect, useRef, useState } from 'react';
import { Search, SlidersHorizontal, Sun, Moon, Pause, Play, Volume2 } from 'lucide-react';
import './TopNavbar.css';
const titles = { projects: 'Projects', about: 'About Me', 'work-ex': 'Work Experience', photography: 'Photography', 'my-tech': 'My Tech', 'my-niche': 'My Niche', 'my-sound': 'My Sound', 'my-library': 'My Library', blog: 'Blog', terminal: 'Terminal' };
export default function TopNavbar({ activeWindowId, onHome, onOpenWindow, onToggleSearch, onContact, onHelp, isDarkMode, onToggleTheme, motionPaused, reducedMotion, onToggleMotion }) {
  const [menu, setMenu] = useState(null);
  const [volume, setVolume] = useState(50);
  const barRef = useRef(null);
  const returnFocusRef = useRef(null);
  const [time, setTime] = useState(new Date());
  useEffect(() => { const timer = setInterval(() => setTime(new Date()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const applyVolume = () => { document.querySelectorAll('audio, video').forEach(media => { media.volume = volume / 100; }); window.portfolioGlobalVolume = volume / 100; };
    applyVolume();
    const observer = new MutationObserver(applyVolume);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [volume]);
  useEffect(() => {
    if (!menu) return;
    const dismiss = event => { if (!barRef.current?.contains(event.target)) setMenu(null); };
    const escape = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setMenu(null); returnFocusRef.current?.focus(); } };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape, true); };
  }, [menu]);
  const toggleMenu = (name, event) => { returnFocusRef.current = event.currentTarget; setMenu(current => current === name ? null : name); };
  const command = name => { window.dispatchEvent(new CustomEvent('window-command', { detail: { id: activeWindowId, cmd: name } })); setMenu(null); };
  return <header className="mac-menubar" ref={barRef}>
    <nav className="menubar-left" aria-label="Desktop menu"><button className="os-monogram" onClick={onHome} aria-label="Show desktop">TG</button><button className="os-app-name" onClick={event => toggleMenu('portfolio', event)} aria-expanded={menu === 'portfolio'}>{titles[activeWindowId] || 'Tejas OS'}</button><button className="desktop-menu-item" onClick={() => onOpenWindow('terminal')}>Terminal</button><div className="menu-anchor desktop-menu-item"><button disabled={!activeWindowId} onClick={event => toggleMenu('window', event)} aria-expanded={menu === 'window'}>Window</button>{menu === 'window' && activeWindowId && <div className="mac-menu" aria-label="Window actions"><button onClick={() => command('close')}>Close Window <kbd>Esc</kbd></button><button onClick={() => command('minimize')}>Minimize</button><button onClick={() => command('zoom')}>Zoom</button><button onClick={() => command('center')}>Center</button></div>}</div><button className="desktop-menu-item" onClick={() => onOpenWindow('blog')}>Blog</button><button className="desktop-menu-item" onClick={onHelp}>Help</button></nav>
    {menu === 'portfolio' && <div className="mac-menu portfolio-menu"><button onClick={() => { onOpenWindow('about'); setMenu(null); }}>About Tejas</button><button onClick={() => { onOpenWindow('projects'); setMenu(null); }}>Projects</button><button onClick={() => { onOpenWindow('work-ex'); setMenu(null); }}>Experience</button><button onClick={() => { onOpenWindow('blog'); setMenu(null); }}>Blog</button><hr /><button onClick={() => { onContact(); setMenu(null); }}>Contact</button><button onClick={() => { onHelp(); setMenu(null); }}>How to explore</button></div>}
    <div className="menubar-right"><button onClick={onToggleTheme} aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} theme`}>{isDarkMode ? <Sun size={15} /> : <Moon size={15} />}</button><button onClick={onToggleSearch} aria-label="Search the portfolio"><Search size={15} /></button><div className="menu-anchor"><button onClick={event => toggleMenu('controls', event)} aria-label="Control Center" aria-expanded={menu === 'controls'}><SlidersHorizontal size={15} /></button>{menu === 'controls' && <div className="mac-menu control-center"><p>Control Center</p><button onClick={onToggleTheme}>{isDarkMode ? <Sun size={17} /> : <Moon size={17} />}Appearance<span>{isDarkMode ? 'Dark' : 'Light'}</span></button><button disabled={reducedMotion} onClick={onToggleMotion} aria-label={reducedMotion ? 'Reduced motion enabled' : motionPaused ? 'Play background video' : 'Pause background video'}>{motionPaused || reducedMotion ? <Play size={17} /> : <Pause size={17} />}Wallpaper<span>{reducedMotion ? 'Still' : motionPaused ? 'Paused' : 'Playing'}</span></button><label className="volume-control"><Volume2 size={16} /><span className="sr-only">Media volume</span><input type="range" min="0" max="100" value={volume} onChange={event => setVolume(Number(event.target.value))} /></label></div>}</div><time className="menu-clock" dateTime={time.toISOString()}>{time.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit' })}</time></div>
  </header>;
}
