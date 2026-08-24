import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConversationControls, useConversationStatus } from '@elevenlabs/react';
import './AIOrbOverlay.css';

export default function AIOrbOverlay({ isOpen, onClose, currentActiveWindow }) {
  const { startSession, endSession } = useConversationControls();
  const { status } = useConversationStatus();

  // Reset/disconnect session when overlay closes
  useEffect(() => {
    if (!isOpen) {
      if (status === "connected" || status === "connecting") {
        endSession();
      }
    }
  }, [isOpen, status, endSession]);

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

  // Helper to determine status text copy
  const getStatusText = () => {
    if (status === "connected") return "Orb (Connected)";
    if (status === "connecting") return "Orb (Connecting...)";
    return "Orb";
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Subtle Dimmed Backdrop - clicking anywhere closes */}
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
            >
              {/* Centered Orb Avatar wrapper with absolutely positioned centered glows & rings */}
              <div 
                className="orb-avatar-wrapper"
                onClick={(e) => {
                  e.stopPropagation(); // prevent backdrop click closing
                  if (status === "connected") {
                    endSession();
                  } else {
                    startSession({
                      agentId: "YOUR_ELEVENLABS_AGENT_ID",
                      dynamicVariables: { current_active_window: currentActiveWindow }
                    });
                  }
                }}
              >
                {/* Layered glows and rings simulating Siri focus centered exactly behind the orb */}
                <div className={`orb-glow-layer ${status}`} />
                <div className={`orb-pulse-ring ${status}`} />
                <div className={`orb-pulse-ring ${status}`} />

                {/* Glowing Interactive Circle (without border/container styling) */}
                <div className={`orb-avatar-container ${status}`}>
                  <img
                    src="/homepage/aiicon.svg"
                    alt="Orb Avatar"
                    className="orb-avatar-img"
                  />
                </div>
              </div>

              {/* Status and instruction copy */}
              <h2 className="orb-status-text">{getStatusText()}</h2>
              <p className="orb-subtitle-text">Click the Orb to speak, click anywhere else to exit</p>

              {/* Voice visualizer graph */}
              <div style={{ height: '32px', marginTop: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AnimatePresence mode="wait">
                  {status === "connected" ? (
                    <motion.div 
                      key="active-voice"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      style={{ display: 'flex', gap: '5px', height: '24px', alignItems: 'center' }}
                    >
                      {[0.4, 0.9, 0.6, 0.8, 0.5, 0.7, 0.3].map((val, i) => (
                        <motion.div
                          key={i}
                          animate={{
                            height: ['8px', `${val * 32}px`, '8px'],
                          }}
                          transition={{
                            duration: 1.0 + i * 0.08,
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
                    </motion.div>
                  ) : (
                    <motion.div
                      key="inactive-voice"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.4 }}
                      exit={{ opacity: 0 }}
                      style={{ display: 'flex', gap: '5px', alignItems: 'center' }}
                    >
                      {/* Quiet voice wave (breathing gently) */}
                      {[0, 0, 0, 0, 0].map((_, i) => (
                        <motion.div
                          key={i}
                          animate={{
                            height: ['4px', '6px', '4px'],
                          }}
                          transition={{
                            duration: 2.0,
                            repeat: Infinity,
                            delay: i * 0.15,
                            ease: 'easeInOut',
                          }}
                          style={{
                            width: '4px',
                            height: '4px',
                            backgroundColor: 'rgba(255, 255, 255, 0.6)',
                            borderRadius: '50%',
                          }}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
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
