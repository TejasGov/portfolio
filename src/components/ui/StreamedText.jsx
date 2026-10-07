import { useContext, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { WindowActivityContext } from '../../contexts/WindowActivity';
import './StreamedText.css';

// Reveal authored text or a received transcript; announce the sentence once,
// rather than asking assistive technology to read every animation tick.
export default function StreamedText({ text, instant = false, onComplete }) {
  const active = useContext(WindowActivityContext);
  const reducedMotion = useReducedMotion();
  const [shown, setShown] = useState(0);
  const [visible, setVisible] = useState(!document.hidden);
  const completed = useRef(null);
  const callback = useRef(onComplete);
  callback.current = onComplete;
  useEffect(() => {
    const change = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  useEffect(() => { setShown(0); completed.current = null; }, [text]);
  useEffect(() => {
    if (instant || reducedMotion) { setShown(text.length); return; }
    if (!active || !visible || shown >= text.length) return;
    const timer = setTimeout(() => setShown(count => Math.min(count + 5, text.length)), 24);
    return () => clearTimeout(timer);
  }, [active, visible, shown, text, instant, reducedMotion]);
  useEffect(() => {
    if (shown >= text.length && completed.current !== text) { completed.current = text; callback.current?.(); }
  }, [shown, text]);
  const complete = instant || reducedMotion || shown >= text.length;
  return <span className="streamed-text" data-streaming={!complete}>
    <span className="sr-only">{text}</span><span aria-hidden="true">{text.slice(0, complete ? text.length : shown)}{!complete && <span className="stream-cursor" />}</span>
  </span>;
}
