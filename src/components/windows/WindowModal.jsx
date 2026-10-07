import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { motion, useDragControls, useAnimation, useReducedMotion } from 'framer-motion';
import { photographyData } from '../../data';
import useIsPhone from '../../hooks/useIsPhone';
import { WindowActivityContext } from '../../contexts/WindowActivity';

// Lazy load window contents to optimize bundle size
const MorphingPhotoGallery = lazy(() => import('./MorphingPhotoGallery'));
const TerminalWindow = lazy(() => import('./TerminalWindow'));
const WorkExperience = lazy(() => import('./WorkExperience'));
const ProjectsWindow = lazy(() => import('./ProjectsWindow'));
const MusicWindow = lazy(() => import('./MusicWindow'));
const BlogWindow = lazy(() => import('./BlogWindow'));
const MyNicheWindow = lazy(() => import('./MyNicheWindow'));
const MyTechWindow = lazy(() => import('./MyTechWindow'));
const AboutWindow = lazy(() => import('./AboutWindow'));
const TheLibrary = lazy(() => import('./TheLibrary'));
import './WindowModal.css';

// A modal overlay above the desktop owns Escape until it is dismissed.
function visibleDialogLayer(element) {
  if (element.getAttribute('aria-hidden') === 'true' || !element.getClientRects().length || getComputedStyle(element).visibility === 'hidden') return -1;
  const bounds = element.getBoundingClientRect();
  let left = Math.max(0, bounds.left);
  let right = Math.min(window.innerWidth, bounds.right);
  let top = Math.max(0, bounds.top);
  let bottom = Math.min(window.innerHeight, bounds.bottom);
  let layer = 0;
  for (let node = element; node && node !== document.body; node = node.parentElement) {
    const style = getComputedStyle(node);
    const value = Number.parseInt(style.zIndex, 10);
    if (Number.isFinite(value)) layer = Math.max(layer, value);
    if (node !== element) {
      const clip = node.getBoundingClientRect();
      if (/(hidden|clip|auto|scroll)/.test(style.overflowX)) {
        left = Math.max(left, clip.left);
        right = Math.min(right, clip.right);
      }
      if (/(hidden|clip|auto|scroll)/.test(style.overflowY)) {
        top = Math.max(top, clip.top);
        bottom = Math.min(bottom, clip.bottom);
      }
    }
  }
  return right > left && bottom > top ? layer : -1;
}

export default function WindowModal({ id, onClose, onMinimize, zIndex, onFocus, constraintsRef, onOpenWindow, isActive = true, isMinimized = false }) {
  const isPhone = useIsPhone();
  const reduceMotion = useReducedMotion();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFilled, setIsFilled] = useState(false);
  const [isConcealed, setIsConcealed] = useState(isMinimized);
  const [viewMode, setViewMode] = useState(id === 'blog' ? 'pages' : (id === 'photography' ? 'grid' : (id === 'my-niche' ? 'movies' : 'tl')));
  const controls = useDragControls();
  const animControls = useAnimation();
  const windowRef = useRef(null);
  const previousFocusRef = useRef(null);
  const wasMinimized = useRef(isMinimized);
  const restoreFocusRef = useRef(false);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  useEffect(() => {
    const frame = windowRef.current;
    previousFocusRef.current = document.activeElement;
    const request = requestAnimationFrame(() => {
      if (isActiveRef.current) frame?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(request);
      const previous = previousFocusRef.current;
      // Closing a background window must not steal focus from the active one.
      if (previous?.isConnected && (frame?.contains(document.activeElement) || document.activeElement === document.body)) {
        previous.focus?.({ preventScroll: true });
      }
    };
  }, []);

  useEffect(() => {
    if (!isActive) return;
    const handleEscape = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
      if (document.querySelector('dialog[open]')) return;
      const frame = windowRef.current;
      if (!frame) return;
      const layer = visibleDialogLayer(frame);
      const higherDialog = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"], [data-overlay]'))
        .some(dialog => dialog !== frame && visibleDialogLayer(dialog) >= layer);
      if (higherDialog) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isActive, onClose]);

  useEffect(() => {
    if (!isMinimized) setIsConcealed(false);
    animControls.start({ opacity: isMinimized ? 0 : 1, scale: isMinimized && !reduceMotion ? 0.9 : 1, transition: reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34, mass: 0.8 } });
    if (!isMinimized && wasMinimized.current) restoreFocusRef.current = true;
    wasMinimized.current = isMinimized;
  }, [animControls, reduceMotion, isMinimized]);

  useEffect(() => {
    if (isMinimized || isConcealed || !restoreFocusRef.current) return;
    const request = requestAnimationFrame(() => {
      if (isActiveRef.current && !document.querySelector('dialog[open]')) windowRef.current?.focus({ preventScroll: true });
      restoreFocusRef.current = false;
    });
    return () => cancelAnimationFrame(request);
  }, [isMinimized, isConcealed]);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.id === id) {
        if (e.detail.cmd === 'minimize') {
          onMinimize();
        } else if (e.detail.cmd === 'close') {
          onClose();
        } else if (e.detail.cmd === 'zoom') {
          setIsMaximized(prev => !prev);
          setIsFilled(false);
        } else if (e.detail.cmd === 'fill') {
          setIsFilled(prev => !prev);
          setIsMaximized(false);
        } else if (e.detail.cmd === 'center') {
          animControls.start({ x: 0, y: 0, transition: { duration: reduceMotion ? 0 : 0.2 } });
        }
      }
    };
    window.addEventListener('window-command', handler);
    return () => window.removeEventListener('window-command', handler);
  }, [id, onMinimize, onClose, animControls, reduceMotion]);

  let title = "";
  let content = null;

  if (id === 'projects') {
    title = "Projects";
    content = <ProjectsWindow />;
  } else if (id === 'work-ex') {
    title = "Work Experience";
    content = <WorkExperience viewMode={viewMode} />;
  } else if (id === 'photography') {
    title = "Photography";
    content = <MorphingPhotoGallery photos={photographyData} layout={viewMode} windowRef={windowRef} />;
  } else if (id === 'about') {
    title = "About Me";
    content = <AboutWindow />;
  } else if (id === 'terminal') {
    title = "Terminal";
    content = <TerminalWindow onOpenWindow={onOpenWindow} />;
  } else if (id === 'certificates') {
    title = "Certificates";
    content = <div style={{ color: 'var(--text-main)', opacity: 0.6, textAlign: 'center', marginTop: '40px' }}>Certificates module loading...</div>;
  } else if (id === 'talk-to-me') {
    title = "Talk to Me";
    content = <div style={{ color: 'var(--text-main)', opacity: 0.6, textAlign: 'center', marginTop: '40px' }}>Voice AI engine connecting...</div>;
  } else if (id === 'contact') {
    title = "Contact Me";
    content = <div style={{ color: 'var(--text-main)', opacity: 0.6, textAlign: 'center', marginTop: '40px' }}>Contact forms loading...</div>;
  } else if (id === 'my-tech') {
    title = "My Tech";
    content = <MyTechWindow />;
  } else if (id === 'my-niche') {
    title = "My Niche";
    content = <MyNicheWindow viewMode={viewMode} />;
  } else if (id === 'my-sound') {
    title = "My Sound";
    content = <MusicWindow />;
  } else if (id === 'blog') {
    title = "Blog";
    content = <BlogWindow viewMode={viewMode} />;
  } else if (id === 'my-library') {
    title = "My Library";
    content = <TheLibrary />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.97 }}
      animate={animControls}
      onAnimationComplete={() => setIsConcealed(isMinimized)}
      exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.985, y: reduceMotion ? 0 : 10, transition: { duration: reduceMotion ? 0 : 0.15 } }}
      drag={!isPhone && !isMaximized && !isFilled}
      dragListener={false}
      dragControls={controls}
      dragConstraints={constraintsRef}
      dragMomentum={false}
      onPointerDown={() => { if (!isActive) onFocus?.(); }}
      onFocus={() => { if (!isActive) onFocus?.(); }}
      role="dialog"
      aria-hidden={isMinimized || undefined}
      inert={isMinimized ? '' : undefined}
      aria-labelledby={`window-title-${id}`}
      tabIndex={-1}
      data-window={id}
      className={`glass-panel window-modal ${isActive ? 'is-active' : ''} ${isMaximized ? 'maximized' : ''} ${isFilled ? 'filled' : ''}`}
      style={{ zIndex, visibility: isConcealed ? 'hidden' : undefined, pointerEvents: isMinimized ? 'none' : undefined, transformOrigin: '50% 85%' }}
      ref={windowRef}
    >
      <div 
        className="window-header" 
        onPointerDown={(e) => {
          if (e.target.closest('button')) return;
          if (!isPhone && !isMaximized && !isFilled) {
            controls.start(e);
          }
          if (!isActive) onFocus?.();
        }}
        onDoubleClick={(e) => { if (!isPhone && !e.target.closest('button')) { setIsMaximized(prev => !prev); setIsFilled(false); } }}
      >
        <div className="traffic-lights" onPointerDown={e => e.stopPropagation()}>
          <button type="button" className="traffic-light close" aria-label={`Close ${title}`} title="Close (Esc)" onClick={onClose}>
            <svg aria-hidden="true" viewBox="0 0 16 16"><path d="m4 4 8 8M12 4l-8 8" /></svg>
          </button>
          <button type="button" className="traffic-light minimize" aria-label={`Minimize ${title}`} title="Minimize" onClick={onMinimize}>
            <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M4 8h8" /></svg>
          </button>
          <button type="button" className="traffic-light maximize" aria-label={`${isMaximized || isFilled ? 'Restore' : 'Expand'} ${title}`} aria-pressed={isMaximized || isFilled} title={isMaximized || isFilled ? 'Restore size' : 'Expand'} onClick={() => { setIsMaximized(prev => isFilled ? false : !prev); setIsFilled(false); }}>
            <svg aria-hidden="true" viewBox="0 0 16 16"><path d={isMaximized || isFilled ? 'M6 3v3H3m10 4h-3v3M6 6 3 3m7 7 3 3' : 'M9 3h4v4M7 13H3V9m10-6L9 7m-6 6 4-4'} /></svg>
          </button>
        </div>
        <h2 id={`window-title-${id}`} className="window-title">{title}</h2>
        {(id === 'work-ex' || id === 'blog' || id === 'photography' || id === 'my-niche') ? (
          <div className="switcher" role="group" aria-label={`${title} view`} onPointerDown={e => e.stopPropagation()}>
            {id === 'work-ex' ? (
              <>
                <button type="button" aria-label="Timeline view" aria-pressed={viewMode === 'tl'} className={`sw ${viewMode === 'tl' ? 'on' : ''}`} onClick={() => setViewMode('tl')}>
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" style={{ marginRight: '4px', verticalAlign: '-1.5px', display: 'inline-block' }}>
                    <path d="M12 5v14M5 12h14" />
                  </svg> <span className="sw-text">Timeline</span>
                </button>
                <button type="button" aria-label="List view" aria-pressed={viewMode === 'st'} className={`sw ${viewMode === 'st' ? 'on' : ''}`} onClick={() => setViewMode('st')}>
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" style={{ marginRight: '4px', verticalAlign: '-1.5px', display: 'inline-block' }}>
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg> <span className="sw-text">List</span>
                </button>
              </>
            ) : id === 'my-niche' ? (
              <>
                <button type="button" aria-label="Movies view" aria-pressed={viewMode === 'movies'} className={`sw ${viewMode === 'movies' ? 'on' : ''}`} onClick={() => setViewMode('movies')}>
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" style={{ marginRight: '4px', verticalAlign: '-1.5px', display: 'inline-block' }}>
                    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                    <line x1="7" y1="2" x2="7" y2="22"></line>
                    <line x1="17" y1="2" x2="17" y2="22"></line>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <line x1="2" y1="7" x2="7" y2="7"></line>
                    <line x1="2" y1="17" x2="7" y2="17"></line>
                    <line x1="17" y1="17" x2="22" y2="17"></line>
                    <line x1="17" y1="7" x2="22" y2="7"></line>
                  </svg> <span className="sw-text">Movies</span>
                </button>
                <button type="button" aria-label="Football view" aria-pressed={viewMode === 'football'} className={`sw ${viewMode === 'football' ? 'on' : ''}`} onClick={() => setViewMode('football')}>
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" style={{ marginRight: '4px', verticalAlign: '-1.5px', display: 'inline-block' }}>
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 8l3.5 2.5-1.3 4.1H9.8L8.5 10.5 12 8z"></path>
                    <path d="M12 8V4.5M15.5 10.5l3.3-1M14.2 14.6l2 3.4M9.8 14.6l-2 3.4M8.5 10.5l-3.3-1"></path>
                  </svg> <span className="sw-text">Football</span>
                </button>
                <button type="button" aria-label="Marvel view" aria-pressed={viewMode === 'marvel'} className={`sw ${viewMode === 'marvel' ? 'on' : ''}`} onClick={() => setViewMode('marvel')}>
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" style={{ marginRight: '4px', verticalAlign: '-1.5px', display: 'inline-block' }}>
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                  </svg> <span className="sw-text">Marvel</span>
                </button>
              </>
            ) : id === 'blog' ? (
              <>
                <button type="button" aria-label="Pages view" aria-pressed={viewMode === 'pages'} className={`sw ${viewMode === 'pages' ? 'on' : ''}`} onClick={() => setViewMode('pages')}>
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" style={{ marginRight: '4px', verticalAlign: '-1.5px', display: 'inline-block' }}>
                    <path d="M12 20h9M3 20h4M3 12h18M3 4h18" />
                  </svg> <span className="sw-text">Pages</span>
                </button>
                <button type="button" aria-label="Articles view" aria-pressed={viewMode === 'articles'} className={`sw ${viewMode === 'articles' ? 'on' : ''}`} onClick={() => setViewMode('articles')}>
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" style={{ marginRight: '4px', verticalAlign: '-1.5px', display: 'inline-block' }}>
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z" />
                  </svg> <span className="sw-text">Articles</span>
                </button>
              </>
            ) : (
              <>
                <button type="button" aria-label="Stack view" aria-pressed={viewMode === 'stack'} className={`sw ${viewMode === 'stack' ? 'on' : ''}`} onClick={() => setViewMode('stack')}>
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" style={{ marginRight: '4px', verticalAlign: '-1.5px', display: 'inline-block' }}>
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polygon points="2 17 12 22 22 17" />
                    <polygon points="2 12 12 17 22 12" />
                  </svg> <span className="sw-text">Stack</span>
                </button>
                <button type="button" aria-label="Grid view" aria-pressed={viewMode === 'grid'} className={`sw ${viewMode === 'grid' ? 'on' : ''}`} onClick={() => setViewMode('grid')}>
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" style={{ marginRight: '4px', verticalAlign: '-1.5px', display: 'inline-block' }}>
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg> <span className="sw-text">Grid</span>
                </button>
                <button type="button" aria-label="List view" aria-pressed={viewMode === 'list'} className={`sw ${viewMode === 'list' ? 'on' : ''}`} onClick={() => setViewMode('list')}>
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" style={{ marginRight: '4px', verticalAlign: '-1.5px', display: 'inline-block' }}>
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg> <span className="sw-text">List</span>
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
      
      <div 
        className="window-content" 
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: (id === 'terminal' || id === 'work-ex' || id === 'projects' || id === 'my-sound' || id === 'blog' || id === 'my-niche' || id === 'about' || id === 'my-library') ? '0' : '24px',
          padding: (id === 'terminal' || id === 'work-ex' || id === 'projects' || id === 'my-sound' || id === 'blog' || id === 'my-niche' || id === 'about' || id === 'my-library') ? '0' : undefined,
          overflow: id === 'about' ? 'auto' : (id === 'terminal' || id === 'work-ex' || id === 'projects' || id === 'my-sound' || id === 'blog' || id === 'my-niche' || id === 'about' || id === 'my-library') ? 'hidden' : undefined,
          cursor: 'auto',
          touchAction: 'auto'
        }} 
      >
        <Suspense fallback={
          <div className="window-loading" role="status">
            <div className="spinner" aria-hidden="true" />
            <span>Opening {title.toLowerCase()}…</span>
          </div>
        }>
          <WindowActivityContext.Provider value={!isMinimized}>{content}</WindowActivityContext.Provider>
        </Suspense>
      </div>
    </motion.div>
  );
}
