import React, { useState } from 'react';
import { Search, Home, Disc3, Mic2, Music, ExternalLink } from 'lucide-react';
import ArtistGalaxy from './ArtistGalaxy';
import './MusicWindow.css';

const NAV = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'artists', label: 'Artists', icon: Mic2 },
];

export default function MusicWindow() {
  const [active, setActive] = useState('home');

  return (
    <div className="music-window">
      {/* ── Sidebar ── */}
      <aside className="music-sidebar">
        <div className="music-search-bar">
          <Search size={13} strokeWidth={2.5} />
          <span>Search</span>
        </div>

        <nav className="music-nav">
          <p className="music-section-label">Library</p>
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`music-nav-item ${active === id ? 'active' : ''}`}
              onClick={() => setActive(id)}
            >
              <Icon size={15} strokeWidth={2.2} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Main ── */}
      <main className="music-main" style={active === 'artists' ? { padding: 0, overflow: 'hidden' } : undefined}>
        {active === 'home' ? (
          <div className="music-spotify-container">
            <div className="music-spotify-header">
              <h2 className="music-spotify-title">My Sound</h2>
              <p className="music-spotify-subtitle">
                A curated sneak-peek into what I listen to while building, designing, and working.
              </p>
            </div>

            <div className="music-iframe-wrapper">
              <iframe
                title="Spotify Playlist Embed"
                style={{ borderRadius: '12px' }}
                src="https://open.spotify.com/embed/playlist/0TILaGSWrpojpLME9Z64Pv?utm_source=generator&theme=0"
                width="100%"
                height="100%"
                frameBorder="0"
                allowFullScreen=""
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy">
              </iframe>
            </div>

            <div className="music-spotify-footer">
              <p className="music-spotify-note">Listen through Spotify's Web API.</p>
              <a
                href="https://open.spotify.com/playlist/0TILaGSWrpojpLME9Z64Pv"
                target="_blank"
                rel="noreferrer"
                className="music-spotify-button"
              >
                Open on Spotify
                <ExternalLink size={14} strokeWidth={2.5} />
              </a>
            </div>
          </div>
        ) : active === 'artists' ? (
          <ArtistGalaxy />
        ) : (
          <div className="music-coming-soon">
            <span className="music-coming-soon-icon">
              {active === 'albums' ? '💿' : '🎵'}
            </span>
            <p className="music-coming-soon-title">
              {NAV.find((n) => n.id === active)?.label}
            </p>
            <p className="music-coming-soon-sub">Coming soon</p>
          </div>
        )}
      </main>
    </div>
  );
}
