import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { TECH_DATA } from '../../data/techData';

const LIGHT_SVG = '/MyTech/MyTech.svg';
const DARK_SVG  = '/MyTech/MyTechDarkMode.svg';

// Natural pixel dimensions — used as the coordinate reference for all hotspots
const SVG_W = 1269;
const SVG_H = 660;

/* ─── Hook: track dark-mode body class ─── */
function useDarkMode() {
  const [isDark, setIsDark] = useState(() => document.body.classList.contains('dark-mode'));
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.body.classList.contains('dark-mode')));
    obs.observe(document.body, { attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

export default function MyTechWindow() {
  const isDark = useDarkMode();
  const [selectedTech, setSelectedTech] = useState(null);
  const [hoveredId, setHoveredId]       = useState(null);
  const [scale, setScale]               = useState(0.72);
  const wrapperRef = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  /* ── Scroll-to-zoom ── */
  const onWheel = useCallback((e) => {
    e.preventDefault();
    setScale(p => Math.min(Math.max(p * (e.deltaY < 0 ? 1.08 : 0.93), 0.3), 4));
  }, []);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  /* ── Theme tokens ── */
  const bg        = isDark ? '#1e1e1e'                         : '#f2f2f7';
  const ttBg      = isDark ? 'rgba(22,22,26,0.97)'             : 'rgba(255,255,255,0.97)';
  const ttBorder  = isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)';
  const ttTitle   = isDark ? '#f1f1f3'                         : '#111827';
  const ttDesc    = isDark ? '#9ca3af'                         : '#4b5563';
  const ttShadow  = isDark ? '0 20px 48px rgba(0,0,0,0.6)'    : '0 20px 48px rgba(0,0,0,0.14)';
  const hintColor = isDark ? 'rgba(255,255,255,0.25)'          : 'rgba(0,0,0,0.22)';
  const GLOW      = '99, 102, 241';

  return (
    <div
      ref={wrapperRef}
      style={{
        width: '100%', height: '100%',
        background: bg,
        overflow: 'hidden',
        position: 'relative',
        cursor: 'grab',
        transition: 'background 0.3s ease',
        userSelect: 'none',
        fontFamily: '"Inter", sans-serif',
      }}
      onClick={() => setSelectedTech(null)}
    >
      {/* ── Top hint ── */}
      <div style={{
        position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
        fontSize: '10.5px', letterSpacing: '0.03em',
        color: hintColor, zIndex: 200, pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}>
        Drag to pan · Scroll to zoom · Click items to explore
      </div>

      {/* ── Draggable / zoomable canvas ── */}
      <motion.div
        drag={true}
        dragMomentum={false}
        style={{
          x, y,
          scale,
          position: 'absolute',
          width: SVG_W, height: SVG_H,
          transformOrigin: 'center center',
          top: '50%', left: '50%',
          marginTop: -(SVG_H / 2), marginLeft: -(SVG_W / 2),
        }}
        whileDrag={{ cursor: 'grabbing' }}
      >
        {/* ── SVG image ── */}
        <img
          key={isDark ? 'dark' : 'light'}
          src={isDark ? DARK_SVG : LIGHT_SVG}
          alt="My Tech Setup"
          draggable={false}
          style={{
            width: '100%', height: '100%',
            display: 'block', objectFit: 'fill',
            pointerEvents: 'none', userSelect: 'none',
            background: 'transparent',
          }}
        />

        {/* ── Hotspot overlays ── */}
        {TECH_DATA.map((item) => {
          const sel    = selectedTech?.id === item.id;
          const hov    = hoveredId === item.id;
          const active = sel || hov;
          const hotspotCoords = isDark && item.hotspotDark ? item.hotspotDark : item.hotspot;

          return (
            <div
              key={item.id}
              onMouseEnter={(e) => { e.stopPropagation(); setHoveredId(item.id); }}
              onMouseLeave={() => setHoveredId(null)}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTech(sel ? null : item);
              }}
              title={item.name}
              style={{
                position: 'absolute',
                left:   hotspotCoords.x,
                top:    hotspotCoords.y,
                width:  hotspotCoords.width,
                height: hotspotCoords.height,
                cursor: 'pointer',
                borderRadius: '8px',
                border: sel
                  ? `2px solid rgba(${GLOW}, 0.9)`
                  : hov
                    ? `2px solid rgba(${GLOW}, 0.55)`
                    : '2px solid transparent',
                backgroundColor: sel
                  ? `rgba(${GLOW}, 0.16)`
                  : hov
                    ? `rgba(${GLOW}, 0.09)`
                    : 'transparent',
                boxShadow: active
                  ? sel
                    ? `0 0 22px rgba(${GLOW}, 0.5), inset 0 0 14px rgba(${GLOW}, 0.18)`
                    : `0 0 14px rgba(${GLOW}, 0.28), inset 0 0 8px rgba(${GLOW}, 0.1)`
                  : 'none',
                transition: 'all 0.18s ease',
                zIndex: active ? 50 : 1,
              }}
            >
              {/* ── Info popup ── */}
              <AnimatePresence>
                {sel && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.94 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 10px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: ttBg,
                      backdropFilter: 'blur(24px)',
                      WebkitBackdropFilter: 'blur(24px)',
                      border: ttBorder,
                      borderRadius: '16px',
                      padding: item.link && item.link !== '#'
                        ? '14px 44px 13px 16px'
                        : '14px 16px 13px',
                      minWidth: '190px', maxWidth: '270px',
                      boxShadow: ttShadow,
                      zIndex: 9999,
                      pointerEvents: 'auto',
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 0, left: 20, right: 20, height: 2,
                      borderRadius: '0 0 4px 4px',
                      background: 'linear-gradient(90deg, #6366f1, #a78bfa)',
                      opacity: 0.8,
                    }} />
                    <h3 style={{ margin: '6px 0 5px', fontSize: '14px', fontWeight: '700', color: ttTitle, letterSpacing: '-0.01em' }}>
                      {item.name}
                    </h3>
                    <p style={{ margin: '0 0 10px', fontSize: '12.5px', color: ttDesc, lineHeight: 1.5 }}>
                      {item.description}
                    </p>
                    {item.link && item.link !== '#' && (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          position: 'absolute',
                          bottom: 12,
                          right: 12,
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
                          transition: 'transform 0.2s ease, background 0.2s ease',
                          pointerEvents: 'auto',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.1)';
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.5)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.35)';
                        }}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="9" cy="21" r="1" />
                          <circle cx="20" cy="21" r="1" />
                          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                        </svg>
                      </a>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </motion.div>

      {/* ── Controls (zoom) ── */}
      <div style={{
        position: 'absolute', bottom: 16, right: 16,
        display: 'flex', flexDirection: 'column', gap: 6,
        zIndex: 200,
      }}>
        {[
          { label: '+',  action: () => setScale(p => Math.min(p * 1.15, 4)) },
          { label: '–',  action: () => setScale(p => Math.max(p * 0.87, 0.3)) },
          { label: '⊙',  action: () => { setScale(0.72); x.set(0); y.set(0); } },
        ].map(({ label, action }) => (
          <button
            key={label}
            onClick={action}
            style={{
              width: 32, height: 32,
              borderRadius: '8px',
              border: ttBorder,
              background: ttBg,
              color: ttTitle,
              fontSize: 15, fontWeight: '600',
              cursor: 'pointer',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
