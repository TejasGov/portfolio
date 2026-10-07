import { Children, cloneElement, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, useSpring, useReducedMotion } from 'framer-motion';
import './Dock.css';
export default function Dock({ children }) {
  const mouseX = useMotionValue(Infinity);
  return <nav className="workspace-dock" aria-label="Workspace tools"><motion.div className="glass-panel dock" onMouseMove={event => mouseX.set(event.clientX)} onMouseLeave={() => mouseX.set(Infinity)}>{Children.map(children, child => !child || child.type === 'span' ? child : cloneElement(child, { mouseX }))}</motion.div></nav>;
}
export function DockIcon({ icon, label, ariaLabel, variant = 'default', isActive, onClick, mouseX }) {
  const ref = useRef(null);
  const [hovered, setHovered] = useState(false);
  const fallback = useMotionValue(Infinity);
  const reduceMotion = useReducedMotion();
  const distance = useTransform(mouseX || fallback, value => { const bounds = ref.current?.getBoundingClientRect() || { x: 0, width: 0 }; return value - bounds.x - bounds.width / 2; });
  const desiredSize = useTransform(distance, [-125, 0, 125], [48, 68, 48]);
  const size = useSpring(desiredSize, { mass: .12, stiffness: 280, damping: 20 });
  return <motion.button ref={ref} className={`dock-item dock-${variant}`} onClick={onClick} aria-label={ariaLabel || label} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setHovered(true)} onBlur={() => setHovered(false)} style={{ width: reduceMotion ? 48 : size, height: reduceMotion ? 48 : size }} whileTap={reduceMotion ? {} : { scale: .94 }}><span className="dock-icon-face">{icon}</span>{isActive && <span className="dock-active-dot" aria-hidden="true" />}{hovered && <span className="dock-tooltip">{label}</span>}</motion.button>;
}
