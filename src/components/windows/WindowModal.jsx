import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { motion, useDragControls, useAnimation } from 'framer-motion';
import { photographyData } from '../../data';
import useIsPhone from '../../hooks/useIsPhone';

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

const WINDOW_SR_DESCRIPTIONS = {
  projects: "Projects Window: Documents key engineering projects built by Tejas Govind. Highlights include Smash Cricket (Computer Vision gesture game using OpenCV and MediaPipe), CogniFlow/CogniFight (Multimodal ML pipeline predicting ADHD task abandonment using LLaMA-3, YOLOv8, and XGBoost), and Revere (Wearable AI smart glasses for Alzheimer's care utilizing Raspberry Pi Zero 2 W and Gemini 2.0 Flash).",
  'work-ex': "Work Experience Window: Interactive timeline detailing software engineering internships, research assistantships, and technical leadership roles. Demonstrates full-stack development, cloud architecture on GCP, performance optimization, and collaborative system design.",
  photography: "Photography Gallery Window: Visual showcase of photography projects rendered in custom morphing glass grids, dynamic layout toggles (Stack, Grid, List), and responsive image pipelines.",
  about: "About Me Window: Interactive profile detailing Tejas Govind's background as an undergraduate CS major at the University at Buffalo (Class of May 2027), core technical stack (React, Three.js, Python, OpenCV, XGBoost), personal philosophy, and creative pursuits.",
  terminal: "Terminal Window: Interactive command line emulator supporting custom shell commands (help, projects, skills, contact, clear, bio). Demonstrates system design, keyboard shortcuts, and CLI parsing.",
  'my-tech': "My Tech Window: Interactive hardware and desk setup diagram mapping hot-spotted components (MacBook Pro, Ultra-wide monitor, custom PC build with GPU/CPU specs) with technical descriptions.",
  'my-niche': "My Niche Window: Multimodal media showcase spanning film reviews, sports analytics, and pop culture curation (Marvel MCU tier lists, football analytics, movie database).",
  'my-sound': "My Sound Window: Music player interface showcasing curated soundtracks and sound design projects with audio visualizers.",
  blog: "Blog Window: Technical writing and engineering articles covering AI pipelines, front-end architecture, user experience design, and software trade-offs.",
  'my-library': "My Library Window: Comprehensive repository of books, technical literature, research papers, and software design guides."
};

export default function WindowModal({ id, onClose, onMinimize, zIndex, onFocus, constraintsRef, onOpenWindow }) {
  const isPhone = useIsPhone();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFilled, setIsFilled] = useState(false);
  const [viewMode, setViewMode] = useState(id === 'blog' ? 'pages' : (id === 'photography' ? 'grid' : (id === 'my-niche' ? 'movies' : 'tl')));
  const controls = useDragControls();
  const animControls = useAnimation();
  const windowRef = useRef(null);

  useEffect(() => {
    // Initial entrance animation
    animControls.start({ opacity: 1, scale: 1, x: 0, y: 0, transition: { type: "spring", stiffness: 400, damping: 30 } });
  }, [animControls]);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail.id === id) {
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
          animControls.start({ x: 0, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } });
        }
      }
    };
    window.addEventListener('window-command', handler);
    return () => window.removeEventListener('window-command', handler);
  }, [id, onMinimize, animControls]);

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
      initial={{ opacity: 0, scale: 0.85, y: 30 }}
      animate={animControls}
      exit={{ opacity: 0, scale: 0.85, y: 30 }}
      drag={!isPhone && !isMaximized && !isFilled}
      dragListener={false}
      dragControls={controls}
      dragConstraints={constraintsRef}
      dragMomentum={false}
      onPointerDown={onFocus}
      className={`glass-panel window-modal ${isMaximized ? 'maximized' : ''} ${isFilled ? 'filled' : ''}`}
      style={{ zIndex, position: 'absolute' }}
      ref={windowRef}
    >
      <div 
        className="window-header" 
        style={{ position: 'relative' }}
        onPointerDown={(e) => {
          if (!isPhone && !isMaximized && !isFilled) {
            controls.start(e);
          }
          onFocus();
        }}
        onDoubleClick={() => setIsMaximized(!isMaximized)}
      >
        <div className="traffic-lights">
          <div className="traffic-light close" onClick={(e) => { e.stopPropagation(); onClose(); }}>
            <svg viewBox="0 0 10 10"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </div>
          <div className="traffic-light minimize" onClick={(e) => { e.stopPropagation(); onMinimize(); }}>
            <svg viewBox="0 0 10 10"><path d="M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </div>
          <div className="traffic-light maximize" onClick={(e) => { e.stopPropagation(); setIsMaximized(!isMaximized); }}>
            <svg viewBox="0 0 10 10"><path d="M1.5 8.5L8.5 1.5M1.5 1.5h7v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
          </div>
        </div>
        <div className="window-title" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: '13px', fontWeight: '600', color: 'var(--text-main)', opacity: 0.85, letterSpacing: '0.3px', cursor: 'default' }}>
          {title}
        </div>
        {(id === 'work-ex' || id === 'blog' || id === 'photography' || id === 'my-niche') ? (
          <div className="switcher" onPointerDown={e => e.stopPropagation()} style={{ marginLeft: 'auto', zIndex: 10 }}>
            {id === 'work-ex' ? (
              <>
                <button className={`sw ${viewMode === 'tl' ? 'on' : ''}`} onClick={() => setViewMode('tl')}>
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" style={{ marginRight: '4px', verticalAlign: '-1.5px', display: 'inline-block' }}>
                    <path d="M12 5v14M5 12h14" />
                  </svg> <span className="sw-text">Timeline</span>
                </button>
                <button className={`sw ${viewMode === 'st' ? 'on' : ''}`} onClick={() => setViewMode('st')}>
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" style={{ marginRight: '4px', verticalAlign: '-1.5px', display: 'inline-block' }}>
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg> <span className="sw-text">List</span>
                </button>
              </>
            ) : id === 'my-niche' ? (
              <>
                <button className={`sw ${viewMode === 'movies' ? 'on' : ''}`} onClick={() => setViewMode('movies')}>
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
                <button className={`sw ${viewMode === 'football' ? 'on' : ''}`} onClick={() => setViewMode('football')}>
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" style={{ marginRight: '4px', verticalAlign: '-1.5px', display: 'inline-block' }}>
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 8l3.5 2.5-1.3 4.1H9.8L8.5 10.5 12 8z"></path>
                    <path d="M12 8V4.5M15.5 10.5l3.3-1M14.2 14.6l2 3.4M9.8 14.6l-2 3.4M8.5 10.5l-3.3-1"></path>
                  </svg> <span className="sw-text">Football</span>
                </button>
                <button className={`sw ${viewMode === 'marvel' ? 'on' : ''}`} onClick={() => setViewMode('marvel')}>
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" style={{ marginRight: '4px', verticalAlign: '-1.5px', display: 'inline-block' }}>
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                  </svg> <span className="sw-text">Marvel</span>
                </button>
              </>
            ) : id === 'blog' ? (
              <>
                <button className={`sw ${viewMode === 'pages' ? 'on' : ''}`} onClick={() => setViewMode('pages')}>
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" style={{ marginRight: '4px', verticalAlign: '-1.5px', display: 'inline-block' }}>
                    <path d="M12 20h9M3 20h4M3 12h18M3 4h18" />
                  </svg> <span className="sw-text">Pages</span>
                </button>
                <button className={`sw ${viewMode === 'articles' ? 'on' : ''}`} onClick={() => setViewMode('articles')}>
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" style={{ marginRight: '4px', verticalAlign: '-1.5px', display: 'inline-block' }}>
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z" />
                  </svg> <span className="sw-text">Articles</span>
                </button>
              </>
            ) : (
              <>
                <button className={`sw ${viewMode === 'stack' ? 'on' : ''}`} onClick={() => setViewMode('stack')}>
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" style={{ marginRight: '4px', verticalAlign: '-1.5px', display: 'inline-block' }}>
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polygon points="2 17 12 22 22 17" />
                    <polygon points="2 12 12 17 22 12" />
                  </svg> <span className="sw-text">Stack</span>
                </button>
                <button className={`sw ${viewMode === 'grid' ? 'on' : ''}`} onClick={() => setViewMode('grid')}>
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" style={{ marginRight: '4px', verticalAlign: '-1.5px', display: 'inline-block' }}>
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg> <span className="sw-text">Grid</span>
                </button>
                <button className={`sw ${viewMode === 'list' ? 'on' : ''}`} onClick={() => setViewMode('list')}>
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
        ) : (
          <div style={{ width: '52px', flexShrink: 0, marginLeft: 'auto' }} />
        )}
      </div>
      
      <div 
        className="window-content" 
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: (id === 'terminal' || id === 'work-ex' || id === 'projects' || id === 'my-sound' || id === 'blog' || id === 'my-niche' || id === 'about' || id === 'my-library') ? '0' : '24px',
          padding: (id === 'terminal' || id === 'work-ex' || id === 'projects' || id === 'my-sound' || id === 'blog' || id === 'my-niche' || id === 'about' || id === 'my-library') ? '0' : undefined,
          overflow: (id === 'terminal' || id === 'work-ex' || id === 'projects' || id === 'my-sound' || id === 'blog' || id === 'my-niche' || id === 'about' || id === 'my-library') ? 'hidden' : undefined,
          cursor: 'auto',
          touchAction: 'auto'
        }} 
      >
        <p className="sr-only">
          {WINDOW_SR_DESCRIPTIONS[id] || `${title} application window - Tejas Govind Portfolio OS.`}
        </p>
        <Suspense fallback={
          <div className="window-loading">
            <div className="spinner" />
            <span>Loading...</span>
          </div>
        }>
          {content}
        </Suspense>
      </div>
    </motion.div>
  );
}
