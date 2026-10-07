import { useContext, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { RotateCcw, ArrowUpRight } from 'lucide-react';
import { memojiImg } from '../../data';
import { SUMMARY, SECTION_TEXT, SKILLS, MARVEL_TIERS, WISHES } from '../../data/aboutData';
import { WindowActivityContext } from '../../contexts/WindowActivity';
import SiriOrb from '../ui/SiriOrb';
import StreamedText from '../ui/StreamedText';
import './AboutWindow.css';

const TOPICS = [
  { id: 'intro', question: 'Who is Tejas?', text: SUMMARY },
  { id: 'builder', question: 'What kind of builder is he?', text: SECTION_TEXT.builder },
  { id: 'people', question: 'Is he a people person?', text: SECTION_TEXT.people },
  { id: 'fuel', question: 'What keeps him going?', text: SECTION_TEXT.fuel },
  { id: 'cinema', question: 'What does he watch?', text: SECTION_TEXT.cinema },
  { id: 'football', question: 'Football guy?', text: SECTION_TEXT.football },
  { id: 'skills', question: 'What can he build?', text: 'React is home base. Python for machine learning. Figma for design. Here are the tools he reaches for.' },
  { id: 'wishes', question: 'If he had three wishes?', text: 'If I got three wishes, I would choose:' },
];

function AboutTurn({ topic, instant }) {
  const active = useContext(WindowActivityContext);
  const reducedMotion = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const [skip, setSkip] = useState(false);
  const reveal = instant || skip || reducedMotion;
  useEffect(() => {
    if (reveal) { setReady(true); return; }
    if (!active || ready) return;
    const timer = setTimeout(() => setReady(true), 450);
    return () => clearTimeout(timer);
  }, [active, ready, reveal]);
  return <section className="about-turn" aria-label={topic.question}>
    <div className="about-question">{topic.question}</div>
    <div className="about-answer">
      <div className="about-answer-label"><SiriOrb size={24} active={!done && !reveal} /><span>About Tejas</span>{!done && !reveal && <button onClick={() => setSkip(true)}>Show answer</button>}</div>
      {!ready && !reveal ? <p className="about-thinking" role="status">Thinking<span aria-hidden="true">…</span></p> : <>
        <p className="about-answer-text"><StreamedText text={topic.text} instant={reveal} onComplete={() => setDone(true)} /></p>
        {(done || reveal) && <>
          {topic.id === 'intro' && <figure className="about-portrait"><img src="/tejas_about.webp" alt="Tejas Govind" width="1368" height="1824" decoding="async" /><figcaption>Computer Science · University at Buffalo<br />Expected graduation · May 2027</figcaption></figure>}
          {topic.id === 'skills' && <div className="about-skills">{SKILLS.map(group => <div key={group.category}><h3>{group.category}</h3><ul>{group.items.map(skill => <li key={skill}>{skill}</li>)}</ul></div>)}</div>}
          {topic.id === 'cinema' && <details className="about-marvel"><summary>His Marvel rankings</summary><dl>{MARVEL_TIERS.map(group => <div key={group.tier}><dt>{group.tier}</dt><dd>{group.movies.join(' · ')}</dd></div>)}</dl></details>}
          {topic.id === 'football' && <img className="about-football" src="/messi.webp" alt="Lionel Messi" loading="lazy" />}
          {topic.id === 'wishes' && <ol className="about-wishes">{WISHES.map(wish => <li key={wish}>{wish}</li>)}</ol>}
        </>}
      </>}
    </div>
  </section>;
}

export default function AboutWindow() {
  const [turns, setTurns] = useState([{ topic: TOPICS[0], instant: false, key: 0 }]);
  const threadRef = useRef(null);
  const sequence = useRef(0);
  const ask = topic => {
    const key = ++sequence.current;
    setTurns(previous => [...previous.map(turn => ({ ...turn, instant: true })), { topic, instant: false, key }]);
    requestAnimationFrame(() => threadRef.current?.lastElementChild?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  };
  const readAll = () => { setTurns(TOPICS.map(topic => ({ topic, instant: true, key: ++sequence.current }))); requestAnimationFrame(() => { if (threadRef.current) threadRef.current.scrollTop = 0; }); };
  const replay = () => { setTurns([{ topic: TOPICS[0], instant: false, key: ++sequence.current }]); requestAnimationFrame(() => { if (threadRef.current) threadRef.current.scrollTop = 0; }); };
  return <article className="about-profile about-siri" aria-label="About Tejas Govind">
    <header className="about-siri-header"><img src={memojiImg} alt="" /><div><h2>Tejas Govind</h2><p>A little about me.</p></div><button onClick={replay} aria-label="Replay About conversation" title="Replay"><RotateCcw size={16} /></button><button className="about-read-all" onClick={readAll}>Read all</button></header>
    <div className="about-thread" ref={threadRef} tabIndex={0} aria-label="About conversation">{turns.map(turn => <AboutTurn key={turn.key} topic={turn.topic} instant={turn.instant} />)}</div>
    <footer className="about-chat-footer"><p>Ask about Tejas</p><div className="about-prompts">{TOPICS.slice(1).map(topic => <button key={topic.id} onClick={() => ask(topic)}>{topic.question}</button>)}</div><div className="about-footer"><span>Written by Tejas, told a little differently.</span><a href="mailto:tejasgov2005@gmail.com">Get in touch <ArrowUpRight size={12} aria-hidden="true" /></a></div></footer>
  </article>;
}
