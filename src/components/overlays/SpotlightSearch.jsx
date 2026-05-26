import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { searchIndex } from '../../data';

export default function SpotlightSearch({ isOpen, onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const results = searchIndex.filter(item => {
    if (!query) return false;
    const q = query.toLowerCase();
    if (item.title.toLowerCase().includes(q)) return true;
    return item.synonyms.some(s => s.toLowerCase().includes(q));
  });

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    }
    if (e.key === 'Enter' && results.length > 0) {
      onSelect(results[selectedIndex].id);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'absolute', inset: 0, zIndex: 4000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '15vh' }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)' }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        style={{
          width: '600px',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(30px)',
          border: '1px solid var(--glass-border)',
          borderRadius: '16px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 24px', borderBottom: results.length > 0 ? '1px solid var(--glass-border)' : 'none' }}>
          <Search size={24} color="var(--text-main)" style={{ opacity: 0.6 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Spotlight Search"
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-main)',
              fontSize: '24px',
              fontWeight: '300',
              marginLeft: '16px',
              width: '100%'
            }}
          />
        </div>
        {results.length > 0 && (
          <div style={{ padding: '8px 0', maxHeight: '300px', overflowY: 'auto' }}>
            {results.map((res, idx) => (
              <div
                key={res.id}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => onSelect(res.id)}
                style={{
                  padding: '12px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  background: idx === selectedIndex ? 'var(--badge-bg)' : 'transparent',
                  color: 'var(--text-main)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ opacity: 0.8, display: 'flex' }}>{res.icon}</div>
                <span style={{ fontSize: '16px', fontWeight: '500' }}>{res.title}</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
