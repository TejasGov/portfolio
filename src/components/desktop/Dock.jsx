import { Children, cloneElement, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useTransform, useSpring, useReducedMotion } from 'framer-motion';
import './Dock.css';

export default function Dock({ children }) {
  const mouseX = useMotionValue(Infinity);
  const centers = useRef(new Map());
  const dockRef = useRef(null);
  const measureIcons = () => {
    centers.current.clear();
    dockRef.current?.querySelectorAll('.dock-item').forEach(button => {
      const bounds = button.getBoundingClientRect();
      centers.current.set(button, bounds.x + bounds.width / 2);
    });
  };
  return (
    <nav className="workspace-dock" aria-label="Workspace tools">
      <motion.div
        ref={dockRef}
        className="glass-panel dock"
        onPointerEnter={event => { if (event.pointerType === 'mouse') measureIcons(); }}
        onPointerMove={event => { if (event.pointerType === 'mouse') mouseX.set(event.clientX); }}
        onPointerLeave={() => mouseX.set(Infinity)}
        onFocus={event => {
          if (!event.target.matches('.dock-item')) return;
          if (!centers.current.size) measureIcons();
          mouseX.set(centers.current.get(event.target) ?? Infinity);
        }}
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { mouseX.set(Infinity); centers.current.clear(); } }}
      >
        {Children.map(children, child => !child || child.type === 'span' ? child : cloneElement(child, { mouseX, centers }))}
      </motion.div>
    </nav>
  );
}

export function DockIcon({ icon, label, ariaLabel, variant = 'default', isActive, onClick, mouseX, centers }) {
  const ref = useRef(null);
  const [hovered, setHovered] = useState(false);
  const fallback = useMotionValue(Infinity);
  const reduceMotion = useReducedMotion();
  // Measure once when entering the dock, rather than forcing layout on every pointer move.
  const distance = useTransform(mouseX || fallback, value => value - (centers?.current.get(ref.current) ?? 0));
  const desiredSize = useTransform(distance, [-125, 0, 125], [48, 68, 48]);
  const size = useSpring(desiredSize, { mass: .12, stiffness: 300, damping: 24 });
  return (
    <motion.button
      ref={ref}
      className={`dock-item dock-${variant}`}
      onClick={onClick}
      aria-label={ariaLabel || label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={{ width: reduceMotion ? 48 : size, height: reduceMotion ? 48 : size }}
      whileTap={reduceMotion ? {} : { scale: .94 }}
    >
      <span className="dock-icon-face">{icon}</span>
      {isActive && <span className="dock-active-dot" aria-hidden="true" />}
      <AnimatePresence>{hovered && <motion.span className="dock-tooltip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : .12 }}>{label}</motion.span>}</AnimatePresence>
    </motion.button>
  );
}
