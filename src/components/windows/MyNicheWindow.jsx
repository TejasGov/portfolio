import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RadialScrollGallery } from '../ui/RadialScrollGallery';
import { MOVIES, SHOWS, GENRE_COLOR } from '../../data/movieData';
import CarShowcaseSection from '../cars/CarShowcaseSection';
import MarvelSection from './MarvelSection';

// ─── IMDb Arrow Button ────────────────────────────────────────────────────────
function ImdbArrow({ href }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      title="View on IMDb"
      style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        background: '#f5c518',   // IMDb yellow
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textDecoration: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        zIndex: 20,
        flexShrink: 0,
        transition: 'transform 0.2s ease, opacity 0.2s ease',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      {/* ↗ arrow SVG */}
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
        <path d="M2.5 9.5L9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="#000" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

// ─── Movie Card ───────────────────────────────────────────────────────────────
function MovieCard({ movie, isHovered }) {
  const accent = GENRE_COLOR[movie.genre] ?? '#aaa';
  return (
    <div style={{
      width: '165px',
      height: '248px',
      borderRadius: '10px',
      overflow: 'hidden',
      position: 'relative',
      boxShadow: isHovered
        ? `0 20px 50px rgba(0,0,0,0.6), 0 0 0 2px ${accent}`
        : '0 6px 24px rgba(0,0,0,0.4)',
      transition: 'box-shadow 0.4s ease',
      flexShrink: 0,
    }}>
      <img src={movie.poster} alt={movie.title} style={{
        width: '100%', height: '100%', objectFit: 'cover', display: 'block',
        transition: 'transform 0.6s ease, filter 0.4s ease',
        transform: isHovered ? 'scale(1.08)' : 'scale(1)',
        filter: isHovered ? 'none' : 'brightness(0.75) saturate(0.8)',
      }} />
      {/* Gradient */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 55%)', pointerEvents: 'none' }} />
      {/* Genre badge */}
      <div style={{
        position: 'absolute', top: '8px', left: '8px',
        background: accent, color: '#000', fontSize: '9px', fontWeight: '700',
        padding: '2px 7px', borderRadius: '20px', letterSpacing: '0.5px', textTransform: 'uppercase',
        opacity: isHovered ? 1 : 0.7, transition: 'opacity 0.3s ease',
      }}>{movie.genre}</div>
      {/* IMDb arrow */}
      <ImdbArrow href={movie.imdb} />
      {/* Title + year */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px', transform: isHovered ? 'translateY(0)' : 'translateY(4px)', transition: 'transform 0.4s ease' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: '#fff', lineHeight: 1.3, marginBottom: '2px' }}>{movie.title}</div>
        <div style={{ width: isHovered ? '100%' : '0%', height: '1.5px', background: accent, transition: 'width 0.4s ease', marginBottom: '3px' }} />
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.55)' }}>{movie.year}</div>
      </div>
    </div>
  );
}

// ─── Show Card (2:3 ratio poster) ────────────────────────────────────────────
function ShowCard({ show }) {
  const [hovered, setHovered] = React.useState(false);
  const accent = GENRE_COLOR[show.genre] ?? '#aaa';
  return (
    <motion.div
      whileHover={{ scale: 1.04, y: -4 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '150px',
        height: '225px',      // 2:3
        borderRadius: '10px',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
        boxShadow: hovered
          ? `0 16px 40px rgba(0,0,0,0.55), 0 0 0 2px ${accent}`
          : '0 4px 18px rgba(0,0,0,0.35)',
        transition: 'box-shadow 0.3s ease',
        cursor: 'pointer',
      }}
    >
      <img src={show.poster} alt={show.title} style={{
        width: '100%', height: '100%', objectFit: 'cover', display: 'block',
        transition: 'transform 0.5s ease, filter 0.35s ease',
        transform: hovered ? 'scale(1.08)' : 'scale(1)',
        filter: hovered ? 'none' : 'brightness(0.7) saturate(0.75)',
      }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 60%)', pointerEvents: 'none' }} />
      {/* Genre badge */}
      <div style={{
        position: 'absolute', top: '7px', left: '7px',
        background: accent, color: '#000', fontSize: '8px', fontWeight: '700',
        padding: '2px 6px', borderRadius: '20px', letterSpacing: '0.4px', textTransform: 'uppercase',
      }}>{show.genre}</div>
      {/* IMDb arrow */}
      <ImdbArrow href={show.imdb} />
      {/* Title */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '7px' }}>
        <div style={{ fontSize: '10px', fontWeight: '700', color: '#fff', lineHeight: 1.3 }}>{show.title}</div>
        <div style={{ width: hovered ? '100%' : '0%', height: '1.5px', background: accent, transition: 'width 0.35s ease', marginTop: '3px' }} />
      </div>
    </motion.div>
  );
}

// ─── Genre Filter Pills ───────────────────────────────────────────────────────
function GenrePills({ genres, active, onSelect }) {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '7px',
      justifyContent: 'center',
      padding: '0 16px 4px',
    }}>
      {/* "All" pill */}
      <button
        onClick={() => onSelect(null)}
        style={{
          border: 'none',
          cursor: 'pointer',
          padding: '5px 14px',
          borderRadius: '999px',
          fontSize: '11px',
          fontWeight: '700',
          letterSpacing: '0.4px',
          transition: 'all 0.2s ease',
          background: active === null ? 'var(--text-main)' : 'var(--badge-bg)',
          color: active === null ? 'var(--bg-color)' : 'var(--text-muted)',
          boxShadow: active === null ? '0 2px 12px rgba(0,0,0,0.25)' : 'none',
          backdropFilter: 'blur(8px)',
        }}
      >
        All
      </button>
      {genres.map(genre => {
        const accent = GENRE_COLOR[genre] ?? '#aaa';
        const isActive = active === genre;
        return (
          <button
            key={genre}
            onClick={() => onSelect(isActive ? null : genre)}
            style={{
              border: isActive ? `1.5px solid ${accent}` : '1.5px solid transparent',
              cursor: 'pointer',
              padding: '4px 13px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '0.4px',
              transition: 'all 0.2s ease',
              background: isActive ? accent + '28' : 'var(--badge-bg)',
              color: isActive ? accent : 'var(--text-muted)',
              boxShadow: isActive ? `0 0 12px ${accent}44` : 'none',
              backdropFilter: 'blur(8px)',
            }}
          >
            {genre}
          </button>
        );
      })}
    </div>
  );
}

// ─── Movies View ─────────────────────────────────────────────────────────────
function MoviesView() {
  const [scrollerEl, setScrollerEl] = React.useState(null);
  const [activeGenre, setActiveGenre] = React.useState(null);

  // Derive sorted unique genres from MOVIES + SHOWS combined
  const allGenres = React.useMemo(() => {
    const set = new Set([...MOVIES.map(m => m.genre), ...SHOWS.map(s => s.genre)]);
    return [...set].sort();
  }, []);

  const filteredMovies = React.useMemo(
    () => activeGenre ? MOVIES.filter(m => m.genre === activeGenre) : MOVIES,
    [activeGenre]
  );
  const filteredShows = React.useMemo(
    () => activeGenre ? SHOWS.filter(s => s.genre === activeGenre) : SHOWS,
    [activeGenre]
  );

  // scrollDuration scales with card count so rotation feels consistent
  const movieScrollDuration = React.useMemo(
    () => Math.max(1500, filteredMovies.length * 280),
    [filteredMovies.length]
  );

  // For small counts, use angleStep to keep cards close together;
  // for large counts, fall back to full-circle layout (angleStep = null)
  const FULL_CIRCLE_THRESHOLD = 7; // below this, use fixed angular spacing
  const CARD_ANGLE_DEG = 32;       // degrees between adjacent cards

  const movieAngleStep = React.useMemo(
    () => filteredMovies.length < FULL_CIRCLE_THRESHOLD ? CARD_ANGLE_DEG : null,
    [filteredMovies.length]
  );

  // Radius: tight for tiny sets, bigger for large sets
  const movieRadius = React.useMemo(
    () => filteredMovies.length < FULL_CIRCLE_THRESHOLD
      ? Math.max(280, filteredMovies.length * 60)   // compact layout
      : Math.max(500, filteredMovies.length * 28),   // full-circle layout
    [filteredMovies.length]
  );

  // Stop wheel events from bubbling to Framer Motion's window drag handler
  useEffect(() => {
    if (!scrollerEl) return;
    const stop = (e) => e.stopPropagation();
    scrollerEl.addEventListener('wheel', stop, { passive: true });
    return () => scrollerEl.removeEventListener('wheel', stop);
  }, [scrollerEl]);

  return (
    <div
      ref={setScrollerEl}
      style={{ flex: 1, overflowY: 'auto', position: 'relative' }}
    >
      {/* ── Genre filter bar (sticky at top) ─────────────────────── */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        paddingTop: '10px',
        paddingBottom: '8px',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: 'var(--navbar-bg)',
        borderBottom: '1px solid var(--navbar-border)',
      }}>
        <GenrePills genres={allGenres} active={activeGenre} onSelect={setActiveGenre} />
      </div>

      {/* ── Radial gallery ─────────────────────────────────────────── */}
      {filteredMovies.length > 0 ? (
        <RadialScrollGallery
          key={`movies-${activeGenre}`}   /* re-mount when filter changes so GSAP re-initialises */
          scroller={scrollerEl}
          radius={movieRadius}
          scrollDuration={movieScrollDuration}
          angleStep={movieAngleStep}
          visiblePercentage={50}
          startTrigger="top top"
          onItemSelect={(i) => console.log('selected', filteredMovies[i].title)}
          header={
            <div style={{
              height: '100px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}>
              <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                My Picks
              </div>
              <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-1px' }}>
                {activeGenre ? `${activeGenre} Movies` : 'Movies'}
              </div>
              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                style={{ fontSize: '12px', color: 'var(--text-muted)' }}
              >
                ↓ Scroll to spin
              </motion.div>
            </div>
          }
        >
          {(hoveredIndex) =>
            filteredMovies.map((movie, i) => (
              <MovieCard key={movie.title} movie={movie} isHovered={hoveredIndex === i} />
            ))
          }
        </RadialScrollGallery>
      ) : (
        <div style={{ height: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: 0.45 }}>
          <div style={{ fontSize: '36px' }}>🎬</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>No movies in this genre yet</div>
        </div>
      )}

      {/* ─── Shows Section ──────────────────────────────────────────── */}
      {filteredShows.length > 0 && (
        <div style={{ padding: '24px 24px 40px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', marginBottom: '24px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>My Picks</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-1px' }}>
              {activeGenre ? `${activeGenre} Shows` : 'Shows'}
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', justifyContent: 'center' }}>
            {filteredShows.map((show) => <ShowCard key={show.title} show={show} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Cars Data ────────────────────────────────────────────────────────────────
const ACTUAL_CARS = [
  { name: 'Ferrari F8 Tributo', img: '/cars/ferrari.png', tag: 'Italy · V8 Biturbo · 710 hp' },
  { name: 'Mercedes-AMG G63',   img: '/cars/g63.png',     tag: 'Germany · V8 Biturbo · 577 hp' },
  { name: 'Lamborghini Aventador', img: '/cars/lambo.png', tag: 'Italy · V12 NA · 769 hp' },
];

const CARS = Array.from({ length: 25 }).map((_, i) => {
  if (i < ACTUAL_CARS.length) return { ...ACTUAL_CARS[i], placeholder: false };
  return { name: 'Coming Soon', img: '', tag: `Slot ${i + 1}`, placeholder: true };
});

function CarCard({ car, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.5) }}
      whileHover={{ scale: 1.04, y: -4 }}
      style={{
        width: '200px',
        background: car.placeholder ? 'rgba(255,255,255,0.03)' : 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: '14px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        cursor: car.placeholder ? 'default' : 'pointer',
        opacity: car.placeholder ? 0.22 : 1,
        boxShadow: car.placeholder ? 'none' : '0 4px 20px rgba(0,0,0,0.15)',
        flexShrink: 0,
      }}
    >
      {car.img ? (
        <img src={car.img} alt={car.name} style={{ width: '100%', height: '110px', objectFit: 'contain', borderRadius: '8px' }} />
      ) : (
        <div style={{ width: '100%', height: '110px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>🚗</div>
      )}
      <div>
        <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-main)', marginBottom: '3px' }}>{car.name}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{car.tag}</div>
      </div>
    </motion.div>
  );
}

function CarsScrollArea({ cars }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = (e) => e.stopPropagation();
    el.addEventListener('wheel', stop, { passive: true });
    return () => el.removeEventListener('wheel', stop);
  }, []);
  return (
    <div ref={ref} style={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', alignContent: 'flex-start', justifyContent: 'flex-start', gap: '16px', overflowY: 'auto', padding: '20px 20px 32px' }}>
      {cars.map((car, i) => <CarCard key={i} car={car} index={i} />)}
    </div>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────
export default function MyNicheWindow({ viewMode }) {
  const carsScrollerRef = React.useRef(null);
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <AnimatePresence mode="wait">

        {viewMode === 'movies' && (
          <motion.div key="movies"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
          >
            <MoviesView />
          </motion.div>
        )}

        {viewMode === 'cars' && (
          <motion.div key="cars"
            ref={carsScrollerRef}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
          >
            <CarShowcaseSection scrollerEl={carsScrollerRef} />
          </motion.div>
        )}

        {viewMode === 'marvel' && (
          <motion.div key="marvel"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
          >
            <MarvelSection />
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
