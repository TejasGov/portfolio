import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './AIOrbOverlay.css';

export default function AIOrbOverlay({ isOpen, onClose }) {
  // Listen for Escape key to close the overlay
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scrolling/interactions while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Subtle Dimmed Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="orb-overlay-backdrop"
            onClick={onClose}
          >
            {/* Centered Orb and Assistive Text */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 25 }}
              className="orb-center-wrapper"
              onClick={(e) => {
                e.stopPropagation(); // prevent backdrop click closing
                onClose(); // click orb to close
              }}
            >
              {/* Layered glows and rings simulating Siri focus */}
              <div className="orb-glow-layer" />
              <div className="orb-pulse-ring" />
              <div className="orb-pulse-ring" />

              {/* Glowing Interactive Circle */}
              <div className="orb-avatar-container">
                <img
                  src="/homepage/aiicon.svg"
                  alt="Orb Avatar"
                  className="orb-avatar-img"
                />
              </div>

              {/* Status and instruction copy */}
              <h2 className="orb-status-text">Apple Intelligence</h2>
              <p className="orb-subtitle-text">Click the Orb or press Esc to return</p>

              {/* Voice visualizer bars reacting in the background */}
              <div style={{ display: 'flex', gap: '5px', marginTop: '30px', height: '24px', alignItems: 'center' }}>
                {[0.4, 0.9, 0.6, 0.8, 0.5, 0.7, 0.3].map((val, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      height: ['8px', `${val * 32}px`, '8px'],
                    }}
                    transition={{
                      duration: 1.2 + i * 0.1,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    style={{
                      width: '3px',
                      backgroundColor: 'rgba(255, 255, 255, 0.75)',
                      borderRadius: '2px',
                    }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* Apple Intelligence Full Viewport Edge Bloom Glow */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="apple-intelligence-glow"
          />

          {/* Floating Close Button */}
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ delay: 0.1 }}
            className="orb-close-btn"
            onClick={onClose}
            aria-label="Close Assistant"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </motion.button>
        </>
      )}
    </AnimatePresence>
  );
}
