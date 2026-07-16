import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';

const SWIPE_THRESHOLD = 50;

const slideVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 80 : direction < 0 ? -80 : 0,
    opacity: 0,
    scale: 0.95
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      x: { type: 'spring', stiffness: 300, damping: 30 },
      opacity: { duration: 0.18 },
      scale: { duration: 0.18 }
    }
  },
  exit: (direction) => ({
    x: direction < 0 ? 80 : direction > 0 ? -80 : 0,
    opacity: 0,
    scale: 0.95,
    transition: {
      x: { type: 'spring', stiffness: 300, damping: 30 },
      opacity: { duration: 0.18 },
      scale: { duration: 0.18 }
    }
  })
};

/* ─── Nav arrow button ───────────────────────────────────────── */
function NavButton({ side, onClick }) {
  const isLeft = side === 'left';
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ background: 'rgba(255,255,255,0.16)' }}
      whileTap={{ scale: 0.93 }}
      style={{
        position: 'absolute',
        [isLeft ? 'left' : 'right']: '14px',
        top: '50%', transform: 'translateY(-50%)',
        width: '38px', height: '38px', borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.14)',
        background: 'rgba(255,255,255,0.07)',
        backdropFilter: 'blur(8px)',
        color: 'rgba(255,255,255,0.85)',
        cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        zIndex: 10,
      }}
    >
      <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={isLeft ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
      </svg>
    </motion.button>
  );
}

/* ─── Thumbnail strip ────────────────────────────────────────── */
function ThumbnailStrip({ photos, current, onSelect }) {
  const stripRef = useRef(null);
  const activeRef = useRef(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [current]);

  return (
    <div
      ref={stripRef}
      style={{
        display: 'flex', gap: '5px', overflowX: 'auto',
        maxWidth: '70%', padding: '4px 2px',
        scrollbarWidth: 'none', msOverflowStyle: 'none',
      }}
      onClick={e => e.stopPropagation()}
    >
      {photos.map((src, i) => (
        <motion.div
          key={i}
          ref={i === current ? activeRef : null}
          onClick={() => onSelect(i)}
          whileHover={{ opacity: 0.85 }}
          whileTap={{ scale: 0.94 }}
          style={{
            width: '36px', height: '36px', borderRadius: '6px',
            overflow: 'hidden', flexShrink: 0, cursor: 'pointer',
            border: `1.5px solid ${i === current ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.12)'}`,
            opacity: i === current ? 1 : 0.4,
            transition: 'border-color 0.2s, opacity 0.2s',
          }}
        >
          <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </motion.div>
      ))}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────── */
export default function MorphingPhotoGallery({ photos, layout = 'grid', windowRef }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [direction, setDirection] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);

  const openLightbox = (i) => { setIsNavigating(false); setDirection(0); setLightbox(i); };
  const closeLightbox = () => setLightbox(null);

  const navigate = (dir) => {
    setIsNavigating(true);
    setDirection(dir);
    setLightbox(prev => (prev + dir + photos.length) % photos.length);
  };

  /* keyboard nav */
  useEffect(() => {
    if (lightbox === null) return;
    const handler = (e) => {
      if (e.key === 'Escape')      closeLightbox();
      if (e.key === 'ArrowLeft')   navigate(-1);
      if (e.key === 'ArrowRight')  navigate(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox]); // eslint-disable-line

  /* stack swipe */
  const handleDragEnd = (_, info) => {
    const { offset, velocity } = info;
    const swipe = Math.abs(offset.x) * velocity.x;
    if (offset.x < -SWIPE_THRESHOLD || swipe < -1000)
      setActiveIndex(prev => (prev + 1) % photos.length);
    else if (offset.x > SWIPE_THRESHOLD || swipe > 1000)
      setActiveIndex(prev => (prev - 1 + photos.length) % photos.length);
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

  /* ── lightbox portal ── */
  const lightboxNode = lightbox !== null && (
    <AnimatePresence>
      <motion.div
        key="lb-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        onClick={closeLightbox}
        style={{
          position: 'absolute', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.86)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '18px',
          borderRadius: 'inherit',
          overflow: 'hidden',
        }}
      >
        {/* Close button */}
        <motion.button
          onClick={closeLightbox}
          whileHover={{ background: 'rgba(255,255,255,0.14)' }}
          whileTap={{ scale: 0.92 }}
          style={{
            position: 'absolute', top: '14px', right: '14px',
            width: '30px', height: '30px', borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.75)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '15px', lineHeight: 1, zIndex: 10,
          }}
        >×</motion.button>

        {/* Prev / next arrows */}
        <NavButton side="left"  onClick={e => { e.stopPropagation(); navigate(-1); }} />
        <NavButton side="right" onClick={e => { e.stopPropagation(); navigate(1); }} />

        {/* Image — uses slide/fade transition */}
        <AnimatePresence mode="popLayout" custom={direction}>
          <motion.div
            key={lightbox}
            variants={slideVariants}
            custom={direction}
            initial="enter"
            animate="center"
            exit="exit"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '80%', maxHeight: '68%',
              borderRadius: '14px', overflow: 'hidden',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
              flexShrink: 0,
            }}
          >
            <img
              src={photos[lightbox]}
              alt={`Photo ${lightbox + 1}`}
              style={{ display: 'block', maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain' }}
            />
          </motion.div>
        </AnimatePresence>

        {/* Thumbnail strip + counter */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
          onClick={e => e.stopPropagation()}>
          <ThumbnailStrip
            photos={photos}
            current={lightbox}
            onSelect={(i) => {
              setIsNavigating(true);
              setDirection(i > lightbox ? 1 : -1);
              setLightbox(i);
            }}
          />
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', fontFamily: 'inherit' }}>
            {lightbox + 1} / {photos.length}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );

  return (
    <LayoutGroup>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>

        {/* ── Grid ── */}
        {layout === 'grid' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '8px',
          }}>
            {photos.map((src, i) => (
              <motion.div
                key={i}
                layoutId={`photo-${i}`}
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26, delay: i * 0.02 }}
                onClick={() => openLightbox(i)}
                style={{
                  aspectRatio: '1',
                  borderRadius: '11px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: '1px solid var(--card-border)',
                  visibility: lightbox === i ? 'hidden' : 'visible',
                }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                <img src={src} alt={`Photo ${i + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  loading="lazy" />
              </motion.div>
            ))}
          </div>
        )}

        {/* ── List ── */}
        {layout === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {photos.map((src, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25, delay: i * 0.025 }}
                onClick={() => openLightbox(i)}
                style={{
                  display: 'flex', gap: '16px', alignItems: 'center',
                  padding: '10px', borderRadius: '14px',
                  background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                  cursor: 'pointer',
                }}
                whileHover={{ scale: 1.01 }}
              >
                <img src={src} alt={`Photo ${i + 1}`}
                  style={{ width: '68px', height: '68px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0 }}
                  loading="lazy" />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>Photo {i + 1}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Photography Collection</div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* ── Stack ── */}
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
                      onClick={() => { if (!isDragging) openLightbox(origIdx); }}
                      style={{
                        position: 'absolute', top: 0, left: 0,
                        width: '100%', height: '100%',
                        borderRadius: '16px', overflow: 'hidden',
                        border: '1px solid var(--card-border)',
                        cursor: isTop ? 'grab' : 'default',
                        boxShadow: isTop ? '0 12px 40px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.15)',
                      }}
                    >
                      <img src={src} alt={`Photo ${origIdx + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
                      {isTop && (
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0,
                          padding: '40px 16px 12px',
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.55))',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
                        }}>
                          <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>Photo {origIdx + 1}</span>
                          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px' }}>swipe →</span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            <div style={{ display: 'flex', gap: '5px' }}>
              {photos.map((_, i) => (
                <button key={i} onClick={() => setActiveIndex(i)} style={{
                  width: i === activeIndex ? '16px' : '6px', height: '6px',
                  borderRadius: '4px', border: 'none', cursor: 'pointer',
                  transition: 'all 0.25s',
                  background: i === activeIndex ? 'var(--text-main)' : 'var(--text-muted)',
                  opacity: i === activeIndex ? 1 : 0.3,
                }} />
              ))}
            </div>
          </div>
        )}

        {/* ── Lightbox (portalled into window modal) ── */}
        {windowRef?.current && createPortal(lightboxNode, windowRef.current)}
      </div>
    </LayoutGroup>
  );
}
