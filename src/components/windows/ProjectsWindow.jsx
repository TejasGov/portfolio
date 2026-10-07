import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { projectsData } from '../../data';
import './ProjectsWindow.css';

const hasPublicLink = (link) => /^https?:\/\//i.test(link || '');
const projectNumber = (index) => String(index + 1).padStart(2, '0');

export default function ProjectsWindow() {
  const [selected, setSelected] = useState(0);
  const detailRef = useRef(null);
  const project = projectsData[selected];
  const publicLink = hasPublicLink(project.link);
  const projectDetails = Object.entries(project.info).filter(([label]) =>
    ['Type', 'Domain', 'Backend', 'Frontend', 'Hardware'].includes(label)
  );

  useEffect(() => {
    if (detailRef.current) detailRef.current.scrollTop = 0;
  }, [selected]);

  return (
    <div className="proj-root">
      <aside className="proj-sidebar" aria-label="Project collection">
        <div className="proj-index-heading">
          <span>Projects</span>
          <span className="proj-count">{String(projectsData.length).padStart(2, '0')}</span>
        </div>
        <nav className="proj-sb-list" aria-label="Select a project">
          {projectsData.map((item, index) => (
            <button
              type="button"
              key={item.title}
              className={`proj-sb-row ${selected === index ? 'on' : ''}`}
              aria-pressed={selected === index}
              aria-controls="project-case-study"
              onClick={() => setSelected(index)}
            >
              <span className="proj-sb-icon" style={{ background: item.bg }} aria-hidden="true">{item.emoji}</span>
              <span className="proj-sb-info">
                <span className="proj-sb-name">{item.shortTitle}</span>
                <span className="proj-sb-cat">{item.shortCategory}</span>
              </span>
              <ArrowRight className="proj-sb-arrow" size={15} aria-hidden="true" />
            </button>
          ))}
        </nav>
        <div className="proj-index-footer" aria-hidden="true">
          <span className="proj-dither-mark" />
          <span>{projectsData.length} projects · Tejas Govind</span>
        </div>
      </aside>

      <article
        className="proj-detail"
        id="project-case-study"
        aria-labelledby="project-case-title"
        ref={detailRef}
        tabIndex={0}
      >
        <header className="proj-hero">
          <div className="proj-eyebrow">
            <span>Project {projectNumber(selected)}</span>
            <span className="proj-badge-status">{project.status}</span>
          </div>
          <h2 className="proj-app-name" id="project-case-title">{project.title}</h2>
          <p className="proj-app-cat">{project.category}</p>
          {publicLink && (
            <a
              href={project.link}
              target="_blank"
              rel="noopener noreferrer"
              className="proj-btn-primary"
              aria-label={`Visit ${project.shortTitle} live project (opens in a new tab)`}
            >
              Visit live project <ArrowUpRight size={17} aria-hidden="true" />
            </a>
          )}
        </header>

        <figure className="proj-visual">
          <div className="proj-visual-frame">
            <img src={project.image} alt={`${project.shortTitle} project visual`} width="1024" height="1024" />
          </div>
          <figcaption>
            <span>{project.shortTitle} / Project visual</span>
            <span aria-hidden="true">{projectNumber(selected)} — {String(projectsData.length).padStart(2, '0')}</span>
          </figcaption>
        </figure>

        <section className="proj-section" aria-labelledby="project-overview-title">
          <h3 className="proj-section-title" id="project-overview-title">The project</h3>
          <p className="proj-desc">{project.description}</p>
        </section>

        <section className="proj-section" aria-labelledby="project-stack-title">
          <h3 className="proj-section-title" id="project-stack-title">Built with</h3>
          <ul className="proj-tech-wrap" aria-label="Technology stack">
            {project.tech.split(', ').map((technology) => (
              <li key={technology} className="proj-tech-tag">{technology}</li>
            ))}
          </ul>
        </section>

        <section className="proj-section proj-section-last" aria-labelledby="project-details-title">
          <h3 className="proj-section-title" id="project-details-title">At a glance</h3>
          <dl className="proj-info-grid">
            {[...projectDetails, ['Platform', project.compatibility]].map(([label, value]) => (
              <div key={label} className="proj-info-cell">
                <dt className="proj-info-key">{label}</dt>
                <dd className="proj-info-val">{value}</dd>
              </div>
            ))}
          </dl>
          {!publicLink && <p className="proj-access-note">This project is not publicly available.</p>}
        </section>
      </article>
    </div>
  );
}
