import React from 'react';
import { ArrowUpRight, Coffee, Film, Goal } from 'lucide-react';
import './AboutWindow.css';

const SKILLS = [
  { category: 'Interfaces', items: ['React', 'TypeScript', 'JavaScript', 'Next.js', 'Tailwind CSS', 'Framer Motion'] },
  { category: 'AI & machine learning', items: ['Python', 'PyTorch', 'LangChain', 'OpenAI API', 'Hugging Face'] },
  { category: 'Behind the scenes', items: ['Node.js', 'FastAPI', 'PostgreSQL', 'REST APIs'] },
  { category: 'Everyday tools', items: ['Figma', 'Git', 'Vite', 'Docker'] },
];

const INTERESTS = [
  { icon: Coffee, title: 'Always iced.', text: 'An iced vanilla latte, even in January. A daily ritual my girlfriend introduced me to.' },
  { icon: Film, title: 'It started with Interstellar.', text: 'Now I notice the score before the dialogue, have thoughts on aspect ratios, and plenty of Marvel opinions.' },
  { icon: Goal, title: 'Football is personal.', text: 'One club. One GOAT. And a dream of taking India to a World Cup victory.' },
];

const MARVEL_TIERS = [
  { tier: 'S', movies: 'Avengers: Endgame · Iron Man · Infinity War · Civil War' },
  { tier: 'A', movies: 'Winter Soldier · Thor: Ragnarok · No Way Home · Guardians Vol. 2' },
  { tier: 'B', movies: 'Black Panther · Doctor Strange · Shang-Chi · Ant-Man' },
  { tier: 'C', movies: 'Thor: The Dark World · The Marvels · Eternals' },
];

export default function AboutWindow() {
  return (
    <article className="about-profile" aria-label="About Tejas Govind">
      <div className="about-profile-inner">
        <header className="about-intro">
          <div className="about-intro-copy">
            <p className="about-eyebrow">The person behind the pixels</p>
            <h2>Hi, I’m Tejas<span>.</span></h2>
            <p className="about-lead">Curious about people.<br />Compelled to build.</p>
            <p className="about-description">
              I’m a computer science student at the University at Buffalo, building
              thoughtful web experiences with React, machine learning, and a care
              for the details.
            </p>
            <a className="about-contact-link" href="mailto:tejasgov2005@gmail.com">
              Let’s talk <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
          <figure className="about-portrait">
            <img src="/tejas_about.webp" alt="Tejas Govind" width="1368" height="1824" decoding="async" />
            <figcaption>Tejas Govind · Buffalo, NY</figcaption>
          </figure>
        </header>

        <dl className="about-facts">
          <div><dt>Studying</dt><dd>B.S. Computer Science</dd></div>
          <div><dt>At</dt><dd>University at Buffalo</dd></div>
          <div><dt>Expected graduation</dt><dd>May 2027</dd></div>
        </dl>

        <section className="about-section about-approach" aria-labelledby="about-approach-title">
          <div className="about-section-heading">
            <span className="about-section-number" aria-hidden="true">01 /</span>
            <h3 id="about-approach-title">It starts with a real person.</h3>
          </div>
          <div className="about-section-copy">
            <p>
              I tend to find a problem and have a hard time letting it go. Sometimes
              that means a scrappy fix. Sometimes it means exploring how a product
              could better support someone with ADHD or Alzheimer’s.
            </p>
            <p>
              Real conversations shape how I build. I’d rather spend an hour
              understanding someone than a week guessing what they need.
            </p>
          </div>
        </section>

        <section className="about-section" aria-labelledby="about-skills-title">
          <div className="about-section-heading">
            <span className="about-section-number" aria-hidden="true">02 /</span>
            <h3 id="about-skills-title">Tools I reach for.</h3>
          </div>
          <div className="about-skills">
            {SKILLS.map(group => (
              <div className="about-skill-group" key={group.category}>
                <h4>{group.category}</h4>
                <ul aria-label={group.category}>
                  {group.items.map(skill => <li key={skill}>{skill}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="about-section" aria-labelledby="about-interests-title">
          <div className="about-section-heading">
            <span className="about-section-number" aria-hidden="true">03 /</span>
            <h3 id="about-interests-title">Away from the keyboard.</h3>
          </div>
          <div className="about-interests">
            {INTERESTS.map(({ icon: Icon, title, text }) => (
              <div className="about-interest" key={title}>
                <Icon size={21} strokeWidth={1.5} aria-hidden="true" />
                <h4>{title}</h4>
                <p>{text}</p>
              </div>
            ))}
          </div>
          <details className="about-movie-details">
            <summary>For the curious: my Marvel rankings <span aria-hidden="true">+</span></summary>
            <dl>
              {MARVEL_TIERS.map(({ tier, movies }) => (
                <div key={tier}><dt>{tier}<span className="sr-only"> tier</span></dt><dd>{movies}</dd></div>
              ))}
            </dl>
          </details>
          <p className="about-small-wish">
            If I had three wishes: food for everyone, cleaner air in India, and that World Cup.
          </p>
        </section>

        <footer className="about-footer">
          <p>Good things start with a conversation.</p>
          <div>
            <a href="https://github.com/TejasGov" target="_blank" rel="noopener noreferrer" aria-label="GitHub (opens in a new tab)">GitHub <ArrowUpRight size={14} aria-hidden="true" /></a>
            <a href="https://www.linkedin.com/in/tejas-govind-29520a2b2/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn (opens in a new tab)">LinkedIn <ArrowUpRight size={14} aria-hidden="true" /></a>
          </div>
        </footer>
      </div>
    </article>
  );
}
