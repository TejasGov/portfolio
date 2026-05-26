import React, { useState, useEffect } from 'react';
import { motion, useDragControls, useAnimation } from 'framer-motion';
import { photographyData, memojiImg } from '../../data';
import MorphingPhotoGallery from './MorphingPhotoGallery';
import TerminalWindow from './TerminalWindow';
import WorkExperience from './WorkExperience';
import ProjectsWindow from './ProjectsWindow';
import MusicWindow from './MusicWindow';
import BlogWindow from './BlogWindow';
import MyNicheWindow from './MyNicheWindow';
import './WindowModal.css';

export default function WindowModal({ id, onClose, onMinimize, zIndex, onFocus, constraintsRef, onOpenWindow }) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFilled, setIsFilled] = useState(false);
  const [viewMode, setViewMode] = useState(id === 'blog' ? 'pages' : (id === 'photography' ? 'grid' : (id === 'my-niche' ? 'movies' : 'tl')));
  const controls = useDragControls();
  const animControls = useAnimation();

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
    content = <MorphingPhotoGallery photos={photographyData} layout={viewMode} />;
  } else if (id === 'about') {
    title = "About Me";
    content = (
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        <img src={memojiImg} alt="Memoji" style={{ width: '120px', height: '120px', borderRadius: '50%', background: 'var(--badge-bg)', border: '1px solid var(--card-border)' }} />
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>Tejas Govind</h1>
          <p style={{ fontSize: '16px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
            Computer Science student at University at Buffalo (Expected May 2027).<br/>
            Passionate about Web Development, Machine Learning, and creating beautiful, intuitive interfaces.
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['React', 'Node.js', 'Python', 'TypeScript', 'MediaPipe', 'YOLOv8', 'Figma'].map(skill => (
              <span key={skill} style={{ padding: '4px 12px', background: 'var(--badge-bg)', border: '1px solid var(--badge-border)', color: 'var(--badge-text)', borderRadius: '16px', fontSize: '12px' }}>{skill}</span>
            ))}
          </div>
        </div>
      </div>
    );
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
    content = (
      <div style={{ color: 'var(--text-main)', textAlign: 'center', marginTop: '40px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🖥️</div>
        <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>My Setup</div>
        <div style={{ opacity: 0.5, fontSize: '14px' }}>The gear I use every day — coming soon.</div>
      </div>
    );
  } else if (id === 'my-niche') {
    title = "My Niche";
    content = <MyNicheWindow viewMode={viewMode} />;
  } else if (id === 'my-sound') {
    title = "My Sound";
    content = <MusicWindow />;
  } else if (id === 'blog') {
    title = "Blog";
    content = <BlogWindow viewMode={viewMode} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 30 }}
      animate={animControls}
      exit={{ opacity: 0, scale: 0.85, y: 30 }}
      drag={!isMaximized && !isFilled}
      dragListener={false}
      dragControls={controls}
      dragConstraints={constraintsRef}
      dragMomentum={false}
      onPointerDown={onFocus}
      className={`glass-panel window-modal ${isMaximized ? 'maximized' : ''} ${isFilled ? 'filled' : ''}`}
      style={{ zIndex, position: 'absolute' }}
    >
      <div 
        className="window-header" 
        style={{ position: 'relative' }}
        onPointerDown={(e) => {
          if (!isMaximized && !isFilled) {
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
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: '13px', fontWeight: '600', color: 'var(--text-main)', opacity: 0.85, letterSpacing: '0.3px', cursor: 'default' }}>
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
                <button className={`sw ${viewMode === 'cars' ? 'on' : ''}`} onClick={() => setViewMode('cars')}>
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" style={{ marginRight: '4px', verticalAlign: '-1.5px', display: 'inline-block' }}>
                    <circle cx="7" cy="17" r="2"></circle>
                    <circle cx="17" cy="17" r="2"></circle>
                    <path d="M5 17H3v-6l2-5h14l2 5v6h-2"></path>
                    <line x1="3" y1="11" x2="21" y2="11"></line>
                  </svg> <span className="sw-text">Cars</span>
                </button>
                <button className={`sw ${viewMode === 'fragrances' ? 'on' : ''}`} onClick={() => setViewMode('fragrances')}>
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" style={{ marginRight: '4px', verticalAlign: '-1.5px', display: 'inline-block' }}>
                    <path d="M10 2v7.31"></path>
                    <path d="M14 9.3V1.99"></path>
                    <path d="M8.5 2h7"></path>
                    <path d="M14 9.3a6.5 6.5 0 1 1-4 0"></path>
                    <line x1="5.52" y1="16" x2="18.48" y2="16"></line>
                  </svg> <span className="sw-text">Fragrances</span>
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
          gap: (id === 'terminal' || id === 'work-ex' || id === 'projects' || id === 'my-sound' || id === 'blog' || id === 'my-niche') ? '0' : '24px',
          padding: (id === 'terminal' || id === 'work-ex' || id === 'projects' || id === 'my-sound' || id === 'blog' || id === 'my-niche') ? '0' : undefined,
          overflow: (id === 'terminal' || id === 'work-ex' || id === 'projects' || id === 'my-sound' || id === 'blog' || id === 'my-niche') ? 'hidden' : undefined,
          cursor: 'auto',
          touchAction: 'auto'
        }} 
      >
        {content}
      </div>
    </motion.div>
  );
}
