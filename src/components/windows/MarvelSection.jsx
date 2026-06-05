import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MARVEL_HEROES = [
  {
    id: 'ironman',
    title: 'Iron Man',
    color: '#ef4444', // Red
    short: 'The start of it all...',
    full: "I know it is a cliched thing to say, but I got into CS after getting inspiration from Iron Man's Jarvis. That's when I first tinkered with python libraries like gTTS and pyttsx mediapipe to build my own assistant.",
    align: 'left'
  },
  {
    id: 'spiderman',
    title: 'Spider-Man',
    color: '#3b82f6', // Blue
    short: 'With great power...',
    full: "Spider-Man has always inspired me. He taught me that even in the light of evil, one must follow the path of righteousness and care for people.",
    align: 'right'
  },
  {
    id: 'daredevil',
    title: 'Daredevil',
    color: '#991b1b', // Dark Red
    short: 'The Man Without Fear',
    full: "Daredevil gives me the motivation to not let hurdles in my life stop me from achieving things I want, and to never give up on my values.",
    align: 'left'
  },
  {
    id: 'thor',
    title: 'Thor',
    color: '#eab308', // Yellow
    short: 'God of Thunder',
    full: "Thor taught me to love and respect my family, and to always enjoy and be grateful for what I have been blessed with.",
    align: 'right'
  },
  {
    id: 'captainamerica',
    title: 'Captain America',
    color: '#1e3a8a', // Deep Blue
    short: 'The First Avenger',
    full: "Captain America showed me how leadership is equally important, and that true strength comes from an unwavering moral compass.",
    align: 'left'
  },
  {
    id: 'loki',
    title: 'Loki',
    color: '#15803d', // Green
    short: 'Glorious Purpose',
    full: "Loki's journey, especially his grand sacrifice inspired from his series, shows that anyone can rewrite their destiny for a greater purpose.",
    align: 'right'
  }
];

export default function MarvelSection() {
  const [selectedId, setSelectedId] = useState(null);

  const selectedHero = MARVEL_HEROES.find(h => h.id === selectedId);

  return (
    <div style={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column', 
      padding: '24px', 
      overflowY: 'auto',
      fontFamily: '"Comic Sans MS", "Chalkboard SE", "Marker Felt", sans-serif',
      backgroundColor: '#fff',
      position: 'relative'
    }}>
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '32px', marginTop: '10px' }}>
        <h1 style={{ 
          fontSize: '36px', 
          fontWeight: '900', 
          textTransform: 'uppercase', 
          letterSpacing: '2px',
          border: '4px solid #000',
          display: 'inline-block',
          padding: '8px 24px',
          background: '#facc15', // Comic yellow banner
          color: '#000',
          transform: 'rotate(-2deg)',
          boxShadow: '6px 6px 0 #000'
        }}>
          MARVEL INSPIRATIONS
        </h1>
      </div>

      {/* Bento Grid */}
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
            whileHover={{ y: -6, x: -6, boxShadow: '12px 12px 0 #000' }}
            style={{
              backgroundColor: '#fff',
              border: '4px solid #000',
              borderRadius: '8px',
              minHeight: '220px',
              display: 'flex',
              flexDirection: hero.align === 'left' ? 'row' : 'row-reverse',
              position: 'relative',
              cursor: 'pointer',
              boxShadow: '6px 6px 0 #000',
              overflow: 'hidden',
              backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
              backgroundSize: '12px 12px',
              backgroundPosition: '0 0, 6px 6px'
            }}
          >
            {/* Top Badge */}
            <motion.div layoutId={`badge-${hero.id}`} style={{ 
              position: 'absolute', top: '12px', left: '12px', 
              background: hero.color, padding: '4px 10px', 
              border: '2px solid #000', fontWeight: '900', fontSize: '13px',
              boxShadow: '3px 3px 0 #000', color: '#fff', zIndex: 10,
              textTransform: 'uppercase'
            }}>
              {hero.title}
            </motion.div>

            {/* SVG Placeholder */}
            <motion.div layoutId={`image-${hero.id}`} style={{
              flex: 1,
              backgroundColor: '#e5e7eb',
              borderRight: hero.align === 'left' ? '4px solid #000' : 'none',
              borderLeft: hero.align === 'right' ? '4px solid #000' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '900',
              fontSize: '20px',
              color: '#9ca3af'
            }}>
              SVG HERE
            </motion.div>

            {/* Text Area (Cloud-like bubble placeholder) */}
            <motion.div layoutId={`text-${hero.id}`} style={{
              flex: 1.2,
              padding: '48px 16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#fff'
            }}>
              <div style={{
                background: '#fff',
                border: '3px solid #000',
                borderRadius: '24px', // bubble look
                padding: '12px',
                fontSize: '15px',
                lineHeight: 1.4,
                fontWeight: 600,
                boxShadow: '3px 3px 0 #000',
                position: 'relative'
              }}>
                "{hero.short}"
              </div>
            </motion.div>
          </motion.div>
        ))}
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
              backgroundColor: 'rgba(0,0,0,0.6)',
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
                backgroundColor: '#fff',
                border: '6px solid #000',
                borderRadius: '12px',
                boxShadow: '12px 12px 0 #000',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
                backgroundSize: '12px 12px'
              }}
            >
              {/* Header */}
              <div style={{ 
                padding: '20px', 
                backgroundColor: selectedHero.color, 
                borderBottom: '4px solid #000',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <motion.h2 layoutId={`badge-${selectedHero.id}`} style={{ 
                  margin: 0, 
                  color: '#fff', 
                  fontSize: '28px', 
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  textShadow: '2px 2px 0 #000'
                }}>
                  {selectedHero.title}
                </motion.h2>
                <button 
                  onClick={() => setSelectedId(null)}
                  style={{
                    background: '#fff',
                    border: '3px solid #000',
                    fontWeight: '900',
                    fontSize: '18px',
                    padding: '4px 12px',
                    cursor: 'pointer',
                    boxShadow: '3px 3px 0 #000'
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
                backgroundColor: '#fff'
              }}>
                <motion.div layoutId={`image-${selectedHero.id}`} style={{
                  flex: 1,
                  backgroundColor: '#e5e7eb',
                  border: '4px solid #000',
                  minHeight: '250px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '900',
                  fontSize: '24px',
                  color: '#9ca3af',
                  boxShadow: '6px 6px 0 #000'
                }}>
                  SVG HERE
                </motion.div>

                <motion.div layoutId={`text-${selectedHero.id}`} style={{
                  flex: 1.5,
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <div style={{
                    background: '#fff',
                    border: '4px solid #000',
                    borderRadius: '24px', // large bubble
                    padding: '24px',
                    fontSize: '18px',
                    lineHeight: 1.6,
                    fontWeight: 600,
                    boxShadow: '6px 6px 0 #000',
                    position: 'relative'
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
