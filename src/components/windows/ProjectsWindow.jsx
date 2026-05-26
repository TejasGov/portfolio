import React, { useState, useEffect } from 'react';
import { projectsData } from '../../data';
import './ProjectsWindow.css';

function Stars({ rating, className }) {
  return (
    <span className={className}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ opacity: i <= Math.round(rating) ? 1 : 0.2 }}>★</span>
      ))}
    </span>
  );
}

export default function ProjectsWindow() {
  const [sel, setSel] = useState(0);
  const [isDark, setIsDark] = useState(() => document.body.classList.contains('dark-mode'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.body.classList.contains('dark-mode'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const p = projectsData[sel];
  const infoEntries = [...Object.entries(p.info), ['Status', p.status], ['Compatibility', p.compatibility]];

  return (
    <div className="proj-root">
      {/* Sidebar */}
      <div className="proj-sidebar">
        <div className="proj-sb-label">My Apps</div>
        <div className="proj-sb-list">
          {projectsData.map((proj, i) => (
            <div
              key={i}
              className={`proj-sb-row ${sel === i ? 'on' : ''}`}
              onClick={() => setSel(i)}
            >
              <div className="proj-sb-icon" style={{ background: proj.bg }}>{proj.emoji}</div>
              <div className="proj-sb-info">
                <div className="proj-sb-name">{proj.shortTitle}</div>
                <div className="proj-sb-cat">{proj.shortCategory}</div>
                <Stars rating={proj.rating} className="proj-sb-stars" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail pane */}
      <div className="proj-detail">
        {/* Hero */}
        <div className="proj-hero">
          <div className="proj-hero-icon" style={{ background: p.bg }}>{p.emoji}</div>
          <div className="proj-hero-info">
            <div className="proj-app-name">{p.title}</div>
            <div className="proj-app-dev" style={{ color: p.color }}>Tejas Govind</div>
            <div className="proj-app-cat">{p.category}</div>
            <div className="proj-rating-row">
              <span className="proj-rating-num">{p.rating}</span>
              <div>
                <Stars rating={p.rating} className="proj-stars-main" />
                <div className="proj-rating-count">{p.ratingCount}</div>
              </div>
            </div>
            <div className="proj-actions">
              {p.link !== '#' ? (
                <a href={p.link} target="_blank" rel="noreferrer" className="proj-btn-primary">↗ Open</a>
              ) : (
                <span className="proj-btn-primary proj-btn-disabled">Not Public</span>
              )}
              <span className="proj-badge-status">{p.status}</span>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="proj-section">
          <div className="proj-section-title">Preview</div>
          <div className="proj-screenshots">
            <div className="proj-screenshot">
              <img src={p.image} alt={p.title} />
            </div>
            {p.screenshots.map((s, i) => (
              <div key={i} className="proj-screenshot proj-screenshot-placeholder" style={{ background: s.bg }}>
                <span className="proj-screenshot-emoji">{p.emoji}</span>
                <div className="proj-screenshot-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="proj-section">
          <div className="proj-section-title">Description</div>
          <p className="proj-desc">{p.description}</p>
        </div>

        {/* What's New */}
        <div className="proj-section">
          <div className="proj-section-title">What's New</div>
          <div className="proj-version">{p.version} · {p.updated}</div>
          <p className="proj-whatsnew">{p.whatsnew}</p>
        </div>

        {/* Tech Stack */}
        <div className="proj-section">
          <div className="proj-section-title">Tech Stack</div>
          <div className="proj-tech-wrap">
            {p.tech.split(', ').map((t, i) => (
              <span key={i} className="proj-tech-tag">{t}</span>
            ))}
          </div>
        </div>

        {/* Information */}
        <div className="proj-section proj-section-last">
          <div className="proj-section-title">Information</div>
          <div className="proj-info-grid">
            {infoEntries.map(([k, v]) => (
              <div key={k} className="proj-info-cell">
                <div className="proj-info-key">{k}</div>
                <div className="proj-info-val">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}