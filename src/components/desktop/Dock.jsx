import React, { useState, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import './Dock.css';

export default function Dock({ children }) {
  const mouseX = useMotionValue(Infinity);

  return (
    <div style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
      <motion.div 
        className="glass-panel dock" 
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        initial={{ y: 100, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        style={{ display: 'flex', gap: '12px', padding: '12px 16px', alignItems: 'flex-end', height: '72px' }}
      >
        {React.Children.map(children, child => {
          if (!child) return null;
          if (child.type === 'div') return child; // For the divider
          return React.cloneElement(child, { mouseX });
        })}
      </motion.div>
    </div>
  );
}

export function DockIcon({ icon, label, isActive, onClick, hoverColor = 'rgba(255,255,255,0.2)', mouseX }) {
  const ref = useRef(null);
  const [hovered, setHovered] = useState(false);

  // Safely handle missing mouseX (e.g. for simple implementation without it)
  const safeMouseX = mouseX || useMotionValue(Infinity);

  const distance = useTransform(safeMouseX, (val) => {
    let bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const sizeSync = useTransform(distance, [-150, 0, 150], [48, 70, 48]);
  const size = useSpring(sizeSync, { mass: 0.1, stiffness: 200, damping: 15 });
  
  return (
    <motion.div 
      ref={ref}
      className="dock-item"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{ 
        position: 'relative', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        width: size,
        height: size
      }}
      onClick={onClick}
    >
      <motion.div
        animate={{ 
          background: hovered 
            ? `linear-gradient(150deg, ${hoverColor} 0%, rgba(255,255,255,0.1) 100%)` 
            : 'linear-gradient(150deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)'
        }}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '25%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: hovered 
            ? 'inset 2px 4px 5px 0px rgba(255, 255, 255, 0.2), inset 0px 0px 1px 1px rgba(255, 255, 255, 0.3), 0 8px 16px rgba(0,0,0,0.2)' 
            : 'inset 2px 4px 5px 0px rgba(255, 255, 255, 0.1), inset 0px 0px 1px 1px rgba(255, 255, 255, 0.1), 0 4px 8px rgba(0,0,0,0.1)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          transition: 'box-shadow 0.3s ease',
          overflow: 'hidden'
        }}
      >
        {React.isValidElement(icon) ? (
          icon.type === 'img' ? icon : React.cloneElement(icon, { style: { width: '45%', height: '45%' } })
        ) : null}
      </motion.div>
      
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            style={{
              position: 'absolute',
              bottom: '-8px',
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 0 4px rgba(255,255,255,0.8)'
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: '-45px',
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(10px)',
              padding: '6px 12px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '500',
              color: 'var(--text-main)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              border: '1px solid var(--glass-border)',
              zIndex: 10
            }}
          >
            {label}
            <div style={{
              position: 'absolute',
              bottom: '-5px',
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: '10px',
              height: '10px',
              background: 'inherit',
              borderRight: '1px solid var(--glass-border)',
              borderBottom: '1px solid var(--glass-border)',
              zIndex: -1
            }} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
