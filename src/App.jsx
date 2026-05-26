import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, FileText, Globe, Mic } from 'lucide-react';

import { desktopItems, memojiImg } from './data';

import BootScreen from './components/overlays/BootScreen';
import DesktopClock from './components/desktop/DesktopClock';
import Dock, { DockIcon } from './components/desktop/Dock';
import SocialsDrawer from './components/overlays/SocialsDrawer';
import HelpModal from './components/overlays/HelpModal';
import SpotlightSearch from './components/overlays/SpotlightSearch';
import EmailModal from './components/overlays/EmailModal';
import WindowModal from './components/windows/WindowModal';
import TopNavbar from './components/desktop/TopNavbar';

export default function App() {
  const [activeWindows, setActiveWindows] = useState([]);
  const [minimizedWindows, setMinimizedWindows] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSocialsOpen, setIsSocialsOpen] = useState(false);
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showBoot, setShowBoot] = useState(true);
  const constraintsRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(prefersDark);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const toggleWindow = (id) => {
    if (minimizedWindows.includes(id)) {
      // Restore from minimized
      setMinimizedWindows(prev => prev.filter(wId => wId !== id));
      setActiveWindows(prev => [...prev.filter(wId => wId !== id), id]); // bring to front
    } else if (activeWindows.includes(id)) {
      // Bring to front
      setActiveWindows(prev => [...prev.filter(wId => wId !== id), id]);
    } else {
      // Open new
      setActiveWindows(prev => [...prev, id]);
    }
  };

  const closeWindow = (id) => {
    setActiveWindows(prev => prev.filter(wId => wId !== id));
    setMinimizedWindows(prev => prev.filter(wId => wId !== id));
  };

  const minimizeWindow = (id) => {
    setMinimizedWindows(prev => [...prev, id]);
  };

  const handleSearchSelect = (id) => {
    setIsSearchOpen(false);
    toggleWindow(id);
  };

  return (
    <>
      <AnimatePresence>
        {showBoot && <BootScreen onComplete={() => setShowBoot(false)} />}
      </AnimatePresence>

      <div ref={constraintsRef} style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
        <div className="desktop-bg" />

        {/* Top Navbar */}
        <TopNavbar
          activeWindowId={activeWindows.length > 0 && !minimizedWindows.includes(activeWindows[activeWindows.length - 1]) ? activeWindows[activeWindows.length - 1] : null}
          onToggleHelp={() => setIsHelpOpen(true)}
          toggleTheme={toggleTheme}
          isDarkMode={isDarkMode}
          onToggleSearch={() => setIsSearchOpen(true)}
          onOpenTerminal={() => toggleWindow('terminal')}
          onOpenBlog={() => toggleWindow('blog')}
        />

        {/* Spotlight Search */}
        <AnimatePresence>
          {isSearchOpen && <SpotlightSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onSelect={handleSearchSelect} />}
        </AnimatePresence>

        {/* Help Modal */}
        <AnimatePresence>
          {isHelpOpen && <HelpModal activeWindowId={activeWindows.length > 0 && !minimizedWindows.includes(activeWindows[activeWindows.length - 1]) ? activeWindows[activeWindows.length - 1] : null} onClose={() => setIsHelpOpen(false)} />}
        </AnimatePresence>

        {/* Desktop Widgets */}
        <DesktopClock />

        {/* Desktop Folders */}
        {desktopItems.map((item) => (
          <motion.div
            key={item.id}
            className="desktop-icon"
            style={{ position: 'absolute', left: item.x, top: item.y, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => toggleWindow(item.id)}
          >
            {/* Simple MacOS-like Folder Icon shape using CSS */}
            <div style={{ width: '80px', height: '65px', borderRadius: '8px', background: item.color, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '-8px', left: '0', width: '35px', height: '15px', background: item.color, borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }} />
            </div>
            <span style={{ color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.5)', fontSize: '14px', fontWeight: '500' }}>
              {item.title}
            </span>
          </motion.div>
        ))}

        {/* Window Modals */}
        <AnimatePresence>
          {activeWindows.map((windowId, index) => {
            if (minimizedWindows.includes(windowId)) return null; // Hide if minimized
            return (
              <WindowModal
                key={windowId}
                id={windowId}
                onClose={() => closeWindow(windowId)}
                onMinimize={() => minimizeWindow(windowId)}
                zIndex={100 + index}
                onFocus={() => toggleWindow(windowId)}
                constraintsRef={constraintsRef}
                onOpenWindow={toggleWindow}
              />
            );
          })}
        </AnimatePresence>

        {/* Socials Drawer */}
        <SocialsDrawer isOpen={isSocialsOpen} onClose={() => setIsSocialsOpen(false)} />

        {/* Email Modal */}
        <EmailModal isOpen={isEmailOpen} onClose={() => setIsEmailOpen(false)} />

        <Dock>
          <DockIcon
            icon={<img src={memojiImg} alt="Memoji" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            label="About Me"
            isActive={activeWindows.includes('about')}
            onClick={() => toggleWindow('about')}
            hoverColor="rgba(255, 255, 255, 0.3)"
          />
          <div style={{ width: '1px', background: 'var(--timeline-line)', margin: '0 4px' }} />
          <DockIcon icon={<FileText color="var(--dock-icon-color)" />} label="Resume" hoverColor="var(--dock-item-hover)" />
          <DockIcon
            icon={<Globe color="var(--dock-icon-color)" />}
            label="Socials"
            hoverColor="var(--dock-item-hover)"
            onClick={() => setIsSocialsOpen(!isSocialsOpen)}
            isActive={isSocialsOpen}
          />
          <DockIcon 
            icon={<Mail color="var(--dock-icon-color)" />} 
            label="Email" 
            hoverColor="var(--dock-item-hover)" 
            onClick={() => setIsEmailOpen(!isEmailOpen)}
            isActive={isEmailOpen}
          />
          <div style={{ width: '1px', background: 'var(--timeline-line)', margin: '0 4px' }} />
          <DockIcon
            icon={<img src="/homepage/aiicon.svg" alt="Orb" style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scale(1.3)' }} />}
            label="Orb"
            onClick={() => { }}
            hoverColor="var(--dock-item-hover)"
          />
        </Dock>
      </div>
    </>
  );
}
