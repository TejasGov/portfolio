import React, {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function useMergeRefs(...refs) {
  return useMemo(() => {
    if (refs.every((r) => r == null)) return null;
    return (node) => {
      refs.forEach((ref) => {
        if (typeof ref === 'function') ref(node);
        else if (ref != null) ref.current = node;
      });
    };
  }, refs);
}

/**
 * A scroll-driven radial gallery.
 * Pass `scroller` (a DOM element ref) to drive rotation from an inner scrollable
 * container instead of the page scroll — required when used inside a window modal.
 */
export const RadialScrollGallery = forwardRef(function RadialScrollGallery(
  {
    children,
    header,
    scrollDuration = 2500,
    visiblePercentage = 45,
    radius = 420,
    startTrigger = 'top top',
    onItemSelect,
    direction = 'ltr',
    disabled = false,
    scroller,           // ref to the scrollable container
    style,
    angleStep = null,   // custom spacing between cards in degrees (optional)
    ...rest
  },
  ref
) {
  const pinRef = useRef(null);
  const containerRef = useRef(null);
  const firstItemRef = useRef(null);
  const mergedRef = useMergeRefs(ref, pinRef);

  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [childSize, setChildSize] = useState(null);
  const [mounted, setMounted] = useState(false);

  const circleDiameter = radius * 2;
  const visibleFrac = Math.max(0.1, Math.min(1, visiblePercentage / 100));
  const hiddenFrac = 1 - visibleFrac;

  const childNodes = useMemo(
    () => React.Children.toArray(children(hoveredIndex)),
    [children, hoveredIndex]
  );
  const count = childNodes.length;

  const stepRad = useMemo(() => {
    if (angleStep != null) {
      return (angleStep * Math.PI) / 180;
    }
    return (2 * Math.PI) / count;
  }, [angleStep, count]);

  const totalRotation = useMemo(() => {
    if (angleStep != null) {
      return (count - 1) * angleStep;
    }
    return 360;
  }, [angleStep, count]);

  useEffect(() => {
    setMounted(true);
    if (!firstItemRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setChildSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      ScrollTrigger.refresh();
    });
    ro.observe(firstItemRef.current);
    return () => ro.disconnect();
  }, [count]);

  useGSAP(
    () => {
      if (!pinRef.current || !containerRef.current || count === 0) return;
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) return;

      const scrollerEl = (scroller && typeof scroller === 'object' && 'current' in scroller) 
        ? scroller.current 
        : scroller;

      if (!scrollerEl) return;

      // Entrance stagger
      gsap.fromTo(
        containerRef.current.children,
        { scale: 0, autoAlpha: 0 },
        {
          scale: 1, autoAlpha: 1,
          duration: 1.0, ease: 'back.out(1.2)', stagger: 0.045,
          scrollTrigger: {
            trigger: pinRef.current,
            start: 'top 90%',
            toggleActions: 'play none none reverse',
            scroller: scrollerEl,
          },
        }
      );

      // Scroll-driven rotation
      const rotationVal = angleStep != null
        ? (direction === 'rtl' ? totalRotation : -totalRotation)
        : (direction === 'rtl' ? -360 : 360);

      gsap.to(containerRef.current, {
        rotation: rotationVal,
        ease: 'none',
        scrollTrigger: {
          trigger: pinRef.current,
          pin: true,
          start: startTrigger,
          end: `+=${scrollDuration}`,
          scrub: 1,
          invalidateOnRefresh: true,
          scroller: scrollerEl,
        },
      });
    },
    { scope: pinRef, dependencies: [scrollDuration, radius, startTrigger, count, direction, scroller, angleStep, totalRotation] }
  );

  if (count === 0) return null;

  const itemH = childSize?.h ?? 280;
  const visibleH = circleDiameter * visibleFrac + itemH / 2 + 100;

  return (
    <div
      ref={mergedRef}
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        ...style,
      }}
      {...rest}
    >
      {header}
      <div
        style={{
          position: 'relative',
          width: '100%',
          overflow: 'hidden',
          height: `${visibleH}px`,
          maskImage: 'linear-gradient(to top, transparent 0%, black 35%, black 100%)',
          WebkitMaskImage: 'linear-gradient(to top, transparent 0%, black 35%, black 100%)',
        }}
      >
        <ul
          ref={containerRef}
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            willChange: 'transform',
            margin: 0, padding: 0, listStyle: 'none',
            width: circleDiameter,
            height: circleDiameter,
            bottom: -(circleDiameter * hiddenFrac),
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.4s ease',
            ...(disabled ? { opacity: 0.4, pointerEvents: 'none', filter: 'grayscale(1)' } : {}),
          }}
          dir={direction}
        >
          {childNodes.map((child, i) => {
            const angle = angleStep != null
              ? -Math.PI / 2 + (direction === 'rtl' ? -1 : 1) * i * stepRad
              : (i / count) * 2 * Math.PI;

            const x = (direction === 'rtl' ? -1 : 1) * radius * Math.cos(angle);
            const y = radius * Math.sin(angle);
            const rotDeg = (angle * 180) / Math.PI;
            const isHovered = hoveredIndex === i;
            const anyHovered = hoveredIndex !== null;

            return (
              <li
                key={i}
                ref={i === 0 ? firstItemRef : null}
                style={{
                  position: 'absolute',
                  top: '50%', left: '50%',
                  zIndex: isHovered ? 100 : 10,
                  transform: `translate(-50%, -50%) translate3d(${x}px, ${y}px, 0) rotate(${rotDeg + 90}deg)`,
                }}
              >
                <div
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                  onClick={() => !disabled && onItemSelect?.(i)}
                  onKeyDown={(e) => {
                    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onItemSelect?.(i);
                    }
                  }}
                  onMouseEnter={() => !disabled && setHoveredIndex(i)}
                  onMouseLeave={() => !disabled && setHoveredIndex(null)}
                  onFocus={() => !disabled && setHoveredIndex(i)}
                  onBlur={() => !disabled && setHoveredIndex(null)}
                  style={{
                    cursor: 'pointer',
                    outline: 'none',
                    borderRadius: '12px',
                    transition: 'transform 0.5s ease, filter 0.5s ease, opacity 0.5s ease',
                    willChange: 'transform',
                    transform: isHovered ? 'scale(1.2) translateY(-12px)' : 'scale(1)',
                    filter: (anyHovered && !isHovered) ? 'blur(2px) grayscale(0.6)' : 'none',
                    opacity: (anyHovered && !isHovered) ? 0.45 : 1,
                  }}
                >
                  {child}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
});

RadialScrollGallery.displayName = 'RadialScrollGallery';
