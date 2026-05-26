import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Calendar, Clock, User, Copy, Check } from 'lucide-react';
import { blogArticles } from '../../data';
import './BlogWindow.css';
import FlowArt, { FlowSection } from '../ui/story-scroll';

function CodeBlock({ code, lang }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="blog-code-container">
      <div className="blog-code-header">
        <span>{lang}</span>
        <button className="blog-copy-btn" onClick={handleCopy}>
          {copied ? <Check size={11} /> : <Copy size={11} />}
          <span>{copied ? 'Copied!' : 'Copy Code'}</span>
        </button>
      </div>
      <pre className="blog-code-content">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function BlogWindow({ viewMode }) {
  const [activeArticleId, setActiveArticleId] = useState(null);
  const activeArticle = blogArticles.find((a) => a.id === activeArticleId);
  const scrollRef = useRef(null);

  // Measure the scroll container and pass its pixel height as a CSS variable
  // so each sticky section can match it exactly for the card-deck overlap effect.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const setH = () => {
      el.style.setProperty('--scroll-h', `${el.clientHeight}px`);
    };
    setH();

    const ro = new ResizeObserver(setH);
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewMode, activeArticleId]);

  // Shared article reader — opened from both Pages and Articles views.
  if (activeArticleId && activeArticle) {
    return (
      <div className="blog-root">
        <div className="blog-detail" style={{ width: '100%' }}>
          <div className="blog-reader">
            <button
              className="blog-back-btn"
              onClick={() => setActiveArticleId(null)}
              style={{ marginBottom: '16px' }}
            >
              <ArrowLeft size={13} />
              <span>Back</span>
            </button>

            <div className="blog-reader-meta">
              <span
                className="blog-cat-badge"
                style={{
                  background: `${activeArticle.color}18`,
                  color: activeArticle.color,
                  border: `1px solid ${activeArticle.color}40`,
                }}
              >
                {activeArticle.category}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Clock size={12} /> {activeArticle.readTime}
              </span>
            </div>

            <h1 className="blog-reader-title">{activeArticle.title}</h1>

            <div className="blog-reader-sub-meta">
              <span
                className="blog-reader-author"
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <User size={12} /> {activeArticle.author}
              </span>
              <span>·</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={12} /> {activeArticle.date}
              </span>
            </div>

            <div className="blog-reader-body">
              {activeArticle.content.map((block, index) => {
                if (block.type === 'p')
                  return (
                    <p key={index} className="blog-p">
                      {block.text}
                    </p>
                  );
                if (block.type === 'h2')
                  return (
                    <h2 key={index} className="blog-h2">
                      {block.text}
                    </h2>
                  );
                if (block.type === 'code')
                  return <CodeBlock key={index} code={block.code} lang={block.lang} />;
                return null;
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------- PAGES VIEW -----------
  if (viewMode === 'pages') {
    return (
      <div className="blog-root">
        {/* scrollRef tracks the exact height and passes it to CSS as --scroll-h */}
        <div className="blog-pages-scroll-container" ref={scrollRef}>
          <FlowArt aria-label="Blog pages">
            {blogArticles.map((article, i) => (
              <FlowSection
                key={article.id}
                aria-label={article.title}
                style={{ backgroundColor: article.color, color: '#fff' }}
              >
                {/* Top row: category label + read button side by side */}
                <div className="flow-top-row">
                  <p className="flow-num-label">
                    0{i + 1} — {article.category}
                  </p>
                  <button
                    className="flow-read-btn"
                    onClick={() => setActiveArticleId(article.id)}
                    style={{ '--btn-color': article.color }}
                  >
                    Read Article <span aria-hidden="true">→</span>
                  </button>
                </div>
                <hr className="flow-divider" style={{ borderColor: 'rgba(255,255,255,0.4)' }} />

                {/* Middle: big title + summary */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '16px' }}>
                  <h1 className="flow-heading">{article.title}</h1>
                  <p className="flow-desc">{article.summary}</p>
                </div>

                <hr className="flow-divider" style={{ borderColor: 'rgba(255,255,255,0.4)' }} />

                {/* Bottom: meta */}
                <div className="flow-grid-3col">
                  <div className="flow-grid-item">
                    <p className="flow-item-title">Date</p>
                    <p className="flow-item-desc">{article.date}</p>
                  </div>
                  <div className="flow-grid-item">
                    <p className="flow-item-title">Read Time</p>
                    <p className="flow-item-desc">{article.readTime}</p>
                  </div>
                  <div className="flow-grid-item">
                    <p className="flow-item-title">Author</p>
                    <p className="flow-item-desc">{article.author}</p>
                  </div>
                </div>
              </FlowSection>
            ))}

            {/* Final "Dive in" card */}
            <FlowSection aria-label="End" className="flow-section-join">
              <p className="flow-num-label">
                0{blogArticles.length + 1} — The End
              </p>
              <hr className="flow-divider" style={{ opacity: 0.2 }} />
              <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <h2 className="flow-heading">Dive Into The Code</h2>
              </div>
              <p className="flow-desc">
                Switch to "Articles" view to browse and read all write-ups side by side.
              </p>
            </FlowSection>
          </FlowArt>
        </div>
      </div>
    );
  }

  // ----------- ARTICLES VIEW -----------
  return (
    <div className="blog-root">
      <div className="blog-detail" style={{ width: '100%' }}>
        <div className="blog-articles-grid">
          {blogArticles.map((art) => (
            <div
              key={art.id}
              className="blog-article-card"
              onClick={() => setActiveArticleId(art.id)}
            >
              <div className="blog-card-meta">
                <span
                  className="blog-cat-badge"
                  style={{
                    background: `${art.color}15`,
                    color: art.color,
                    border: `1px solid ${art.color}35`,
                  }}
                >
                  {art.category}
                </span>
                <span className="blog-card-readtime">
                  <Clock size={11} /> {art.readTime}
                </span>
              </div>
              <h2 className="blog-card-title">{art.title}</h2>
              <p className="blog-card-summary">{art.summary}</p>
              <div className="blog-card-footer">
                <span className="blog-card-date">
                  <Calendar size={11} /> {art.date}
                </span>
                <span className="blog-card-arrow">Read →</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
