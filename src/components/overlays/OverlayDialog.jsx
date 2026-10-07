import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import './OverlayDialog.css';

export default function OverlayDialog({ isOpen, onClose, title, eyebrow, description, className = '', initialFocusRef, children }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    const previous = document.activeElement;
    dialog.showModal();
    const frame = requestAnimationFrame(() => initialFocusRef?.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      dialog.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [isOpen, initialFocusRef]);

  if (!isOpen) return null;
  return <dialog ref={dialogRef} className={`overlay-dialog ${className}`} aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const targets = [...event.currentTarget.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select, textarea, [tabindex="0"]')].filter(element => element.getClientRects().length && element.tabIndex >= 0);
      const first = targets[0];
      const last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onCancel={event => { event.preventDefault(); onCloseRef.current(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onCloseRef.current();
    }}>
    <button className="overlay-close" onClick={onClose} aria-label={`Close ${title}`}><X size={18} /></button>
    <header className="overlay-heading">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 id={titleId}>{title}</h2>
      {description && <p id={descriptionId}>{description}</p>}
    </header>
    {children}
  </dialog>;
}
