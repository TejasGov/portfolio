import React from 'react';
import { motion } from 'framer-motion';

export default function HelpModal({ activeWindowId, onClose }) {
  let helpText = "Tejas OS is a custom portfolio designed to emulate a native desktop environment. Double click icons to explore!";
  if (activeWindowId === 'projects') helpText = "Projects Directory: Browse through comprehensive case studies and GitHub repositories of my latest work.";
  if (activeWindowId === 'work-ex') helpText = "Work Experience: A dynamic timeline charting my professional journey and volunteer work.";
  if (activeWindowId === 'photography') helpText = "Photography: A curated collection of my favorite captures.";
  if (activeWindowId === 'about') helpText = "About Me: Learn more about my background, skills, and current academic standing.";

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'absolute', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.1)', backdropFilter: 'blur(2px)' }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="glass-panel"
        style={{
          width: '320px', padding: '24px', borderRadius: '24px', position: 'relative', zIndex: 1,
          border: '1px solid var(--glass-border)', boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
          color: 'var(--text-main)', textAlign: 'center'
        }}
      >
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '12px' }}>Tejas OS Help</h3>
        <p style={{ fontSize: '14px', lineHeight: '1.5', opacity: 0.9, marginBottom: '24px' }}>{helpText}</p>
        <button 
          onClick={onClose}
          style={{
            background: 'var(--badge-bg)', border: '1px solid var(--badge-border)', color: 'var(--badge-text)',
            padding: '8px 24px', borderRadius: '16px', fontWeight: '600', cursor: 'pointer'
          }}
        >
          Got it
        </button>
      </motion.div>
    </motion.div>
  );
}
