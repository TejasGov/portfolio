import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Search, SlidersHorizontal, Volume2 } from 'lucide-react';
import './TopNavbar.css';

function MenuItem({ label, shortcut, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div 
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: '6px',
        background: hovered ? 'var(--badge-bg)' : 'transparent',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
    >
      <span>{label}</span>
      {shortcut && <span style={{ opacity: 0.5, fontSize: '12px' }}>{shortcut}</span>}
    </div>
  );
}

export default function TopNavbar({ activeWindowId, onToggleHelp, toggleTheme, isDarkMode, onToggleSearch, onOpenTerminal, onOpenBlog }) {
  const [isWindowMenuOpen, setIsWindowMenuOpen] = useState(false);
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(false);
  const [volume, setVolume] = useState(50);

  // Sync volume to all existing and future audio/video elements
  React.useEffect(() => {
    const applyVolume = (node) => {
      if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') {
        node.volume = volume / 100;
      }
      if (node.querySelectorAll) {
        node.querySelectorAll('audio, video').forEach(el => {
          el.volume = volume / 100;
        });
      }
    };

    // Apply to existing elements
    applyVolume(document.body);

    // Observer to catch dynamically added audio/video elements
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) applyVolume(node);
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    
    // Make volume available globally if any custom component needs to read it
    window.portfolioGlobalVolume = volume / 100;

    return () => observer.disconnect();
  }, [volume]);

  let windowTitle = "Tejas OS";
  if (activeWindowId === 'projects') windowTitle = "Projects";
  else if (activeWindowId === 'work-ex') windowTitle = "Work Experience";
  else if (activeWindowId === 'photography') windowTitle = "Photography";
  else if (activeWindowId === 'about') windowTitle = "About Me";
  else if (activeWindowId === 'my-tech') windowTitle = "My Tech";
  else if (activeWindowId === 'my-niche') windowTitle = "My Niche";
  else if (activeWindowId === 'my-sound') windowTitle = "My Sound";
  else if (activeWindowId === 'blog') windowTitle = "Blog";

  const dispatchCommand = (cmd) => {
    window.dispatchEvent(new CustomEvent('window-command', { detail: { id: activeWindowId, cmd } }));
    setIsWindowMenuOpen(false);
  };

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0,
      height: '28px',
      background: 'var(--navbar-bg)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--navbar-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      color: 'var(--navbar-text)',
      fontSize: '13px',
      fontWeight: '500',
      zIndex: 2000,
      userSelect: 'none'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontFamily: "'Dancing Script', cursive", fontSize: '20px', fontWeight: '700', marginRight: '4px', cursor: 'default' }}>TG</span>
        <span style={{ fontWeight: '700', cursor: 'default' }}>{windowTitle}</span>
        <div style={{ display: 'flex', gap: '16px', opacity: 0.8 }}>
          <span style={{ cursor: 'pointer' }} className="nav-item-hover" onClick={onOpenTerminal}>Terminal</span>
          <div style={{ position: 'relative' }}>
            <span 
              style={{ cursor: activeWindowId ? 'pointer' : 'default', opacity: activeWindowId ? 1 : 0.5 }} 
              className={activeWindowId ? "nav-item-hover" : ""}
              onClick={() => activeWindowId && setIsWindowMenuOpen(!isWindowMenuOpen)}
            >
              Window
            </span>
            <AnimatePresence>
              {isWindowMenuOpen && activeWindowId && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  style={{
                    position: 'absolute',
                    top: '24px',
                    left: '-10px',
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid var(--glass-border)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    borderRadius: '8px',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    minWidth: '150px'
                  }}
                >
                  <MenuItem label="Close" onClick={() => dispatchCommand('close')} />
                  <MenuItem label="Minimize" onClick={() => dispatchCommand('minimize')} />
                  <MenuItem label="Fill" onClick={() => dispatchCommand('fill')} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <span
            style={{ cursor: 'pointer' }}
            className="nav-item-hover"
            onClick={onOpenBlog}
          >Blog</span>
          <span style={{ cursor: 'pointer' }} className="nav-item-hover" onClick={onToggleHelp}>Help</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: 0.8, position: 'relative' }}>
          <div onClick={toggleTheme} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </div>
          <Search size={16} style={{ cursor: 'pointer' }} onClick={onToggleSearch} />
          <div style={{ position: 'relative' }}>
            <SlidersHorizontal 
              size={14} 
              style={{ cursor: 'pointer' }} 
              onClick={() => setIsControlPanelOpen(!isControlPanelOpen)} 
            />
            <AnimatePresence>
              {isControlPanelOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  style={{
                    position: 'absolute',
                    top: '24px',
                    right: '-10px',
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid var(--glass-border)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    minWidth: '200px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-main)' }}>
                    <Volume2 size={16} />
                    <input 
                      type="range" 
                      min="0" max="100" 
                      value={volume} 
                      onChange={(e) => setVolume(e.target.value)} 
                      style={{ flex: 1, cursor: 'pointer' }} 
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
