import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import CarShowcaseScene from './CarShowcaseScene';
import { CARS } from '../../data/carData';

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
}

// How much accumulated wheel delta (px) is needed to advance one car
const DELTA_PER_SLIDE = 600;

export default function CarShowcaseSection({ scrollerEl }) {
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;

  const [activeIndex, setActiveIndex] = useState(0);
  // 0–1: how far into the "end of slide" circle-expand animation we are
  const [circleScale, setCircleScale] = useState(1);

  // Accumulated scroll delta within the current slide
  const accDeltaRef = useRef(0);
  const isAnimatingRef = useRef(false);
  const activeIndexRef = useRef(0);

  const goToSlide = useCallback((nextIndex) => {
    if (nextIndex < 0 || nextIndex >= CARS.length) return;
    isAnimatingRef.current = true;
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
    setCircleScale(1);
    accDeltaRef.current = 0;

    // Brief lock so rapid scrolling doesn't double-fire
    setTimeout(() => {
      isAnimatingRef.current = false;
    }, 600);
  }, []);

  useEffect(() => {
    const container = scrollerEl?.current;
    if (!container) return;

    const onWheel = (e) => {
      e.preventDefault();
      if (isAnimatingRef.current) return;

      // Normalise: trackpads send small deltas, mice send large ones
      const raw = e.deltaY;
      const step = Math.abs(raw) > 100 ? Math.sign(raw) * 100 : raw;
      accDeltaRef.current += step;

      // Drive circle scale (0 → 1) based on how close we are to the threshold
      const progress = Math.max(0, Math.min(1, accDeltaRef.current / DELTA_PER_SLIDE));
      // circle expands only in the last 30% of the slide's scroll dwell
      const circleProgress = Math.max(0, (progress - 0.7) / 0.3);
      setCircleScale(1 + Math.pow(circleProgress, 3) * 12);

      if (accDeltaRef.current >= DELTA_PER_SLIDE) {
        goToSlide(activeIndexRef.current + 1);
      } else if (accDeltaRef.current <= -DELTA_PER_SLIDE) {
        goToSlide(activeIndexRef.current - 1);
      }
    };

    // Touch support
    let touchStartY = 0;
    const onTouchStart = (e) => { touchStartY = e.touches[0].clientY; };
    const onTouchMove = (e) => {
      if (isAnimatingRef.current) return;
      const dy = touchStartY - e.touches[0].clientY;
      accDeltaRef.current += dy * 2;
      touchStartY = e.touches[0].clientY;

      const progress = Math.max(0, Math.min(1, accDeltaRef.current / DELTA_PER_SLIDE));
      const circleProgress = Math.max(0, (progress - 0.7) / 0.3);
      setCircleScale(1 + Math.pow(circleProgress, 3) * 12);

      if (accDeltaRef.current >= DELTA_PER_SLIDE) {
        goToSlide(activeIndexRef.current + 1);
      } else if (accDeltaRef.current <= -DELTA_PER_SLIDE) {
        goToSlide(activeIndexRef.current - 1);
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    return () => {
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
    };
  }, [scrollerEl, goToSlide]);

  const activeCar = CARS[activeIndex] || CARS[0];

  // ── Layout ─────────────────────────────────────────────────────────────────
  const circleSize = isMobile ? '60vw' : '35vw';
  const circleMax  = isMobile ? '280px' : '600px';
  const circleTop  = isMobile ? '62%' : '50%';
  const circleLeft = isMobile
    ? '50%'
    : activeCar.layout === 'right' ? '78%' : '22%';

  const canvasStyle = isMobile
    ? { position: 'absolute', top: '30%', left: 0, right: 0, bottom: '48px', zIndex: 2, touchAction: 'none' }
    : { position: 'absolute', inset: 0, zIndex: 2, touchAction: 'none' };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Full-height slide */}
      <div style={{
        flex: 1,
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: activeCar.bgColor,
        transition: 'background-color 0.7s ease',
      }}>
        {/* Background Circle */}
        <div style={{
          position: 'absolute',
          top: circleTop,
          left: circleLeft,
          width: circleSize,
          height: circleSize,
          maxWidth: circleMax,
          maxHeight: circleMax,
          borderRadius: '50%',
          backgroundColor: activeCar.circleColor,
          transform: `translate(-50%, -50%) scale(${circleScale})`,
          transition: 'background-color 0.5s ease, left 0.5s ease, top 0.5s ease',
          zIndex: 0,
          willChange: 'transform',
        }} />

        {/* Pagination dots */}
        <div style={{
          position: 'absolute',
          top: isMobile ? 'auto' : '50%',
          bottom: isMobile ? '52px' : 'auto',
          right: isMobile ? '50%' : '20px',
          transform: isMobile ? 'translateX(50%)' : 'translateY(-50%)',
          display: 'flex',
          flexDirection: isMobile ? 'row' : 'column',
          gap: '8px',
          zIndex: 10,
          pointerEvents: 'none',
        }}>
          {CARS.map((_, i) => (
            <div key={i} style={{
              width: i === activeIndex ? '8px' : '5px',
              height: i === activeIndex ? '8px' : '5px',
              borderRadius: '50%',
              background: i === activeIndex ? activeCar.titleColor : activeCar.textColor,
              opacity: i === activeIndex ? 1 : 0.3,
              transition: 'all 0.4s ease',
            }} />
          ))}
        </div>

        {/* Text Block */}
        {CARS.map((car, i) => {
          const isActive = i === activeIndex;
          const left  = isMobile ? '5%' : (car.layout === 'right' ? '6%' : '48%');
          const width = isMobile ? '90%' : '44%';
          const tV = isMobile
            ? { top: '28px' }
            : { top: '50%', transform: isActive ? 'translateY(-50%)' : 'translateY(calc(-50% + 40px))' };
          return (
            <div key={car.id} style={{
              position: 'absolute',
              left, width, ...tV,
              opacity: isActive ? 1 : 0,
              transition: 'opacity 0.5s ease, transform 0.5s ease',
              display: 'flex', flexDirection: 'column', gap: '6px',
              zIndex: 3, pointerEvents: 'none',
            }}>
              <h1 style={{
                fontSize: isMobile ? 'clamp(2rem, 9vw, 3rem)' : 'clamp(2.5rem, 4.5vw, 4.5rem)',
                fontWeight: 800, color: car.titleColor,
                margin: 0, lineHeight: 1.05,
                marginBottom: isMobile ? '14px' : '24px',
              }}>{car.name}</h1>
              <h2 style={{
                fontSize: isMobile ? 'clamp(1rem, 4vw, 1.4rem)' : 'clamp(1.1rem, 2vw, 1.8rem)',
                fontWeight: 600, color: car.textColor, margin: 0,
              }}>{car.tagline}</h2>
              <p style={{
                fontSize: isMobile ? 'clamp(0.85rem, 3.5vw, 1rem)' : 'clamp(0.9rem, 1.4vw, 1.3rem)',
                fontWeight: 500, color: car.textColor, opacity: 0.75, marginTop: '12px',
              }}>{car.price}</p>
            </div>
          );
        })}

        {/* 3D Canvas */}
        <div style={canvasStyle}>
          <Canvas camera={{ position: [0, 0, 12], fov: isMobile ? 55 : 45 }} style={{ width: '100%', height: '100%' }}>
            <CarShowcaseScene activeCarIndex={activeIndex} isMobile={isMobile} />
          </Canvas>
        </div>

        {/* Scroll Indicator */}
        <div style={{
          position: 'absolute',
          bottom: '14px', left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
          zIndex: 10,
          opacity: activeIndex === CARS.length - 1 ? 0 : 0.65,
          transition: 'opacity 0.4s ease',
          pointerEvents: 'none',
        }}>
          <span style={{
            fontSize: isMobile ? '9px' : '10px',
            textTransform: 'uppercase', letterSpacing: '3px', fontWeight: 700,
            color: activeCar.textColor, opacity: 0.9,
          }}>Scroll</span>
          <div style={{
            width: '1px', height: isMobile ? '20px' : '28px',
            background: `linear-gradient(to bottom, ${activeCar.textColor}, transparent)`,
          }} />
        </div>
      </div>
    </div>
  );
}
