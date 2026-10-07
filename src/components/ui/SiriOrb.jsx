import './SiriOrb.css';

export default function SiriOrb({ active = false, size = 48 }) {
  return <span className={`siri-orb ${active ? 'is-active' : ''}`} style={{ width: size, height: size }} aria-hidden="true"><span className="siri-orb-light" /><img src="/homepage/aiicon.svg" alt="" /></span>;
}
