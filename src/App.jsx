import { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, MotionConfig, useReducedMotion } from 'framer-motion';
import { Mail, Globe, X, FileText } from 'lucide-react';
import { useConversationClientTool } from '@elevenlabs/react';
import Home from './components/desktop/Home';
import { memojiImg } from './data';
import Atmosphere from './components/desktop/Atmosphere';
import Dock, { DockIcon } from './components/desktop/Dock';
import TopNavbar from './components/desktop/TopNavbar';
import SocialsDrawer from './components/overlays/SocialsDrawer';
import HelpModal from './components/overlays/HelpModal';
import SpotlightSearch from './components/overlays/SpotlightSearch';
import EmailModal from './components/overlays/EmailModal';
import AIOrbOverlay from './components/overlays/AIOrbOverlay';
import WindowModal from './components/windows/WindowModal';

const windowNames = { projects: 'Projects', 'work-ex': 'Experience', photography: 'Photography', 'my-tech': 'My setup', 'my-niche': 'Off the clock', 'my-sound': 'On repeat', 'my-library': 'Bookshelf', about: 'About', terminal: 'Terminal', blog: 'Journal' };
function storedPreference(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } }

export default function App() {
  const [activeWindows, setActiveWindows] = useState([]);
  const [minimizedWindows, setMinimizedWindows] = useState([]);
  const [overlay, setOverlay] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(() => storedPreference('tg-theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') !== 'light');
  const [motionPaused, setMotionPaused] = useState(() => storedPreference('tg-motion', 'play') === 'pause');
  const reduceMotion = useReducedMotion();
  const constraintsRef = useRef(null);
  const visibleWindows = activeWindows.filter(id => !minimizedWindows.includes(id));
  const currentActiveWindow = visibleWindows.at(-1) || 'desktop';

  useEffect(() => {
    document.body.classList.toggle('dark-mode', isDarkMode);
    document.documentElement.style.colorScheme = isDarkMode ? 'dark' : 'light';
    try { localStorage.setItem('tg-theme', isDarkMode ? 'dark' : 'light'); } catch {}
  }, [isDarkMode]);
  useEffect(() => { try { localStorage.setItem('tg-motion', motionPaused ? 'pause' : 'play'); } catch {} }, [motionPaused]);
  useEffect(() => {
    const handleKeyDown = event => {
      if (event.isComposing) return;
      if (((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') || (event.metaKey && event.code === 'Space')) {
        event.preventDefault();
        setOverlay(current => current === 'search' ? null : 'search');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleWindow = useCallback(id => {
    if (id === 'contact') { setOverlay('email'); return; }
    if (id === 'talk-to-me') { setOverlay('assistant'); return; }
    if (!windowNames[id]) return;
    setOverlay(null);
    setMinimizedWindows(previous => previous.filter(item => item !== id));
    setActiveWindows(previous => [...previous.filter(item => item !== id), id]);
  }, []);
  const closeWindow = id => {
    setActiveWindows(previous => previous.filter(item => item !== id));
    setMinimizedWindows(previous => previous.filter(item => item !== id));
  };
  const minimizeWindow = id => {
    setMinimizedWindows(previous => previous.includes(id) ? previous : [...previous, id]);
    requestAnimationFrame(() => {
      [...document.querySelectorAll('.window-switcher button')].find(button => button.getAttribute('aria-label') === `Restore ${windowNames[id]}`)?.focus({ preventScroll: true });
    });
  };
  const showHome = () => {
    setOverlay(null);
    setMinimizedWindows([...activeWindows]);
    requestAnimationFrame(() => document.getElementById('main-content')?.focus());
  };
  useConversationClientTool('open_window', params => {
    const names = { 'work ex': 'work-ex', 'work experience': 'work-ex', workex: 'work-ex', 'my tech': 'my-tech', tech: 'my-tech', 'my niche': 'my-niche', niche: 'my-niche', 'my sound': 'my-sound', sound: 'my-sound', 'my library': 'my-library', library: 'my-library', 'about me': 'about' };
    const name = params?.window_name?.toLowerCase().trim();
    if (name) toggleWindow(names[name] || name);
  });

  return <MotionConfig reducedMotion="user"><div ref={constraintsRef} className={`desktop-root ${minimizedWindows.length ? 'has-minimized-windows' : ''}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <Atmosphere paused={motionPaused || reduceMotion} />
    <TopNavbar activeWindowId={currentActiveWindow === 'desktop' ? null : currentActiveWindow} onHome={showHome} onOpenWindow={toggleWindow} onToggleSearch={() => setOverlay('search')} onContact={() => setOverlay('email')} onHelp={() => setOverlay('help')} isDarkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(previous => !previous)} motionPaused={motionPaused} reducedMotion={reduceMotion} onToggleMotion={() => setMotionPaused(previous => !previous)} />
    <Home onOpenWindow={toggleWindow} onContact={() => setOverlay('email')} onSearch={() => setOverlay('search')} activeWindows={activeWindows} minimizedWindows={minimizedWindows} />
    <AnimatePresence>{activeWindows.map((id, index) => <WindowModal key={id} id={id} isMinimized={minimizedWindows.includes(id)} onClose={() => closeWindow(id)} onMinimize={() => minimizeWindow(id)} zIndex={100 + index} isActive={currentActiveWindow === id} onFocus={() => toggleWindow(id)} constraintsRef={constraintsRef} onOpenWindow={toggleWindow} />)}</AnimatePresence>
    {minimizedWindows.length > 0 && <nav className="window-switcher" aria-label="Minimized windows">{minimizedWindows.map(id => <div className="window-task" key={id}><button onClick={() => toggleWindow(id)} aria-label={`Restore ${windowNames[id]}`}><span className="task-dot" />{windowNames[id]}<span className="task-minimized">—</span></button><button className="task-close" aria-label={`Close ${windowNames[id]}`} onClick={() => closeWindow(id)}><X size={11} /></button></div>)}</nav>}
    <Dock>
      <DockIcon icon={<img src={memojiImg} alt="" />} label="About Me" onClick={() => toggleWindow('about')} isActive={activeWindows.includes('about')} />
      <DockIcon icon={<FileText />} variant="experience" label="Experience" onClick={() => toggleWindow('work-ex')} isActive={activeWindows.includes('work-ex')} />
      <span className="dock-divider" aria-hidden="true" />
      <DockIcon icon={<Globe />} variant="socials" label="Socials" onClick={() => setOverlay('socials')} isActive={overlay === 'socials'} />
      <DockIcon icon={<Mail />} variant="mail" label="Email" onClick={() => setOverlay('email')} isActive={overlay === 'email'} />
      <span className="dock-divider" aria-hidden="true" />
      <DockIcon icon={<img src="/homepage/aiicon.svg" alt="" />} label="Orb" onClick={() => setOverlay('assistant')} isActive={overlay === 'assistant'} />
    </Dock>
    <SpotlightSearch isOpen={overlay === 'search'} onClose={() => setOverlay(null)} onSelect={toggleWindow} />
    <SocialsDrawer isOpen={overlay === 'socials'} onClose={() => setOverlay(null)} />
    <EmailModal isOpen={overlay === 'email'} onClose={() => setOverlay(null)} />
    {overlay === 'help' && <HelpModal activeWindowId={currentActiveWindow === 'desktop' ? null : currentActiveWindow} onClose={() => setOverlay(null)} />}
    <AIOrbOverlay isOpen={overlay === 'assistant'} onClose={() => setOverlay(null)} currentActiveWindow={currentActiveWindow} />
  </div></MotionConfig>;
}
