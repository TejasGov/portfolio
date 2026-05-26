import React, { useState, useEffect, useRef, useCallback } from 'react';

const MONO = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace";

const MOTD = [
  { text: '████████╗███████╗     ██╗ █████╗ ███████╗', color: '#60a5fa' },
  { text: '╚══██╔══╝██╔════╝     ██║██╔══██╗██╔════╝', color: '#60a5fa' },
  { text: '   ██║   █████╗       ██║███████║███████╗', color: '#818cf8' },
  { text: '   ██║   ██╔══╝  ██   ██║██╔══██║╚════██║', color: '#818cf8' },
  { text: '   ██║   ███████╗╚█████╔╝██║  ██║███████║', color: '#a78bfa' },
  { text: '   ╚═╝   ╚══════╝ ╚════╝ ╚═╝  ╚═╝╚══════╝', color: '#a78bfa' },
  { text: '', color: '' },
  { text: '  Welcome to Tejas OS v1.0  —  darwin-portfolio', color: '#f1f5f9' },
  { text: '  Type `help` to see available commands.', color: '#94a3b8' },
  { text: '', color: '' },
];

const COMMANDS = {
  help: () => [
    { text: 'Available commands:', color: '#f1f5f9' },
    { text: '', color: '' },
    { text: '  whoami      →  Who is Tejas?', color: '#94a3b8' },
    { text: '  about       →  Detailed bio & personality', color: '#94a3b8' },
    { text: '  skills      →  Languages, frameworks & tools', color: '#94a3b8' },
    { text: '  projects    →  View project portfolio', color: '#94a3b8' },
    { text: '  experience  →  Work & volunteer history', color: '#94a3b8' },
    { text: '  education   →  Academic background', color: '#94a3b8' },
    { text: '  contact     →  Get in touch', color: '#94a3b8' },
    { text: '  open <win>  →  Open a window (e.g. open projects)', color: '#94a3b8' },
    { text: '  date        →  Current date & time', color: '#94a3b8' },
    { text: '  uname       →  System info', color: '#94a3b8' },
    { text: '  echo <txt>  →  Echo text', color: '#94a3b8' },
    { text: '  clear       →  Clear terminal', color: '#94a3b8' },
    { text: '', color: '' },
  ],
  whoami: () => [
    { text: '👤  Tejas Govind', color: '#f1f5f9' },
    { text: '    CS @ University at Buffalo  (Expected May 2027)', color: '#94a3b8' },
    { text: '📍  Buffalo, NY  ·  Open to internships & research', color: '#94a3b8' },
    { text: '', color: '' },
  ],
  about: () => [
    { text: '👤  Tejas Govind', color: '#f1f5f9' },
    { text: '    CS @ University at Buffalo  (Expected May 2027)', color: '#94a3b8' },
    { text: '', color: '' },
    { text: '    I build things at the intersection of ML, CV, and web.', color: '#e2e8f0' },
    { text: '    Passionate about designing beautiful, intuitive interfaces', color: '#e2e8f0' },
    { text: '    and deploying real-world AI systems. Volunteer, researcher,', color: '#e2e8f0' },
    { text: '    and lifelong learner.', color: '#e2e8f0' },
    { text: '', color: '' },
  ],
  skills: () => [
    { text: '── Languages ──────────────────────────────────', color: '#64748b' },
    { text: '   Python · JavaScript · TypeScript · C++', color: '#e2e8f0' },
    { text: '── Frameworks ─────────────────────────────────', color: '#64748b' },
    { text: '   React · Node.js · Next.js · Express', color: '#e2e8f0' },
    { text: '── ML / CV ────────────────────────────────────', color: '#64748b' },
    { text: '   MediaPipe · YOLOv8 · OpenCV · TensorFlow', color: '#e2e8f0' },
    { text: '── Tools ──────────────────────────────────────', color: '#64748b' },
    { text: '   Figma · Git · Supabase · Vercel · Docker', color: '#e2e8f0' },
    { text: '', color: '' },
  ],
  projects: () => [
    { text: '1.  Revere          AI-powered caretaker dashboard', color: '#818cf8' },
    { text: '2.  Tejas OS        macOS-inspired portfolio OS (this!)', color: '#818cf8' },
    { text: '3.  Gaze Tracker    Facial mesh + gaze estimation (YOLOv8)', color: '#818cf8' },
    { text: '4.  Supabase App    Real-time serverless collab app', color: '#818cf8' },
    { text: '', color: '' },
    { text: '    Tip: type `open projects` to view full case studies.', color: '#64748b' },
    { text: '', color: '' },
  ],
  experience: () => [
    { text: 'Community Volunteer  ·  UB Pre-Dental Assoc.  ·  Feb 2026–Present', color: '#f1f5f9' },
    { text: 'Student Assistant   ·  UB Libraries           ·  Aug 2025–Present', color: '#f1f5f9' },
    { text: 'Campus Outreach SA  ·  UB Athletics           ·  Jul 2025–Present', color: '#f1f5f9' },
    { text: 'Academic Tutor      ·  UB                     ·  Jun 2025–Present', color: '#f1f5f9' },
    { text: '', color: '' },
    { text: '    Tip: type `open work-ex` to view the full timeline.', color: '#64748b' },
    { text: '', color: '' },
  ],
  education: () => [
    { text: '🎓  University at Buffalo — SUNY', color: '#f1f5f9' },
    { text: '    B.S. Computer Science · Expected May 2027', color: '#94a3b8' },
    { text: '    Buffalo, New York', color: '#64748b' },
    { text: '', color: '' },
  ],
  contact: () => [
    { text: '📧  tejasgovind@buffalo.edu', color: '#34d399' },
    { text: '🔗  linkedin.com/in/tejas-govind-29520a2b2', color: '#34d399' },
    { text: '🐙  github.com/TejasGov', color: '#34d399' },
    { text: '📷  instagram.com/tejasgovind_', color: '#34d399' },
    { text: '', color: '' },
  ],
  date: () => [
    { text: new Date().toString(), color: '#f1f5f9' },
    { text: '', color: '' },
  ],
  uname: () => [
    { text: 'Tejas OS v1.0 (darwin-portfolio)  React 18  Vite', color: '#f1f5f9' },
    { text: '', color: '' },
  ],
};

// Char-per-ms speed — shorter lines type faster, blank lines are instant
const CHAR_SPEED = 18; // ms per character
const LINE_GAP   = 40; // ms between lines starting

/**
 * TypewriterLine — renders a single line, typing it out char by char.
 * Calls onDone() when the line is fully typed.
 */
function TypewriterLine({ text, color, onDone, instant }) {
  const [displayed, setDisplayed] = useState(instant || !text ? text : '');
  const timerRef = useRef(null);
  const doneFired = useRef(false);

  useEffect(() => {
    if (doneFired.current) return; // Prevent StrictMode double-fire

    if (instant || !text) {
      setDisplayed(text);
      doneFired.current = true;
      onDone?.();
      return;
    }
    let i = 0;
    setDisplayed('');

    const tick = () => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i < text.length) {
        timerRef.current = setTimeout(tick, CHAR_SPEED);
      } else {
        if (!doneFired.current) {
          doneFired.current = true;
          onDone?.();
        }
      }
    };
    timerRef.current = setTimeout(tick, CHAR_SPEED);
    return () => clearTimeout(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, instant]);

  return (
    <div style={{ fontFamily: MONO, fontSize: '13px', lineHeight: '1.7', color, whiteSpace: 'pre', minHeight: '1.7em' }}>
      {displayed}
    </div>
  );
}

export default function TerminalWindow({ onOpenWindow }) {
  // Permanent lines (MOTD + prompt echoes) — shown instantly
  const [lines, setLines] = useState(() =>
    MOTD.map(l => ({ ...l, id: Math.random(), instant: true }))
  );

  // Queue of lines yet to be typed (from current command output)
  const [typeQueue, setTypeQueue] = useState([]);
  const [typingIdx, setTypingIdx] = useState(null); // index into typeQueue being typed

  const [input, setInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const isTypingRef = useRef(false);

  // Auto-scroll whenever lines or queue changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines, typeQueue, typingIdx]);

  // Advance the typewriter queue one line at a time
  const advanceQueue = useCallback((queue, idx) => {
    if (idx >= queue.length) {
      // All done — flush finished queue into permanent lines
      setLines(prev => [...prev, ...queue.map(l => ({ ...l, instant: true }))]);
      setTypeQueue([]);
      setTypingIdx(null);
      isTypingRef.current = false;
      return;
    }
    setTypingIdx(idx);
  }, []);

  // When a typewriter line finishes, wait LINE_GAP then show the next
  const handleLineDone = useCallback((queue, idx) => {
    const next = idx + 1;
    if (next >= queue.length) {
      setTimeout(() => advanceQueue(queue, next), LINE_GAP);
    } else {
      // Blank lines are instant — skip ahead immediately
      const isBlank = !queue[next]?.text;
      setTimeout(() => advanceQueue(queue, next), isBlank ? 0 : LINE_GAP);
    }
  }, [advanceQueue]);

  const enqueueLines = useCallback((newLines) => {
    const withIds = newLines.map(l => ({ ...l, id: Math.random() }));
    setTypeQueue(withIds);
    isTypingRef.current = true;
    advanceQueue(withIds, 0);
  }, [advanceQueue]);

  const pushInstant = useCallback((newLines) => {
    setLines(prev => [...prev, ...newLines.map(l => ({ ...l, id: Math.random(), instant: true }))]);
  }, []);

  const runCommand = useCallback((raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    // Echo the typed command (instant)
    pushInstant([
      { text: '', color: '' },
      { text: null, cmd: trimmed, id: Math.random() },
    ]);

    setCmdHistory(prev => [trimmed, ...prev]);
    setHistIdx(-1);

    const [cmd, ...args] = trimmed.toLowerCase().split(/\s+/);

    if (cmd === 'clear') {
      setLines(MOTD.map(l => ({ ...l, id: Math.random(), instant: true })));
      setTypeQueue([]);
      setTypingIdx(null);
      isTypingRef.current = false;
      return;
    }

    if (cmd === 'echo') {
      enqueueLines([{ text: args.join(' '), color: '#f1f5f9' }, { text: '', color: '' }]);
      return;
    }

    if (cmd === 'open') {
      const windowMap = {
        projects: 'projects', 'work-ex': 'work-ex', workex: 'work-ex',
        photography: 'photography', about: 'about', terminal: 'terminal',
        certificates: 'certificates', contact: 'contact',
      };
      const target = windowMap[args[0]];
      if (target && onOpenWindow) {
        onOpenWindow(target);
        enqueueLines([{ text: `Opening ${args[0]}...`, color: '#34d399' }, { text: '', color: '' }]);
      } else {
        enqueueLines([
          { text: `open: unknown window '${args[0] || ''}'`, color: '#f87171' },
          { text: '', color: '' },
        ]);
      }
      return;
    }

    if (COMMANDS[cmd]) {
      enqueueLines(COMMANDS[cmd]());
    } else {
      enqueueLines([
        { text: `zsh: command not found: ${trimmed}`, color: '#f87171' },
        { text: "    (type `help` to see available commands)", color: '#64748b' },
        { text: '', color: '' },
      ]);
    }
  }, [enqueueLines, pushInstant, onOpenWindow]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      runCommand(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIdx = Math.min(histIdx + 1, cmdHistory.length - 1);
      setHistIdx(newIdx);
      setInput(cmdHistory[newIdx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIdx = Math.max(histIdx - 1, -1);
      setHistIdx(newIdx);
      setInput(newIdx === -1 ? '' : cmdHistory[newIdx]);
    }
  };

  // The "active" typewriter line
  const activeLine = typingIdx !== null ? typeQueue[typingIdx] : null;
  // Lines in queue that haven't been reached yet (invisible until typed)
  const pendingCount = typingIdx !== null ? typeQueue.length - typingIdx - 1 : 0;

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', cursor: 'text', background: '#0d1117', borderRadius: '0 0 16px 16px', overflow: 'hidden' }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Output area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 8px', display: 'flex', flexDirection: 'column', gap: '1px' }}>

        {/* Permanent / instant lines */}
        {lines.map(line => {
          if (line.cmd !== undefined) {
            return (
              <div key={line.id} style={{ fontFamily: MONO, fontSize: '13px', lineHeight: '1.7' }}>
                <span style={{ color: '#60a5fa' }}>guest@tejas-os</span>
                <span style={{ color: '#a78bfa' }}>:~$ </span>
                <span style={{ color: '#e2e8f0' }}>{line.cmd}</span>
              </div>
            );
          }
          return (
            <div key={line.id} style={{ fontFamily: MONO, fontSize: '13px', lineHeight: '1.7', color: line.color, whiteSpace: 'pre' }}>
              {line.text}
            </div>
          );
        })}

        {/* Previously typed lines in the current queue */}
        {typingIdx !== null && typeQueue.slice(0, typingIdx).map(line => (
          <div key={line.id} style={{ fontFamily: MONO, fontSize: '13px', lineHeight: '1.7', color: line.color, whiteSpace: 'pre', minHeight: '1.7em' }}>
            {line.text}
          </div>
        ))}

        {/* Currently typing line */}
        {activeLine && (
          <TypewriterLine
            key={activeLine.id}
            text={activeLine.text ?? ''}
            color={activeLine.color}
            instant={!activeLine.text} // blank lines are instant
            onDone={() => handleLineDone(typeQueue, typingIdx)}
          />
        )}

        {/* Spacer so the page height accounts for pending lines (prevents layout jumps) */}
        {pendingCount > 0 && (
          <div style={{ minHeight: `${pendingCount * 1.7 * 13}px` }} />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input line */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 24px 16px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        fontFamily: MONO,
        fontSize: '13px',
        flexShrink: 0
      }}>
        <span style={{ color: '#60a5fa', whiteSpace: 'nowrap' }}>guest@tejas-os</span>
        <span style={{ color: '#a78bfa', whiteSpace: 'nowrap' }}>:~$ </span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#e2e8f0',
            fontFamily: MONO,
            fontSize: '13px',
            caretColor: '#4ade80',
          }}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>
    </div>
  );
}
