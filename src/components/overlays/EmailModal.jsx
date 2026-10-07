import { useState, useEffect, useRef } from 'react';
import { Copy, Check, ArrowUpRight, Calendar } from 'lucide-react';
import OverlayDialog from './OverlayDialog';
const email = 'tejasgov2005@gmail.com';
export default function EmailModal({ isOpen, onClose }) {
  const [copyState, setCopyState] = useState('idle');
  const timer = useRef(null);
  useEffect(() => { if (!isOpen) setCopyState('idle'); return () => clearTimeout(timer.current); }, [isOpen]);
  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopyState('copied');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopyState('idle'), 2500);
    } catch { setCopyState('error'); }
  };
  return <OverlayDialog isOpen={isOpen} onClose={onClose} title="Contact Tejas" description="Send an email or copy my email address.">
    <div className="contact-email"><a href={`mailto:${email}`}>{email}</a><button className="contact-copy" onClick={copyEmail} aria-label="Copy email address">{copyState === 'copied' ? <Check size={17} /> : <Copy size={17} />}</button></div>
    {copyState !== 'idle' && <p className="contact-status" role="status">{copyState === 'copied' ? 'Email address copied.' : 'Copy is unavailable. Select the address above or open your email app.'}</p>}
    <div className="contact-actions"><a className="primary-button" href={`mailto:${email}`}>Write an email <ArrowUpRight size={16} /></a><a className="text-button" href="https://calendar.app.google/FsdQ3Uf8wi1zCad16" target="_blank" rel="noopener noreferrer"><Calendar size={15} /> Book a chat <ArrowUpRight size={14} /></a></div>
    <p className="overlay-note">Find my other links in Socials in the dock.</p>
  </OverlayDialog>;
}
