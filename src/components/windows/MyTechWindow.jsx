import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { Minus, Plus, Scan, X, ArrowUpRight } from 'lucide-react';
import { TECH_DATA } from '../../data/techData';
import './MyTechWindow.css';

const SVG_W = 1269;
const SVG_H = 660;

export default function MyTechWindow() {
  const [isDark, setIsDark] = useState(() => document.body.classList.contains('dark-mode'));
  const [selectedTech, setSelectedTech] = useState(null);
  const [scale, setScale] = useState(0.72);
  const viewportRef = useRef(null);
  const fitScale = useRef(0.72);
  const triggerRef = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(document.body.classList.contains('dark-mode')));
    observer.observe(document.body, { attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const fitCanvas = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const next = Math.max(0.15, Math.min((viewport.clientWidth - 32) / SVG_W, (viewport.clientHeight - 32) / SVG_H, 0.85));
    fitScale.current = next;
    setScale(next);
    x.set(0);
    y.set(0);
  }, [x, y]);

  useEffect(() => {
    const observer = new ResizeObserver(fitCanvas);
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [fitCanvas]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const wheel = event => {
      event.preventDefault();
      setScale(previous => Math.min(4, Math.max(fitScale.current, previous * (event.deltaY < 0 ? 1.08 : 0.93))));
    };
    viewport.addEventListener('wheel', wheel, { passive: false });
    return () => viewport.removeEventListener('wheel', wheel);
  }, []);

  const closeInspector = useCallback(() => {
    setSelectedTech(null);
    triggerRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!selectedTech) return;
    const escape = event => {
      if (event.key !== 'Escape') return;
      if (document.querySelector('dialog[open]') || !viewportRef.current?.closest('.window-modal')?.classList.contains('is-active')) return;
      event.preventDefault();
      event.stopPropagation();
      closeInspector();
    };
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, [selectedTech, closeInspector]);

  const selectTech = (item, trigger) => {
    triggerRef.current = trigger;
    setSelectedTech(item);
  };

  return (
    <div className="tech-window">
      <div className="tech-toolbar">
        <span>My setup</span>
        <select
          aria-label="Explore equipment"
          value={selectedTech?.id || ''}
          onChange={event => selectTech(TECH_DATA.find(item => item.id === event.target.value) || null, event.currentTarget)}
        >
          <option value="">Explore equipment…</option>
          {TECH_DATA.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      <div className="tech-viewport" ref={viewportRef} onClick={() => setSelectedTech(null)}>
        <p className="tech-hint">Drag to pan · Use + / − to zoom</p>
        <motion.div
          className="tech-canvas"
          drag
          dragMomentum={false}
          data-scale={scale}
          style={{ x, y, scale, width: SVG_W, height: SVG_H, marginTop: -SVG_H / 2, marginLeft: -SVG_W / 2 }}
        >
          <img src={isDark ? '/MyTech/MyTechDarkMode.svg' : '/MyTech/MyTech.svg'} alt="Diagram of my computer and everyday equipment" draggable={false} />
          {TECH_DATA.map(item => {
            const coords = isDark && item.hotspotDark ? item.hotspotDark : item.hotspot;
            return (
              <button
                key={item.id}
                className="tech-hotspot"
                aria-label={`Explore ${item.name}`}
                aria-pressed={selectedTech?.id === item.id}
                aria-controls={selectedTech ? 'tech-inspector' : undefined}
                title={item.name}
                onClick={event => { event.stopPropagation(); selectTech(item, event.currentTarget); }}
                style={{ left: coords.x, top: coords.y, width: coords.width, height: coords.height }}
              />
            );
          })}
        </motion.div>
        {selectedTech && (
          <section className="tech-inspector" id="tech-inspector" aria-labelledby="tech-inspector-title" onClick={event => event.stopPropagation()}>
            <div className="tech-inspector-heading">
              <h3 id="tech-inspector-title">{selectedTech.name}</h3>
              <button aria-label="Close equipment details" onClick={closeInspector}><X size={16} /></button>
            </div>
            <p>{selectedTech.description}</p>
            {/^https?:\/\//i.test(selectedTech.link || '') && (
              <a href={selectedTech.link} target="_blank" rel="noopener noreferrer">
                View equipment <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            )}
          </section>
        )}
        <div className="tech-zoom-controls" onClick={event => event.stopPropagation()}>
          <button aria-label="Zoom in on setup" onClick={() => setScale(previous => Math.min(4, previous * 1.15))}><Plus size={17} /></button>
          <button aria-label="Zoom out of setup" onClick={() => setScale(previous => Math.max(fitScale.current, previous * 0.87))}><Minus size={17} /></button>
          <button aria-label="Fit setup to window" onClick={fitCanvas}><Scan size={17} /></button>
        </div>
      </div>
    </div>
  );
}
