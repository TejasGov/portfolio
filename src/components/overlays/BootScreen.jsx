import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { GradientBackground } from '../ui/paper-design-shader-background';

export default function BootScreen({ onComplete }) {
  // Exit the boot screen after 3 seconds
  useEffect(() => {
    const t = setTimeout(() => onComplete(), 3000);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.08 }}
      transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}
    >
      <GradientBackground />
      
      {/* Dark overlay to make text pop */}
      <div style={{ position: 'absolute', inset: 0, zIndex: -5, background: 'rgba(0, 0, 0, 0.2)' }} />

      <section style={{ padding: '0 24px' }}>
        <h1
          style={{
            color: 'white',
            textAlign: 'center',
            fontWeight: 300,
            letterSpacing: '-0.02em',
            fontSize: '3rem',
            margin: 0,
            fontFamily: 'inherit'
          }}
        >
          Hi, I am Tejas
        </h1>
      </section>
    </motion.div>
  );
}
