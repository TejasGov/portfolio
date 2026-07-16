import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { memojiImg } from '../../data';

const MONO_FONT = "'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace";

/* ─── content ──────────────────────────────────────────────── */

const SUMMARY = "Tejas Govind is a CS student at University at Buffalo building polished, modern, and intelligent web experiences. Passionate about React, machine learning, and design systems that feel alive. The kind of person who finds a problem, can't let it go, and usually ends up building something about it.";

const SECTION_TEXT = {
  builder:  "Tejas doesn't just solve problems. He finds them first. Most builders wait for someone to hand them a brief. He's already two steps ahead wondering why the problem exists in the first place. Whether it's a scrappy jugaad fix that somehow actually works, or something genuinely hard like designing for people with ADHD or Alzheimer's, he keeps ending up in the messy, human, underserved corners that most products haven't bothered to look at. He just really likes thinking, and it doesn't really turn off.",
  people:   "Ask Tejas what he actually enjoys and he'll say: talking to people. Not networking. Talking. He'd rather spend an hour in a real conversation than a week guessing what someone needs. It's probably why he builds the way he does. He can't help but wonder who's on the other side of the screen.",
  fuel:     "Tejas runs on coffee. Specifically, an iced vanilla latte. Always iced. Never negotiable, not even in January. This isn't a casual morning cup situation. It's closer to load-bearing infrastructure for his entire personality. Starbucks knows what they did.",
  cinema:   "It started with Interstellar. One film, and something just broke open. Now he's the person who notices the score before the dialogue, who has actual thoughts about aspect ratios, and who somehow has more Marvel opinions than anyone who got into it late really should.",
  football: "Football isn't a hobby, it's a religion. One club. One GOAT. The math is simple.",
};

const MARVEL_TIERS = [
  { tier: 'S', color: '#ef4444', bg: 'rgba(239,68,68,0.14)',  border: 'rgba(239,68,68,0.35)',  movies: ['Avengers: Endgame', 'Iron Man', 'Infinity War', 'Civil War'] },
  { tier: 'A', color: '#f97316', bg: 'rgba(249,115,22,0.14)', border: 'rgba(249,115,22,0.35)', movies: ['Winter Soldier', 'Thor: Ragnarok', 'No Way Home', 'Guardians Vol. 2'] },
  { tier: 'B', color: '#eab308', bg: 'rgba(234,179,8,0.14)',  border: 'rgba(234,179,8,0.35)',  movies: ['Black Panther', 'Doctor Strange', 'Shang-Chi', 'Ant-Man'] },
  { tier: 'C', color: '#22c55e', bg: 'rgba(34,197,94,0.14)',  border: 'rgba(34,197,94,0.35)',  movies: ['Thor: The Dark World', 'The Marvels', 'Eternals'] },
];

const WISHES = [
  'Free basic food for all',
  'I become the best football player and take India to a FIFA World Cup victory',
  'India gets less polluted and the air gets cleaner for everyone to breathe',
];

const SKILLS = [
  { category: 'frontend', color: '#60a5fa', items: ['React', 'TypeScript', 'JavaScript', 'Tailwind CSS', 'Framer Motion', 'Next.js'] },
  { category: 'ai / ml',  color: '#c084fc', items: ['Python', 'PyTorch', 'LangChain', 'OpenAI API', 'Hugging Face'] },
  { category: 'backend',  color: '#22c55e', items: ['Node.js', 'FastAPI', 'PostgreSQL', 'REST APIs'] },
  { category: 'tools',    color: '#f97316', items: ['Figma', 'Git', 'Vite', 'Docker'] },
];

const TURNS = [
  {
    prompt: "who is tejas?",
    thinking: `okay. who is tejas.\n\ncs at UB. that's the frame. the actual thing is he just builds stuff. not because someone told him to. because he spots something broken and can't really look away.\n\njugaad fixes. designing for ADHD. for alzheimer's. he keeps ending up in the corners most products skip.\n\ntalks to people. actually talks. not networking. probably why his work tends to feel like it was made for a real person.\n\niced vanilla latte. always iced. even in january. apparently non-negotiable.\n\ninterstellar did something to him. now he has thoughts about aspect ratios.\n\nfootball. one club. one goat.\n\nokay. i think i have enough.`,
    responseId: 'intro',
    thinkingSpeed: 9,
  },
  {
    prompt: "what kind of builder is he?",
    thinking: "builder. gravitates toward problems nobody wanted to touch. jugaad mindset — find what works, then make it actually work.",
    responseId: 'builder',
    thinkingSpeed: 13,
  },
  {
    prompt: "is he a people person?",
    thinking: "yeah. real conversations, not networking. you can tell from how he builds.",
    responseId: 'people',
    thinkingSpeed: 13,
  },
  {
    prompt: "what keeps him going day to day?",
    thinking: "coffee. iced vanilla latte. this keeps coming up. apparently it's structural.",
    responseId: 'fuel',
    thinkingSpeed: 13,
  },
  {
    prompt: "what does he care about outside work?",
    thinking: "cinema. interstellar broke something open. now he has aspect ratio opinions and somehow a lot of marvel takes for someone who got into it late.",
    responseId: 'cinema',
    thinkingSpeed: 13,
  },
  {
    prompt: "football guy?",
    thinking: "yes. very settled on this. one club, one goat, no debate.",
    responseId: 'football',
    thinkingSpeed: 13,
  },
  {
    prompt: "what can he actually build?",
    thinking: "react is home base. python for ml. figma for design. let me lay this out.",
    responseId: 'skills',
    thinkingSpeed: 13,
  },
  {
    prompt: "if he got 3 wishes?",
    thinking: "interesting. first instinct is the selfless ones. okay, all three are.",
    responseId: 'wishes',
    thinkingSpeed: 13,
  },
];

/* ─── shared styles ─────────────────────────────────────────── */

const bodyText = {
  color: 'var(--text-main)',
  opacity: 0.78,
  fontSize: '13px',
  lineHeight: '1.8',
  margin: 0,
  maxWidth: '520px',
};

/* ─── primitives ────────────────────────────────────────────── */

function WordStream({ text, speed = 8, onComplete }) {
  const words = useMemo(() => text.split(' '), [text]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (count >= words.length) {
      const id = setTimeout(() => onComplete?.(), 200);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setCount(c => c + 1), speed);
    return () => clearTimeout(id);
  }, [count, words.length, speed]); // eslint-disable-line

  return (
    <span>
      {words.slice(0, count).map((word, i) => (
        <motion.span key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.14 }}>
          {word}{i < words.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </span>
  );
}

function PhotoPlaceholder({ label }) {
  return (
    <div style={{
      marginTop: '14px', width: '220px', height: '140px', borderRadius: '12px',
      border: '1.5px dashed var(--timeline-line)', background: 'var(--card-bg)',
      display: 'flex', flexDirection: 'column', gap: '8px',
      alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-muted)', fontSize: '11px',
    }}>
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.7">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
      {label}
    </div>
  );
}

/* ─── response bodies ────────────────────────────────────────── */

function TextBody({ text, after, onDone }) {
  const [streamed, setStreamed] = useState(false);
  return (
    <>
      <p style={bodyText}>
        <WordStream text={text} onComplete={() => { setStreamed(true); if (!after) onDone?.(); }} />
      </p>
      {streamed && after && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          onAnimationComplete={() => onDone?.()}
        >
          {after}
        </motion.div>
      )}
    </>
  );
}

function IntroBody({ onDone }) {
  const [streamed, setStreamed] = useState(false);
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', border: '1px solid var(--card-border)' }}>
          <img src={memojiImg} alt="Tejas" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Tejas Govind</p>
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', opacity: 0.75 }}>CS @ University at Buffalo</p>
        </div>
      </div>
      <p style={{ ...bodyText, maxWidth: '480px' }}>
        <WordStream text={SUMMARY} onComplete={() => { setStreamed(true); }} />
      </p>
      {streamed && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          onAnimationComplete={() => onDone?.()}
          style={{ marginTop: '16px' }}
        >
          <img src="/tejas_about.webp" alt="Tejas Govind" style={{ width: '160px', borderRadius: '12px', border: '1px solid var(--card-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
        </motion.div>
      )}
    </>
  );
}

function CinemaBody({ onDone }) {
  const [showMarvel, setShowMarvel] = useState(false);
  return (
    <>
      <p style={{ ...bodyText, marginBottom: showMarvel ? '20px' : '0' }}>
        <WordStream text={SECTION_TEXT.cinema} onComplete={() => setShowMarvel(true)} />
      </p>
      {showMarvel && <MarvelBody onDone={onDone} />}
    </>
  );
}

function MarvelBody({ onDone }) {
  useEffect(() => {
    const id = setTimeout(() => onDone?.(), MARVEL_TIERS.length * 140 + 900);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px', maxWidth: '480px',
        background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '14px',
      }}>
        {MARVEL_TIERS.map((row, i) => (
          <motion.div key={row.tier} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.14, duration: 0.3 }}
            style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
              background: row.bg, border: `1px solid ${row.border}`,
              color: row.color, fontWeight: 600, fontSize: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{row.tier}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '2px' }}>
              {row.movies.map(movie => (
                <span key={movie} style={{
                  padding: '3px 10px', borderRadius: '6px',
                  background: 'var(--badge-bg)', border: '1px solid var(--badge-border)',
                  color: 'var(--badge-text)', fontSize: '11.5px', fontWeight: 500,
                }}>{movie}</span>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} transition={{ delay: MARVEL_TIERS.length * 0.14 + 0.3 }}
        style={{ ...bodyText, fontSize: '11.5px', fontStyle: 'italic', marginTop: '10px' }}>
        opinions are strong and non-negotiable.
      </motion.p>
    </div>
  );
}

function SkillsBody({ onDone }) {
  useEffect(() => {
    const id = setTimeout(() => onDone?.(), SKILLS.length * 220 + 800);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '480px' }}>
      {SKILLS.map((group, gi) => (
        <motion.div key={group.category} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gi * 0.18, duration: 0.3 }}>
          <p style={{ fontSize: '11px', color: group.color, margin: '0 0 7px 0', fontWeight: 500, opacity: 0.85, letterSpacing: '0.5px' }}>
            {group.category}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {group.items.map((skill, si) => (
              <motion.span key={skill}
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: gi * 0.18 + si * 0.05, duration: 0.2 }}
                style={{
                  padding: '4px 10px', borderRadius: '7px',
                  background: 'var(--badge-bg)', border: '1px solid var(--badge-border)',
                  color: 'var(--badge-text)', fontSize: '12px', fontWeight: 500,
                }}
              >{skill}</motion.span>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function WishesBody({ onDone }) {
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    if (!showList) return;
    const id = setTimeout(() => onDone?.(), WISHES.length * 160 + 400);
    return () => clearTimeout(id);
  }, [showList, onDone]);

  return (
    <>
      <p style={{ ...bodyText, marginBottom: '12px' }}>
        <WordStream text="If I got 3 wishes I would choose:" onComplete={() => setShowList(true)} />
      </p>
      {showList && (
        <ol style={{ ...bodyText, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {WISHES.map((wish, i) => (
            <motion.li key={wish} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.15, duration: 0.3 }}>
              {wish}
            </motion.li>
          ))}
        </ol>
      )}
    </>
  );
}

function ResponseContent({ id, onDone }) {
  if (id === 'intro')    return <IntroBody onDone={onDone} />;
  if (id === 'cinema')   return <CinemaBody onDone={onDone} />;
  if (id === 'skills')   return <SkillsBody onDone={onDone} />;
  if (id === 'fuel')     return <TextBody text={SECTION_TEXT.fuel} after={<PhotoPlaceholder label="photo loading..." />} onDone={onDone} />;
  if (id === 'football') return <TextBody text={SECTION_TEXT.football} after={<PhotoPlaceholder label="the GOAT loading..." />} onDone={onDone} />;
  if (id === 'wishes')   return <WishesBody onDone={onDone} />;
  return <TextBody text={SECTION_TEXT[id]} onDone={onDone} />;
}

/* ─── thinking block ─────────────────────────────────────────── */

function ThinkingBlock({ text, done, open, onToggle }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div
        onClick={done ? onToggle : undefined}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          marginBottom: open ? '10px' : '0',
          cursor: done ? 'pointer' : 'default', userSelect: 'none',
        }}
      >
        {!done ? (
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: 'var(--text-muted)', display: 'inline-block',
            animation: 'about-pulse 1.4s ease-in-out infinite',
          }} />
        ) : (
          <motion.span
            animate={{ rotate: open ? 0 : -90 }}
            transition={{ duration: 0.2 }}
            style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1, display: 'inline-block' }}
          >▾</motion.span>
        )}
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', opacity: 0.7 }}>
          {done ? 'thought for a moment' : 'thinking...'}
        </span>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            key="tb"
            initial={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ borderLeft: '2px solid var(--timeline-line)', paddingLeft: '16px', paddingBottom: '4px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.95', whiteSpace: 'pre-line', margin: 0, opacity: 0.8 }}>
                {text}
                {!done && (
                  <span style={{
                    display: 'inline-block', width: '6px', height: '0.85em',
                    background: 'var(--text-muted)', marginLeft: '2px',
                    verticalAlign: 'text-bottom', borderRadius: '1px',
                    animation: 'about-blink 0.9s step-end infinite', opacity: 0.6,
                  }} />
                )}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── single conversation turn ───────────────────────────────── */

function Turn({ data, onComplete }) {
  const [promptText, setPromptText] = useState('');
  const [promptDone, setPromptDone] = useState(false);
  const [thinkingText, setThinkingText] = useState('');
  const [thinkingDone, setThinkingDone] = useState(false);
  const [thinkingOpen, setThinkingOpen] = useState(true);
  const [phase, setPhase] = useState('prompt'); // prompt | thinking | response

  // type out prompt
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i++;
      setPromptText(data.prompt.slice(0, i));
      if (i >= data.prompt.length) {
        clearInterval(id);
        setPromptDone(true);
        setTimeout(() => setPhase('thinking'), 380);
      }
    }, 38);
    return () => clearInterval(id);
  }, [data.prompt]);

  // stream thinking
  useEffect(() => {
    if (phase !== 'thinking') return;
    let i = 0;
    const speed = data.thinkingSpeed || 13;
    const id = setInterval(() => {
      i++;
      setThinkingText(data.thinking.slice(0, i));
      if (i >= data.thinking.length) {
        clearInterval(id);
        setTimeout(() => setThinkingDone(true), 300);
        setTimeout(() => setThinkingOpen(false), 750);
        setTimeout(() => setPhase('response'), 1150);
      }
    }, speed);
    return () => clearInterval(id);
  }, [phase, data.thinking, data.thinkingSpeed]);

  return (
    <div style={{ marginBottom: '8px' }}>
      {/* User prompt bubble */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25 }}
          style={{
            padding: '8px 14px',
            background: 'linear-gradient(135deg, rgba(96,165,250,0.1) 0%, rgba(192,132,252,0.08) 100%)',
            border: '1px solid var(--badge-border)',
            borderRadius: '16px 16px 4px 16px',
            maxWidth: '75%',
            fontSize: '13px',
            color: 'var(--text-main)',
            opacity: 0.9,
          }}
        >
          {promptText}
          {!promptDone && (
            <span style={{
              display: 'inline-block', width: '6px', height: '0.85em',
              background: 'var(--text-main)', marginLeft: '2px',
              verticalAlign: 'text-bottom', borderRadius: '1px',
              animation: 'about-blink 0.9s step-end infinite', opacity: 0.35,
            }} />
          )}
        </motion.div>
      </div>

      {/* Thinking block */}
      {(phase === 'thinking' || phase === 'response') && (
        <ThinkingBlock
          text={thinkingText}
          done={thinkingDone}
          open={thinkingOpen}
          onToggle={() => thinkingDone && setThinkingOpen(o => !o)}
        />
      )}

      {/* Response */}
      {phase === 'response' && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <ResponseContent id={data.responseId} onDone={onComplete} />
        </motion.div>
      )}
    </div>
  );
}

/* ─── root ───────────────────────────────────────────────────── */

export default function AboutWindow() {
  const [visibleTurns, setVisibleTurns] = useState(1);

  const showNextTurn = useCallback(() => {
    setTimeout(() => setVisibleTurns(v => Math.min(v + 1, TURNS.length)), 550);
  }, []);

  return (
    <div style={{ minHeight: '100%', padding: '28px 28px 40px', fontFamily: MONO_FONT, overflowY: 'auto' }}>
      <style>{`
        @keyframes about-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes about-pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
      `}</style>

      {TURNS.slice(0, visibleTurns).map((turn, i) => (
        <Turn
          key={turn.prompt}
          data={turn}
          onComplete={i === visibleTurns - 1 ? showNextTurn : undefined}
        />
      ))}
    </div>
  );
}
