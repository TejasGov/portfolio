import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { GradientBackground } from '../ui/paper-design-shader-background';
export default function BootScreen({ onComplete }) {
  const words = "Hi, I am Tejas".split(" ");

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.18,
        delayChildren: 0.2,
      }
    }
  };

  const wordVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 180,
        damping: 18,
      }
    }
  };

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
        overflow: 'hidden',
        backgroundColor: '#0a0a0a' // Solid dark background to prevent flashing during WebGL compilation
      }}
    >
      <GradientBackground />
      
      {/* Dark overlay to make text pop */}
      <div style={{ position: 'absolute', inset: 0, zIndex: -5, background: 'rgba(0, 0, 0, 0.2)' }} />

      <motion.section
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{ padding: '0 24px' }}
      >
        <h1
          style={{
            color: 'white',
            textAlign: 'center',
            fontWeight: 400,
            letterSpacing: '-0.02em',
            fontSize: '2.8rem',
            margin: 0,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace"
          }}
        >
          {words.map((word, idx) => (
            <motion.span
              key={idx}
              variants={wordVariants}
              style={{ display: 'inline-block', marginRight: '0.3em' }}
            >
              {word}
            </motion.span>
          ))}
        </h1>
      </motion.section>
    </motion.div>
  );
}
