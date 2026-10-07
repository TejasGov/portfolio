import { useMemo, useRef, useState, useEffect, useId } from 'react';
import { Search, ArrowUpRight } from 'lucide-react';
import { searchIndex } from '../../data';
import OverlayDialog from './OverlayDialog';
import './SpotlightSearch.css';

export default function SpotlightSearch({ isOpen, onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const resultsId = useId();
  const results = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return searchIndex.filter(item => ['projects', 'about', 'work-ex', 'contact', 'blog'].includes(item.id));
    return searchIndex.filter(item => item.title.toLowerCase().includes(value) || item.synonyms.some(term => term.includes(value)));
  }, [query]);
  useEffect(() => { if (isOpen) { setQuery(''); setSelectedIndex(0); } }, [isOpen]);
  const activeIndex = Math.min(selectedIndex, results.length - 1);
  return <OverlayDialog isOpen={isOpen} onClose={onClose} title="Spotlight Search" className="search-dialog" initialFocusRef={inputRef}>
    <div className="search-field"><Search size={18} aria-hidden="true" /><input ref={inputRef} type="search" placeholder="Search Tejas OS" aria-label="Search the portfolio" role="combobox" aria-autocomplete="list" aria-expanded={results.length > 0} aria-controls={resultsId} aria-activedescendant={activeIndex >= 0 ? `${resultsId}-${activeIndex}` : undefined} value={query} onChange={event => { setQuery(event.target.value); setSelectedIndex(0); }} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if (results.length) setSelectedIndex(previous => (previous + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length); }
      if (event.key === 'Enter' && activeIndex >= 0) { event.preventDefault(); onSelect(results[activeIndex].id); }
    }} /></div>
    <p className="search-summary" aria-live="polite">{query.trim() ? `${results.length} ${results.length === 1 ? 'place' : 'places'} to explore` : 'A FEW GOOD PLACES TO START'}</p>
    <ul className="search-results" id={resultsId} role="listbox" aria-label="Portfolio destinations">{results.map((item, index) => <li id={`${resultsId}-${index}`} key={item.id} role="option" aria-selected={index === activeIndex} onMouseEnter={() => setSelectedIndex(index)}><button onClick={() => onSelect(item.id)} tabIndex={-1}><span className="search-result-icon" aria-hidden="true">{item.icon}</span><span>{item.title}</span><ArrowUpRight size={15} aria-hidden="true" /></button></li>)}</ul>
    {!results.length && <div className="search-empty"><p>No matches. There’s more to explore.</p><span>Try “projects”, “photography”, “music” or “contact”.</span></div>}
    <div className="search-footer"><span><kbd>↑ ↓</kbd> navigate <kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div>
  </OverlayDialog>;
}
