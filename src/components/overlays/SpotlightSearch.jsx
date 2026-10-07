import { useMemo, useRef, useState, useEffect, useId } from 'react';
import { Search, Folder } from 'lucide-react';
import { searchIndex } from '../../data';
import OverlayDialog from './OverlayDialog';
import './SpotlightSearch.css';

const descriptions = {
  projects: 'Selected projects by Tejas Govind', about: 'Get to know Tejas',
  'work-ex': 'Work experience and education', photography: 'Photos from my camera roll',
  terminal: 'Explore the portfolio from a command line', 'talk-to-me': 'Ask Orb about Tejas and his work',
  contact: 'Send Tejas an email', blog: 'Notes and writing', 'my-tech': 'My desk and everyday equipment',
  'my-library': 'Books on my shelf', 'my-niche': 'Movies, football, and other favourites', 'my-sound': 'Music and artists on repeat',
};
const folders = new Set(['projects', 'photography', 'my-tech', 'my-library', 'my-niche', 'my-sound']);
const kind = item => folders.has(item.id) ? 'Folder' : 'Application';
const itemIcon = item => folders.has(item.id) ? <Folder fill="#7aceef" stroke="#5badd7" strokeWidth={1.2} /> : item.icon;

export default function SpotlightSearch({ isOpen, onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const resultsId = useId();
  const value = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!value) return [];
    return searchIndex.filter(item => item.title.toLowerCase().includes(value) || item.synonyms.some(term => term.includes(value)))
      .sort((a, b) => Number(b.title.toLowerCase().startsWith(value)) - Number(a.title.toLowerCase().startsWith(value)));
  }, [value]);
  useEffect(() => { if (isOpen) { setQuery(''); setSelectedIndex(0); } }, [isOpen]);
  const activeIndex = Math.min(selectedIndex, results.length - 1);
  const active = results[activeIndex];
  useEffect(() => {
    if (isOpen && activeIndex >= 0) document.getElementById(`${resultsId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen, resultsId, value]);

  return <OverlayDialog isOpen={isOpen} onClose={onClose} title="Spotlight Search" className={`search-dialog ${value ? 'has-query' : ''}`} initialFocusRef={inputRef} hideHeading hideClose>
    <div className="search-field"><Search size={26} strokeWidth={1.8} aria-hidden="true" /><input ref={inputRef} type="search" placeholder="Spotlight Search" aria-label="Search the portfolio" role="combobox" aria-autocomplete="list" aria-expanded={!!active} aria-controls={value ? resultsId : undefined} aria-activedescendant={active ? `${resultsId}-${activeIndex}` : undefined} autoComplete="off" spellCheck={false} value={query} onChange={event => { setQuery(event.target.value); setSelectedIndex(0); }} onKeyDown={event => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === 'Escape' && query) { event.preventDefault(); event.stopPropagation(); setQuery(''); setSelectedIndex(0); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if (results.length) setSelectedIndex(previous => (previous + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length); }
      if (event.key === 'Enter' && active) { event.preventDefault(); onSelect(active.id); }
    }} /><span className="spotlight-return" aria-hidden="true">{active ? '↵' : ''}</span></div>
    {value && <>
      <div className="spotlight-body">
        <div className="spotlight-matches">
          <p className="search-summary">Top Hits</p>
          <ul className="search-results" id={resultsId} role="listbox" aria-label="Portfolio destinations">{results.map((item, index) => <li key={item.id} role="presentation"><button id={`${resultsId}-${index}`} role="option" aria-selected={index === activeIndex} onMouseEnter={() => setSelectedIndex(index)} onClick={() => onSelect(item.id)} tabIndex={-1}><span className={`search-result-icon spotlight-icon-${item.id}`} aria-hidden="true">{itemIcon(item)}</span><span className="spotlight-result-name">{item.title}</span><span className="spotlight-result-kind">{kind(item)}</span></button></li>)}</ul>
          {!results.length && <div className="search-empty"><p>No matches found</p><span>Try “projects”, “photos”, or “contact”.</span></div>}
        </div>
        {active && <aside className="spotlight-preview" aria-label="Selected result preview">
          <span className={`spotlight-preview-icon spotlight-icon-${active.id}`} aria-hidden="true">{itemIcon(active)}</span>
          <h3>{active.title}</h3><p>{kind(active)}</p>
          <div className="spotlight-preview-description">{descriptions[active.id]}</div>
          <button className="spotlight-open" onClick={() => onSelect(active.id)}>Open</button>
        </aside>}
      </div>
      <div className="search-footer"><span>{results.length} {results.length === 1 ? 'result' : 'results'}</span><span><kbd>↑ ↓</kbd> Select <kbd>↵</kbd> Open</span></div>
      <span className="sr-only" role="status">{results.length} results for {query}</span>
    </>}
  </OverlayDialog>;
}
