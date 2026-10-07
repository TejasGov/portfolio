import { Search, ArrowUpRight } from 'lucide-react';
import './TopNavbar.css';
export default function TopNavbar({ onHome, onOpenWindow, onToggleSearch, onContact }) {
  return <header className="site-header"><button className="brand" onClick={onHome} aria-label="Tejas Govind — home"><span className="brand-mark" aria-hidden="true">tg<span>.</span></span><span className="brand-copy">Tejas Govind<span>A PERSONAL SPACE ON THE INTERNET</span></span></button><nav className="header-nav" aria-label="Main navigation"><button onClick={() => onOpenWindow('projects')}>Work</button><button onClick={() => onOpenWindow('about')}>About</button><button onClick={() => onOpenWindow('blog')}>Journal</button></nav><div className="header-actions"><button className="header-search" onClick={onToggleSearch} aria-label="Search the portfolio"><Search size={16} /><kbd>⌘ K</kbd></button><button className="header-contact" onClick={onContact}>Let’s talk <ArrowUpRight size={15} /></button></div></header>;
}
