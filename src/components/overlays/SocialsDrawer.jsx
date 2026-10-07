import { Instagram, Linkedin, Github, Youtube, PenTool, Database, ArrowUpRight } from 'lucide-react';
import OverlayDialog from './OverlayDialog';
const links = [
  { title: 'GitHub', url: 'https://github.com/TejasGov', icon: Github },
  { title: 'LinkedIn', url: 'https://www.linkedin.com/in/tejas-govind-29520a2b2/', icon: Linkedin },
  { title: 'Instagram', url: 'https://www.instagram.com/tejasgovind_', icon: Instagram },
  { title: 'YouTube', url: 'https://www.youtube.com/@tejasgovind', icon: Youtube },
  { title: 'X / Twitter', url: 'https://x.com/TejasGovin17982', icon: ArrowUpRight },
  { title: 'WordPress', url: 'https://tejasgovind.wordpress.com', icon: PenTool },
  { title: 'Kaggle', url: 'https://www.kaggle.com/tejasgovind', icon: Database },
];
export default function SocialsDrawer({ isOpen, onClose }) {
  return <OverlayDialog isOpen={isOpen} onClose={onClose} title="Socials" description="Find my work and connect with me."><div className="social-links">{links.map(({ title, url, icon: Icon }) => <a className="overlay-row-link" key={title} href={url} target="_blank" rel="noopener noreferrer" aria-label={`${title} (opens in a new tab)`}><Icon size={17} aria-hidden="true" />{title}<ArrowUpRight size={14} aria-hidden="true" /></a>)}</div><p className="overlay-note">All links open in a new tab.</p></OverlayDialog>;
}
