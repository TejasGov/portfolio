import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

// Each section — CSS sticky + the inner rotatable div
export const FlowSection = ({
  className,
  style = {},
  children,
  'aria-label': ariaLabel,
}) => (
  <section
    data-flow-section
    aria-label={ariaLabel}
    className={cx('flow-section', className)}
  >
    {/* This inner div is what GSAP rotates */}
    <div
      data-flow-inner
      className="flow-art-container"
      style={{ ...style }}
    >
      {children}
    </div>
  </section>
);

const childCount = (children) => React.Children.count(children);

const FlowArt = ({
  children,
  className,
  'aria-label': ariaLabel = 'Story scroll',
}) => {
  const containerRef = useRef(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useGSAP(
    () => {
      if (!containerRef.current || reducedMotion) return;

      let triggers = [];
      let initTimer;

      const init = () => {
        // Find the nearest custom scroll container (our modal scroll div)
        const scroller =
          containerRef.current.closest('.blog-pages-scroll-container') || window;

        const sections = Array.from(
          containerRef.current.querySelectorAll('[data-flow-section]'),
        );
        if (sections.length === 0) return;

        // Stack z-indices so later cards appear on top
        sections.forEach((section, i) => {
          gsap.set(section, { zIndex: i + 1 });
        });

        // For each section beyond the first, animate its inner div from rotation=30 to 0
        // as it scrolls up from below into view
        sections.forEach((section, i) => {
          if (i === 0) return; // first card is already visible, no rotation needed

          const inner = section.querySelector('[data-flow-inner]');
          if (!inner) return;

          gsap.set(inner, { rotation: 30, transformOrigin: 'bottom left' });

          const tween = gsap.to(inner, {
            rotation: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: section,
              scroller,
              // starts rotating when the top of this section hits the bottom of the viewport
              start: 'top bottom',
              // fully upright when it's 25% from the top of the viewport
              end: 'top 25%',
              scrub: true,
            },
          });

          if (tween.scrollTrigger) triggers.push(tween.scrollTrigger);
        });

        ScrollTrigger.refresh();
      };

      // Delay init to let Framer Motion window entrance animation finish
      initTimer = setTimeout(init, 420);

      return () => {
        clearTimeout(initTimer);
        triggers.forEach((t) => t.kill());
        triggers = [];
      };
    },
    { scope: containerRef, dependencies: [childCount(children), reducedMotion] },
  );

  return (
    <main
      ref={containerRef}
      aria-label={ariaLabel}
      className={cx('flow-art-main', className)}
    >
      {children}
    </main>
  );
};

export default FlowArt;
