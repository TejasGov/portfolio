import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MARVEL_HEROES = [
  {
    id: 'ironman',
    title: 'Iron Man',
    color: '#ef4444', // Red
    image: '/supes/ironman.svg',
    short: 'The start of it all...',
    full: "I know it is a cliched thing to say, but I got into CS after getting inspiration from Iron Man's Jarvis. That's when I first tinkered with python libraries like gTTS and pyttsx mediapipe to build my own assistant.",
    align: 'left'
  },
  {
    id: 'spiderman',
    title: 'Spider-Man',
    color: '#3b82f6', // Blue
    image: '/supes/spiderman.png',
    short: 'With great power...',
    full: "Spider-Man has always inspired me. He taught me that even in the light of evil, one must follow the path of righteousness and care for people.",
    align: 'right'
  },
  {
    id: 'daredevil',
    title: 'Daredevil',
    color: '#991b1b', // Dark Red
    image: '/supes/daredevil.png',
    short: 'The Man Without Fear',
    full: "Daredevil gives me the motivation to not let hurdles in my life stop me from achieving things I want, and to never give up on my values.",
    align: 'left'
  },
  {
    id: 'thor',
    title: 'Thor',
    color: '#eab308', // Yellow
    image: '/supes/thor.png',
    short: 'God of Thunder',
    full: "Thor taught me to love and respect my family, and to always enjoy and be grateful for what I have been blessed with.",
    align: 'right'
  },
  {
    id: 'captainamerica',
    title: 'Captain America',
    color: '#1e3a8a', // Deep Blue
    image: '/supes/captain.png',
    short: 'The First Avenger',
    full: "Captain America showed me how leadership is equally important, and that true strength comes from an unwavering moral compass.",
    align: 'left'
  },
  {
    id: 'loki',
    title: 'Loki',
    color: '#15803d', // Green
    image: '/supes/Loki.svg',
    short: 'Glorious Purpose',
    full: "Loki's journey, especially his grand sacrifice inspired from his series, shows that anyone can rewrite their destiny for a greater purpose.",
    align: 'right'
  }
];

function useDarkMode() {
  const [isDark, setIsDark] = useState(() => document.body.classList.contains('dark-mode'));
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.body.classList.contains('dark-mode')));
    obs.observe(document.body, { attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

export default function MarvelSection() {
  const [selectedId, setSelectedId] = useState(null);
  const isDark = useDarkMode();

  const selectedHero = MARVEL_HEROES.find(h => h.id === selectedId);

  // Dynamic neo-brutalism comic styling variables
  const theme = {
    bg: isDark ? '#121212' : '#fff',
    cardBg: isDark ? '#1e1e1e' : '#fff',
    textColor: isDark ? '#ffffff' : '#000000',
    textMuted: isDark ? '#a1a1a6' : '#9ca3af',
    borderColor: isDark ? '#ffffff' : '#000000',
    shadowColor: isDark ? '#ffffff' : '#000000',
    bubbleBg: isDark ? '#27272a' : '#fff',
    bubbleTextColor: isDark ? '#ffffff' : '#000000',
    halftoneColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    placeholderBg: isDark ? '#18181b' : '#e5e7eb'
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      fontFamily: '"Comic Sans MS", "Chalkboard SE", "Marker Felt", sans-serif',
      backgroundColor: theme.bg,
      position: 'relative',
      overflow: 'hidden',
      transition: 'background-color 0.3s ease'
    }}>
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '16px', marginTop: '20px', flexShrink: 0 }}>
        <h1 style={{
          fontSize: '36px',
          fontWeight: '900',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          border: `4px solid ${theme.borderColor}`,
          display: 'inline-block',
          padding: '8px 24px',
          background: '#facc15', // Comic yellow banner
          color: '#000',
          transform: 'rotate(-2deg)',
          boxShadow: `6px 6px 0 ${theme.shadowColor}`,
          transition: 'border-color 0.3s ease, box-shadow 0.3s ease'
        }}>
          MARVEL INSPIRATIONS
        </h1>
      </div>

      {/* Bento Grid Scrollable Container */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 24px 32px'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          padding: '12px'
        }}>
          {MARVEL_HEROES.map((hero, i) => (
            <motion.div
              key={hero.id}
              layoutId={`card-${hero.id}`}
              onClick={() => setSelectedId(hero.id)}
              whileHover={{ y: -6, x: -6, boxShadow: `12px 12px 0 ${theme.shadowColor}` }}
              style={{
                backgroundColor: theme.cardBg,
                border: `4px solid ${theme.borderColor}`,
                borderRadius: '8px',
                minHeight: '220px',
                display: 'flex',
                flexDirection: hero.align === 'left' ? 'row' : 'row-reverse',
                position: 'relative',
                cursor: 'pointer',
                boxShadow: `6px 6px 0 ${theme.shadowColor}`,
                overflow: 'hidden',
                backgroundImage: `radial-gradient(${theme.halftoneColor} 1px, transparent 1px)`,
                backgroundSize: '12px 12px',
                backgroundPosition: '0 0, 6px 6px',
                transition: 'background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease'
              }}
            >
              {/* Top Badge */}
              <motion.div layoutId={`badge-${hero.id}`} style={{
                position: 'absolute', 
                top: '12px', 
                left: hero.align === 'right' ? '12px' : 'auto',
                right: hero.align === 'left' ? '12px' : 'auto',
                background: hero.color, padding: '4px 10px',
                border: `2px solid ${theme.borderColor}`, fontWeight: '900', fontSize: '13px',
                boxShadow: `3px 3px 0 ${theme.shadowColor}`, color: '#fff', zIndex: 10,
                textTransform: 'uppercase',
                transition: 'border-color 0.3s ease, box-shadow 0.3s ease'
              }}>
                {hero.title}
              </motion.div>

              {/* Image Container */}
              <motion.div layoutId={`image-${hero.id}`} style={{
                flex: 1,
                backgroundColor: theme.placeholderBg,
                borderRight: hero.align === 'left' ? `4px solid ${theme.borderColor}` : 'none',
                borderLeft: hero.align === 'right' ? `4px solid ${theme.borderColor}` : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '900',
                fontSize: '20px',
                color: theme.textMuted,
                overflow: 'hidden',
                transition: 'background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease'
              }}>
                {hero.image ? (
                  <img src={hero.image} alt={hero.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  "SVG HERE"
                )}
              </motion.div>

              {/* Text Area (Cloud-like bubble) */}
              <motion.div layoutId={`text-${hero.id}`} style={{
                flex: 1.2,
                padding: '48px 16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent'
              }}>
                <div style={{
                  background: theme.bubbleBg,
                  color: theme.bubbleTextColor,
                  border: `3px solid ${theme.borderColor}`,
                  borderRadius: '24px',
                  padding: '12px',
                  fontSize: '15px',
                  lineHeight: 1.4,
                  fontWeight: 600,
                  boxShadow: `3px 3px 0 ${theme.shadowColor}`,
                  position: 'relative',
                  transition: 'background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, color 0.3s ease'
                }}>
                  "{hero.short}"
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Expanded Modal View */}
      <AnimatePresence>
        {selectedHero && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.65)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px'
            }}
            onClick={() => setSelectedId(null)}
          >
            <motion.div
              layoutId={`card-${selectedHero.id}`}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '700px',
                backgroundColor: theme.cardBg,
                border: `6px solid ${theme.borderColor}`,
                borderRadius: '12px',
                boxShadow: `12px 12px 0 ${theme.shadowColor}`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                backgroundImage: `radial-gradient(${theme.halftoneColor} 1px, transparent 1px)`,
                backgroundSize: '12px 12px',
                transition: 'background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease'
              }}
            >
              {/* Header */}
              <div style={{
                padding: '20px',
                backgroundColor: selectedHero.color,
                borderBottom: `4px solid ${theme.borderColor}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'border-color 0.3s ease'
              }}>
                <motion.h2 layoutId={`badge-${selectedHero.id}`} style={{
                  margin: 0,
                  color: '#fff',
                  fontSize: '28px',
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  textShadow: `2.5px 2.5px 0 ${isDark ? '#000' : theme.borderColor}` // high contrast textShadow
                }}>
                  {selectedHero.title}
                </motion.h2>
                <button
                  onClick={() => setSelectedId(null)}
                  style={{
                    background: theme.bubbleBg,
                    color: theme.bubbleTextColor,
                    border: `3px solid ${theme.borderColor}`,
                    fontWeight: '900',
                    fontSize: '18px',
                    padding: '4px 12px',
                    cursor: 'pointer',
                    boxShadow: `3px 3px 0 ${theme.shadowColor}`,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translate(-2px, -2px)';
                    e.currentTarget.style.boxShadow = `5px 5px 0 ${theme.shadowColor}`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translate(0px, 0px)';
                    e.currentTarget.style.boxShadow = `3px 3px 0 ${theme.shadowColor}`;
                  }}
                >
                  X
                </button>
              </div>

              {/* Body */}
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                padding: '24px',
                gap: '24px',
                backgroundColor: 'transparent'
              }}>
                <motion.div layoutId={`image-${selectedHero.id}`} style={{
                  flex: 1,
                  backgroundColor: theme.placeholderBg,
                  border: `4px solid ${theme.borderColor}`,
                  minHeight: '250px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '900',
                  fontSize: '24px',
                  color: theme.textMuted,
                  boxShadow: `6px 6px 0 ${theme.shadowColor}`,
                  overflow: 'hidden',
                  transition: 'background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, color 0.3s ease'
                }}>
                  {selectedHero.image ? (
                    <img src={selectedHero.image} alt={selectedHero.title} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '16px' }} />
                  ) : (
                    "SVG HERE"
                  )}
                </motion.div>

                <motion.div layoutId={`text-${selectedHero.id}`} style={{
                  flex: 1.5,
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <div style={{
                    background: theme.bubbleBg,
                    color: theme.bubbleTextColor,
                    border: `4px solid ${theme.borderColor}`,
                    borderRadius: '24px',
                    padding: '24px',
                    fontSize: '18px',
                    lineHeight: 1.6,
                    fontWeight: 600,
                    boxShadow: `6px 6px 0 ${theme.shadowColor}`,
                    position: 'relative',
                    transition: 'background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, color 0.3s ease'
                  }}>
                    {selectedHero.full}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
