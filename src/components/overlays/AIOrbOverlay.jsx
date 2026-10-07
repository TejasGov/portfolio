import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { useConversation } from '@elevenlabs/react';
import { useReducedMotion } from 'framer-motion';
import OverlayDialog from './OverlayDialog';
import SiriOrb from '../ui/SiriOrb';
import StreamedText from '../ui/StreamedText';
import './AIOrbOverlay.css';

function VoiceMeter({ connected, speaking, getInputVolume, getOutputVolume }) {
  const meter = useRef(null);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (!connected || reducedMotion) return;
    let frame;
    let last = 0;
    const update = time => {
      if (time - last > 33) {
        const level = Math.min(1, Math.max(0, speaking ? getOutputVolume() : getInputVolume()));
        meter.current?.style.setProperty('--voice-level', level);
        last = time;
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [connected, speaking, reducedMotion, getInputVolume, getOutputVolume]);
  return <div className="siri-meter" ref={meter} aria-hidden="true">{[.4, .7, 1, .7, .4].map((height, index) => <span key={index} style={{ height: `${height * 28}px` }} />)}</div>;
}

export default function AIOrbOverlay({ isOpen, onClose, currentActiveWindow }) {
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [holding, setHolding] = useState(false);
  const [messages, setMessages] = useState([]);
  const [ended, setEnded] = useState(false);
  const openRef = useRef(isOpen);
  const requested = useRef(false);
  const controlsRef = useRef(null);
  const logRef = useRef(null);
  const followTranscript = useRef(true);
  const sequence = useRef(0);
  openRef.current = isOpen;
  const fail = (message, context) => {
    requested.current = false;
    controlsRef.current?.endSession();
    setStarting(false);
    setHolding(false);
    if (!openRef.current) return;
    const denied = context?.name === 'NotAllowedError' || /permission|notallowed|denied/i.test(message || '');
    setError(denied ? 'Microphone access was denied. Allow access in your browser, then try again.' : 'Orb couldn’t connect. Check your connection and microphone access, then try again.');
  };
  const conversation = useConversation({
    micMuted: !holding,
    onConnect: () => {
      if (!openRef.current || !requested.current) { controlsRef.current?.endSession(); return; }
      setStarting(false);
    },
    onError: fail,
    onDisconnect: details => {
      requested.current = false;
      setStarting(false);
      setHolding(false);
      if (openRef.current) {
        setEnded(true);
        if (details?.reason === 'error') fail(details.message);
      }
    },
    onMessage: event => {
      if (!openRef.current || !requested.current || !event.message) return;
      const role = event.role || (event.source === 'user' ? 'user' : 'agent');
      const id = event.event_id == null ? `message-${++sequence.current}` : `${role}-${event.event_id}`;
      setMessages(previous => {
        const existing = previous.find(item => item.id === id);
        return existing ? previous.map(item => item.id === id ? { ...item, text: event.message } : item) : [...previous, { id, role, text: event.message }].slice(-50);
      });
    },
  });
  controlsRef.current = conversation;
  const { status, isSpeaking, startSession, endSession, getInputVolume, getOutputVolume } = conversation;
  const connected = status === 'connected';
  const connecting = starting || status === 'connecting';

  useEffect(() => {
    setHolding(false);
    if (isOpen) { setError(''); setMessages([]); setEnded(false); followTranscript.current = true; }
    else { requested.current = false; setStarting(false); endSession(); }
  }, [isOpen, endSession]);
  useEffect(() => {
    if (!starting) return;
    const timer = setTimeout(() => {
      requested.current = false;
      endSession();
      fail('Connection timed out');
    }, 25000);
    return () => clearTimeout(timer);
  }, [starting, endSession]);
  useEffect(() => {
    if (!isOpen) return;
    const release = () => setHolding(false);
    const hide = () => { if (document.hidden) release(); };
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', hide);
    return () => { window.removeEventListener('blur', release); document.removeEventListener('visibilitychange', hide); };
  }, [isOpen]);
  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    const observer = new ResizeObserver(() => { if (followTranscript.current) log.scrollTop = log.scrollHeight; });
    if (log.firstElementChild) observer.observe(log.firstElementChild);
    if (followTranscript.current) log.scrollTop = log.scrollHeight;
    return () => observer.disconnect();
  }, [messages]);

  const begin = () => {
    if (requested.current || connecting || connected) return;
    setError(''); setEnded(false); setStarting(true); requested.current = true;
    try { startSession({ agentId: 'agent_5301m0tx6pz3evjveb5s4e9e33g5', dynamicVariables: { current_active_window: currentActiveWindow } }); }
    catch (failure) { fail(failure?.message, failure); }
  };
  const stop = () => { requested.current = false; setHolding(false); setStarting(false); setEnded(true); endSession(); };
  const statusText = error ? 'Unable to connect' : connecting ? 'Connecting…' : connected ? holding ? 'Listening…' : isSpeaking ? 'Orb is speaking…' : 'Hold to talk' : ended ? 'Conversation ended' : 'What would you like to know?';

  return <OverlayDialog isOpen={isOpen} onClose={onClose} title="Orb voice assistant" className="siri-dialog" hideHeading>
    <div className="siri-intelligence-border" aria-hidden="true" />
    <div className="siri-display"><SiriOrb size={96} active={connecting || connected && (holding || isSpeaking)} /><h2 className="siri-status" role="status">{statusText}</h2><p className="siri-subtitle">Ask about Tejas, his work, or a project.</p><VoiceMeter connected={connected} speaking={isSpeaking} getInputVolume={getInputVolume} getOutputVolume={getOutputVolume} /></div>
    {messages.length > 0 && <div className="siri-transcript" ref={logRef} role="log" aria-label="Voice conversation transcript" onScroll={event => { const log = event.currentTarget; followTranscript.current = log.scrollHeight - log.scrollTop - log.clientHeight < 40; }}><div>{messages.map(message => <p key={message.id} className={`siri-message ${message.role}`}><span className="sr-only">{message.role === 'user' ? 'You: ' : 'Orb: '}</span>{message.role === 'agent' ? <StreamedText text={message.text} /> : message.text}</p>)}</div></div>}
    {error && <p className="siri-error" role="alert">{error}</p>}
    <div className="siri-actions">{connected ? <>
      <button className={`siri-talk ${holding ? 'is-held' : ''}`} aria-label="Hold to talk" aria-pressed={holding} onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); setHolding(true); }} onPointerUp={() => setHolding(false)} onPointerCancel={() => setHolding(false)} onLostPointerCapture={() => setHolding(false)} onKeyDown={event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); if (!event.repeat) setHolding(true); } }} onKeyUp={event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); setHolding(false); } }} onBlur={() => setHolding(false)}><Mic size={16} aria-hidden="true" />{holding ? 'Listening…' : 'Hold to talk'}</button>
      <button className="siri-end" onClick={stop} aria-label="End conversation"><Square size={13} aria-hidden="true" /></button>
    </> : <button className="siri-talk" onClick={begin} disabled={connecting}><Mic size={16} aria-hidden="true" />{connecting ? 'Connecting…' : error ? 'Try again' : 'Start voice conversation'}</button>}</div>
    <p className="siri-permission">{connected ? 'Hold the button to speak. Release to listen.' : 'Microphone access starts when you begin.'}<br />Voice powered by ElevenLabs.</p>
  </OverlayDialog>;
}
