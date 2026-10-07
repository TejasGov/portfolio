import './Dock.css';
export default function Dock({ children }) { return <nav className="workspace-dock" aria-label="Workspace tools">{children}</nav>; }
export function DockIcon({ icon, label, ariaLabel, isActive, onClick, pressed }) { return <button className={`dock-item ${isActive ? 'is-active' : ''}`} onClick={onClick} aria-label={ariaLabel || label} aria-pressed={pressed} title={ariaLabel || label}>{icon}<span>{label}</span></button>; }
