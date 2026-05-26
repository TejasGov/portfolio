import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Copy, Check, Calendar } from 'lucide-react';

export default function EmailModal({ isOpen, onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText('tejasgov2005@gmail.com');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="email-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 900,
              backdropFilter: 'blur(2px)',
              backgroundColor: 'rgba(0,0,0,0.05)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="email-panel"
            initial={{ opacity: 0, y: 50, scale: 0.95, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, y: 50, scale: 0.95, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="glass-panel"
            style={{
              position: 'absolute',
              bottom: '120px',
              left: '50%',
              zIndex: 950,
              padding: '28px',
              borderRadius: '24px',
              width: '400px',
              maxWidth: '90vw',
              border: '1px solid var(--glass-border)',
              boxShadow: 'var(--glass-shadow)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}
          >
            {/* Header */}
            <div>
              <h2 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={22} /> Send Email
              </h2>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>
                Send me a message directly or book a virtual chat.
              </p>
            </div>

            {/* Email Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                <span>tejasgov2005@gmail.com</span>
                <button 
                  type="button" 
                  onClick={handleCopy}
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    color: copied ? '#4ade80' : 'var(--text-muted)', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center',
                    padding: '4px',
                    borderRadius: '6px'
                  }}
                  title="Copy Email"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <a 
                href="mailto:tejasgov2005@gmail.com"
                style={{
                  background: 'var(--text-main)',
                  color: 'var(--bg-color)',
                  textDecoration: 'none',
                  padding: '8px 18px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s ease',
                }}
                onMouseOver={(e) => e.target.style.opacity = '0.9'}
                onMouseOut={(e) => e.target.style.opacity = '1'}
              >
                Send Email
              </a>
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'var(--glass-border)', margin: '4px 0' }} />

            {/* Bottom Section */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Prefer to talk live?</span>
              <a 
                href="https://calendar.app.google/FsdQ3Uf8wi1zCad16" 
                target="_blank" 
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-main)',
                  textDecoration: 'none',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '500',
                  border: '1px solid var(--glass-border)',
                  transition: 'background 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
              >
                <Calendar size={16} /> Book a chat
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
