import { Cpu } from 'lucide-react';
import { technologies } from '../../data/technologies';

export default function TechStack({ stack }) {
  return <ul className="proj-tech-wrap" aria-label="Technology stack">{stack.split(', ').map(name => {
    const technology = technologies[name];
    return <li key={name} className="proj-tech-tag" title={name}><span className="proj-tech-icon" aria-hidden="true">{technology ? <img src={technology.src} alt="" width="28" height="28" /> : <Cpu size={24} />}</span><span>{technology?.label || name}</span></li>;
  })}</ul>;
}
