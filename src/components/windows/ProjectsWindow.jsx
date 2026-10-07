import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { projectsData } from '../../data';
import TechStack from './TechStack';
import ProjectReviews from './ProjectReviews';
import './ProjectsWindow.css';

const hasPublicLink = (link) => /^https?:\/\//i.test(link || '');
const projectNumber = (index) => String(index + 1).padStart(2, '0');
const TYPES = [{ id: 'all', label: 'All' }, { id: 'games', label: 'Games' }, { id: 'ai', label: 'AI & ML' }, { id: 'web', label: 'Web apps' }];

export default function ProjectsWindow() {
  const [selected, setSelected] = useState(projectsData[0].id);
  const [type, setType] = useState('all');
  const filteredProjects = projectsData.filter(item => type === 'all' || item.type === type);
  const chooseType = next => {
    setType(next);
    const matches = projectsData.filter(item => next === 'all' || item.type === next);
    setSelected(previous => matches.some(item => item.id === previous) ? previous : matches[0]?.id || null);
  };
  const detailRef = useRef(null);
  const project = filteredProjects.find(item => item.id === selected) || filteredProjects[0];
  const selectedNumber = projectsData.findIndex(item => item.id === project?.id);
  const publicLink = hasPublicLink(project?.link);
  const publicSource = hasPublicLink(project?.github);
  const liveLabel = project?.linkLabel || 'Visit live project';
  const projectDetails = Object.entries(project?.info || {}).filter(([label]) =>
    ['Type', 'Domain', 'Backend', 'Frontend', 'Hardware', 'Physics'].includes(label)
  );

  useEffect(() => {
    if (detailRef.current) detailRef.current.scrollTop = 0;
  }, [selected]);

  return (
    <div className="proj-root">
      <div className="proj-toolbar"><div className="proj-type-control" role="group" aria-label="Filter projects by type">{TYPES.map(filter => <button key={filter.id} type="button" aria-pressed={type === filter.id} onClick={() => chooseType(filter.id)}>{filter.label}</button>)}</div><span className="proj-filter-count" role="status">{filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'}</span></div>
      <div className="proj-browser">
      <aside className="proj-sidebar" aria-label="Project collection">
        <div className="proj-index-heading">
          <span>Projects</span>
          <span className="proj-count">{String(filteredProjects.length).padStart(2, '0')}</span>
        </div>
        <nav className="proj-sb-list" aria-label="Select a project">
          {filteredProjects.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className={`proj-sb-row ${project?.id === item.id ? 'on' : ''}`}
              aria-pressed={project?.id === item.id}
              aria-controls="project-case-study"
              data-project-id={item.id}
              onClick={() => setSelected(item.id)}
              onKeyDown={event => {
                if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? filteredProjects.length - 1 : Math.max(0, Math.min(filteredProjects.length - 1, index + (['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1)));
                setSelected(filteredProjects[next].id);
                const row = event.currentTarget.closest('nav').querySelectorAll('button')[next];
                row.focus({ preventScroll: true });
                row.scrollIntoView({ block: 'nearest', inline: 'nearest' });
              }}
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
          <span>{filteredProjects.length} projects · Tejas Govind</span>
        </div>
      </aside>

      {project ? <article
        className="proj-detail"
        id="project-case-study"
        aria-labelledby="project-case-title"
        ref={detailRef}
        tabIndex={0}
      >
        <header className="proj-hero">
          <div className="proj-eyebrow">
            <span>Project {projectNumber(selectedNumber)}</span>
            <span className="proj-badge-status">{project.status}</span>
          </div>
          <h2 className="proj-app-name" id="project-case-title">{project.title}</h2>
          <p className="proj-app-cat">{project.category}</p>
          {(publicLink || publicSource) && <div className="proj-actions">{publicLink && (
            <a
              href={project.link}
              target="_blank"
              rel="noopener noreferrer"
              className="proj-btn-primary"
              aria-label={`${liveLabel}: ${project.shortTitle} (opens in a new tab)`}
            >
              {liveLabel} <ArrowUpRight size={17} aria-hidden="true" />
            </a>
          )}{publicSource && <a className="proj-btn-source" href={project.github} target="_blank" rel="noopener noreferrer" aria-label={`View source for ${project.shortTitle} (opens in a new tab)`}>View source <ArrowUpRight size={15} aria-hidden="true" /></a>}</div>}
        </header>

        <figure className="proj-visual">
          <div className="proj-visual-frame" data-image-kind={project.imageKind} style={{ background: project.imageBackground }}>
            <img src={project.image} alt={project.imageAlt || `${project.shortTitle} project visual`} width={project.imageWidth || 1024} height={project.imageHeight || 1024} />
          </div>
          <figcaption>
            <span>{project.imageCaption || `${project.shortTitle} / Project visual`}</span>
            <span aria-hidden="true">{projectNumber(selectedNumber)} — {String(projectsData.length).padStart(2, '0')}</span>
          </figcaption>
        </figure>

        <section className="proj-section" aria-labelledby="project-overview-title">
          <h3 className="proj-section-title" id="project-overview-title">The project</h3>
          <p className="proj-desc">{project.description}</p>
        </section>

        <section className="proj-section" aria-labelledby="project-stack-title">
          <h3 className="proj-section-title" id="project-stack-title">Built with</h3>
          <TechStack stack={project.tech} />
        </section>

        <section className="proj-section" aria-labelledby="project-details-title">
          <h3 className="proj-section-title" id="project-details-title">At a glance</h3>
          <dl className="proj-info-grid">
            {[...projectDetails, ['Platform', project.compatibility]].map(([label, value]) => (
              <div key={label} className="proj-info-cell">
                <dt className="proj-info-key">{label}</dt>
                <dd className="proj-info-val">{value}</dd>
              </div>
            ))}
          </dl>
          {!publicLink && <p className="proj-access-note">{publicSource ? 'Explore the implementation in the public repository.' : 'A public demo is not available.'}</p>}
        </section>
        <ProjectReviews key={project.id} project={project} />
      </article> : <div className="proj-empty" role="status"><h2>No projects of this type yet</h2><p>Choose another type to explore the collection.</p><button className="proj-btn-source" onClick={() => chooseType('all')}>Show all projects</button></div>}
      </div>
    </div>
  );
}
