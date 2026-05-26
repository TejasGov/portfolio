import React, { useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { Grid3X3, Layers, LayoutList } from 'lucide-react';

const SWIPE_THRESHOLD = 50;

export default function MorphingPhotoGallery({ photos, layout = 'grid' }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [lightbox, setLightbox] = useState(null); // index or null

  const handleDragEnd = (_, info) => {
    const { offset, velocity } = info;
    const swipe = Math.abs(offset.x) * velocity.x;
    if (offset.x < -SWIPE_THRESHOLD || swipe < -1000) {
      setActiveIndex(prev => (prev + 1) % photos.length);
    } else if (offset.x > SWIPE_THRESHOLD || swipe > 1000) {
      setActiveIndex(prev => (prev - 1 + photos.length) % photos.length);
    }
    setIsDragging(false);
  };

  const getStackOrder = () => {
    const reordered = [];
    for (let i = 0; i < photos.length; i++) {
      const idx = (activeIndex + i) % photos.length;
      reordered.push({ src: photos[idx], origIdx: idx, stackPos: i });
    }
    return reordered.reverse();
  };

  return (
    <div>

      {/* ─── Grid Layout ─── */}
      {layout === 'grid' && (
        <LayoutGroup>
          <motion.div
            layout
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '10px',
            }}
          >
            {photos.map((src, i) => (
              <motion.div
                key={i}
                layoutId={`photo-${i}`}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25, delay: i * 0.02 }}
                onClick={() => setLightbox(i)}
                style={{
                  aspectRatio: '1',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: '1px solid var(--card-border)',
                }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                <img src={src} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
              </motion.div>
            ))}
          </motion.div>
        </LayoutGroup>
      )}

      {/* ─── List Layout ─── */}
      {layout === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {photos.map((src, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25, delay: i * 0.025 }}
              onClick={() => setLightbox(i)}
              style={{
                display: 'flex', gap: '16px', alignItems: 'center',
                padding: '10px', borderRadius: '14px',
                background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              whileHover={{ scale: 1.01, backgroundColor: 'var(--badge-bg)' }}
            >
              <img src={src} alt={`Photo ${i + 1}`} style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0 }} loading="lazy" />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>Photo {i + 1}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Photography Collection</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ─── Stack Layout ─── */}
      {layout === 'stack' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div style={{ position: 'relative', width: '300px', height: '380px' }}>
            <AnimatePresence mode="popLayout">
              {getStackOrder().map(({ src, origIdx, stackPos }) => {
                const isTop = stackPos === 0;
                return (
                  <motion.div
                    key={origIdx}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{
                      opacity: stackPos > 3 ? 0 : 1,
                      scale: 1 - stackPos * 0.04,
                      y: stackPos * 10,
                      rotate: (stackPos - 1) * 1.5,
                      zIndex: photos.length - stackPos,
                    }}
                    exit={{ opacity: 0, scale: 0.8, x: -250 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    drag={isTop ? 'x' : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.7}
                    onDragStart={() => setIsDragging(true)}
                    onDragEnd={handleDragEnd}
                    whileDrag={{ scale: 1.03, cursor: 'grabbing' }}
                    onClick={() => { if (!isDragging) setLightbox(origIdx); }}
                    style={{
                      position: 'absolute', top: 0, left: 0,
                      width: '100%', height: '100%',
                      borderRadius: '16px', overflow: 'hidden',
                      border: '1px solid var(--card-border)',
                      cursor: isTop ? 'grab' : 'default',
                      boxShadow: isTop ? '0 12px 40px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.15)',
                    }}
                  >
                    <img src={src} alt={`Photo ${origIdx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
                    {isTop && (
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        padding: '40px 16px 12px',
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
                      }}>
                        <span style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>Photo {origIdx + 1}</span>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>Swipe →</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Dot indicators */}
          <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                style={{
                  width: i === activeIndex ? '16px' : '6px',
                  height: '6px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.25s',
                  background: i === activeIndex ? 'var(--text-main)' : 'var(--text-muted)',
                  opacity: i === activeIndex ? 1 : 0.3,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── Lightbox ─── */}
      <AnimatePresence>
        {lightbox !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 5000,
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(20px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'zoom-out',
            }}
          >
            <motion.img
              src={photos[lightbox]}
              alt={`Photo ${lightbox + 1}`}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              style={{
                maxWidth: '85vw', maxHeight: '85vh',
                objectFit: 'contain',
                borderRadius: '12px',
                boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
              }}
              onClick={e => e.stopPropagation()}
            />
            {/* Photo counter */}
            <div style={{
              position: 'absolute', bottom: '32px',
              color: 'rgba(255,255,255,0.5)', fontSize: '13px',
              fontFamily: "'Inter', sans-serif", letterSpacing: '1px',
            }}>
              {lightbox + 1} / {photos.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
