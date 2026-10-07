import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { useConversationControls, useConversationStatus } from '@elevenlabs/react';
import OverlayDialog from './OverlayDialog';

export default function AIOrbOverlay({ isOpen, onClose, currentActiveWindow }) {
  const { startSession, endSession } = useConversationControls();
  const { status } = useConversationStatus();
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const openRef = useRef(isOpen);
  openRef.current = isOpen;
  useEffect(() => {
    if (!isOpen) {
      setError('');
      if (status === 'connected' || status === 'connecting') Promise.resolve(endSession()).catch(() => {});
    }
  }, [isOpen, status, endSession]);
  const speak = async () => {
    setError('');
    if (status === 'connected') { try { await endSession(); } catch { setError('The session could not be stopped. Close this dialog to disconnect.'); } return; }
    setStarting(true);
    try {
      await startSession({ agentId: 'agent_5301m0tx6pz3evjveb5s4e9e33g5', dynamicVariables: { current_active_window: currentActiveWindow }, onError: () => { if (openRef.current) setError('Orb couldn’t connect. Check microphone access and your connection, then try again.'); } });
      if (!openRef.current) await endSession();
    } catch (failure) {
      if (openRef.current) setError(failure?.name === 'NotAllowedError' ? 'Microphone access was denied. Allow access in your browser and try again.' : 'Orb couldn’t connect. Check microphone access and your connection, then try again.');
    } finally { setStarting(false); }
  };
  const connecting = starting || status === 'connecting';
  return <OverlayDialog isOpen={isOpen} onClose={onClose} title="A conversation with Orb." eyebrow="THE VOICE COMPANION" description="Ask about my work, explore a project, or get to know me. Orb can open windows for you."><div className="assistant-display" aria-hidden="true"><div className={`assistant-orb ${status === 'connected' ? 'is-connected' : ''}`} /></div><p className="overlay-note" role="status">{status === 'connected' ? 'Connected. You can speak now.' : connecting ? 'Connecting to Orb…' : 'Ready when you are.'}</p>{error && <p className="assistant-error" role="alert">{error}</p>}<div className="assistant-actions"><button className="primary-button" onClick={speak} disabled={connecting}>{status === 'connected' ? <Square size={14} /> : <Mic size={16} />}{status === 'connected' ? 'End conversation' : connecting ? 'Connecting…' : error ? 'Try again' : 'Start a conversation'}</button></div><p className="overlay-note">Voice conversations use ElevenLabs and need microphone permission. Your microphone starts only when you choose to begin.</p></OverlayDialog>;
}
