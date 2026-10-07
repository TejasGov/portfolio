import { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, MotionConfig, useReducedMotion } from 'framer-motion';
import { Mail, Globe, Terminal, Sparkles, Sun, Moon, Pause, Play, Grid2X2, X } from 'lucide-react';
import { useConversationClientTool } from '@elevenlabs/react';
import Home from './components/desktop/Home';
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
  const [isDarkMode, setIsDarkMode] = useState(() => storedPreference('tg-theme', 'dark') !== 'light');
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
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
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
  const minimizeWindow = id => setMinimizedWindows(previous => previous.includes(id) ? previous : [...previous, id]);
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

  return <MotionConfig reducedMotion="user"><div ref={constraintsRef} className="desktop-root">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <Atmosphere paused={motionPaused || reduceMotion} />
    <TopNavbar onHome={showHome} onOpenWindow={toggleWindow} onToggleSearch={() => setOverlay('search')} onContact={() => setOverlay('email')} />
    <Home onOpenWindow={toggleWindow} onContact={() => setOverlay('email')} activeWindows={activeWindows} minimizedWindows={minimizedWindows} />
    <AnimatePresence>{activeWindows.map((id, index) => minimizedWindows.includes(id) ? null : <WindowModal key={id} id={id} onClose={() => closeWindow(id)} onMinimize={() => minimizeWindow(id)} zIndex={100 + index} isActive={currentActiveWindow === id} onFocus={() => toggleWindow(id)} constraintsRef={constraintsRef} onOpenWindow={toggleWindow} />)}</AnimatePresence>
    {activeWindows.length > 0 && <nav className="window-switcher" aria-label="Open windows">{activeWindows.map(id => <div className="window-task" key={id}><button className={currentActiveWindow === id ? 'is-active' : ''} onClick={() => toggleWindow(id)} aria-label={`${minimizedWindows.includes(id) ? 'Restore' : 'Show'} ${windowNames[id]}`}><span className="task-dot" />{windowNames[id]}{minimizedWindows.includes(id) && <span className="task-minimized">—</span>}</button><button className="task-close" aria-label={`Close ${windowNames[id]}`} onClick={() => closeWindow(id)}><X size={11} /></button></div>)}</nav>}
    <Dock>
      <DockIcon icon={<Grid2X2 />} label="Home" onClick={showHome} isActive={!visibleWindows.length && !overlay} />
      <DockIcon icon={<Terminal />} label="Terminal" onClick={() => toggleWindow('terminal')} isActive={currentActiveWindow === 'terminal'} />
      <DockIcon icon={<Globe />} label="Elsewhere" onClick={() => setOverlay('socials')} isActive={overlay === 'socials'} />
      <DockIcon icon={<Mail />} label="Contact" onClick={() => setOverlay('email')} isActive={overlay === 'email'} />
      <span className="dock-divider" aria-hidden="true" />
      <DockIcon icon={<Sparkles />} label="Ask Orb" onClick={() => setOverlay('assistant')} isActive={overlay === 'assistant'} />
      <DockIcon icon={isDarkMode ? <Sun /> : <Moon />} label={isDarkMode ? 'Light' : 'Dark'} ariaLabel={`Switch to ${isDarkMode ? 'light' : 'dark'} theme`} onClick={() => setIsDarkMode(previous => !previous)} />
      <DockIcon icon={motionPaused || reduceMotion ? <Play /> : <Pause />} label={reduceMotion ? 'Still' : motionPaused ? 'Play' : 'Pause'} ariaLabel={reduceMotion ? 'Reduced motion enabled' : motionPaused ? 'Play background video' : 'Pause background video'} pressed={Boolean(motionPaused || reduceMotion)} onClick={() => { if (!reduceMotion) setMotionPaused(previous => !previous); }} />
    </Dock>
    <button className="workspace-help" aria-label="How to explore this portfolio" onClick={() => setOverlay('help')}>?</button>
    <SpotlightSearch isOpen={overlay === 'search'} onClose={() => setOverlay(null)} onSelect={toggleWindow} />
    <SocialsDrawer isOpen={overlay === 'socials'} onClose={() => setOverlay(null)} />
    <EmailModal isOpen={overlay === 'email'} onClose={() => setOverlay(null)} />
    {overlay === 'help' && <HelpModal activeWindowId={currentActiveWindow} onClose={() => setOverlay(null)} />}
    <AIOrbOverlay isOpen={overlay === 'assistant'} onClose={() => setOverlay(null)} currentActiveWindow={currentActiveWindow} />
  </div></MotionConfig>;
}
