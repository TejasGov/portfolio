import React, { Suspense, useState, useRef, useMemo, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Html, Plane, Sphere } from '@react-three/drei';
import { ExternalLink, X } from 'lucide-react';
import { mySoundArtists } from '../../data/musicData';
import './ArtistGalaxy.css';

/* ──────────────────────────────────────────────
   Starfield — standalone Three scene
   ────────────────────────────────────────────── */
function StarfieldBackground() {
  const mountRef = useRef(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, el.clientWidth / el.clientHeight, 0.1, 2000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1);
    el.appendChild(renderer.domElement);

    const count = 6000;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 2000;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2000;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2000;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, sizeAttenuation: true });
    const stars = new THREE.Points(geo, mat);
    scene.add(stars);
    camera.position.z = 10;

    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      stars.rotation.y += 0.0001;
      stars.rotation.x += 0.00005;
      renderer.render(scene, camera);
    };
    animate();

    const obs = new ResizeObserver(() => {
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    });
    obs.observe(el);

    return () => {
      obs.disconnect();
      cancelAnimationFrame(animId);
      if (el && renderer.domElement && el.contains(renderer.domElement)) {
        el.removeChild(renderer.domElement);
      }
      renderer.dispose();
      geo.dispose();
      mat.dispose();
    };
  }, []);

  return <div ref={mountRef} className="galaxy-starfield" />;
}

/* ──────────────────────────────────────────────
   FloatingCard — transparent Plane hitbox + Html card
   Spread more with higher layerRadius for clean clicking
   ────────────────────────────────────────────── */
function FloatingCard({ artist, position, onSelect }) {
  const meshRef = useRef();
  const groupRef = useRef();
  const [hovered, setHovered] = useState(false);

  useFrame(({ camera }) => {
    if (groupRef.current) groupRef.current.lookAt(camera.position);
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Larger invisible plane so clicks don't miss */}
      <Plane
        ref={meshRef}
        args={[5.5, 7]}
        onClick={(e) => { e.stopPropagation(); onSelect(artist); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
      >
        <meshBasicMaterial transparent opacity={0} />
      </Plane>

      <Html
        transform
        distanceFactor={10}
        position={[0, 0, 0.01]}
        style={{
          transition: 'all 0.3s ease',
          transform: hovered ? 'scale(1.12)' : 'scale(1)',
          pointerEvents: 'none',
        }}
      >
        <div className={`galaxy-card ${hovered ? 'hovered' : ''}`}>
          <img className="galaxy-card-img" src={artist.imageUrl} alt={artist.name} loading="lazy" draggable={false} />
          <p className="galaxy-card-name">{artist.name}</p>
          <p className="galaxy-card-tag">{artist.tag}</p>
        </div>
      </Html>
    </group>
  );
}

/* ──────────────────────────────────────────────
   CardGalaxy — wireframe spheres + spread-out cards
   Higher layerRadius = more space between cards = easier clicking
   ────────────────────────────────────────────── */
function CardGalaxy({ onSelect, isDarkMode }) {
  const cardPositions = useMemo(() => {
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    return mySoundArtists.map((_, i) => {
      const y = 1 - (i / (mySoundArtists.length - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = (2 * Math.PI * i) / goldenRatio;
      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;
      // Larger, uniform radius — all cards at ~14 units, no overlapping layers
      const layerRadius = 14;
      return [x * layerRadius, y * layerRadius * 0.8, z * layerRadius];
    });
  }, []);

  return (
    <>
      <Sphere args={[2, 32, 32]} position={[0, 0, 0]}>
        <meshStandardMaterial color={isDarkMode ? "#1a1a2e" : "#ffffff"} transparent opacity={0.15} wireframe />
      </Sphere>
      <Sphere args={[12, 32, 32]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#31b8c6" transparent opacity={0.05} wireframe />
      </Sphere>
      <Sphere args={[16, 32, 32]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#31b8c6" transparent opacity={0.03} wireframe />
      </Sphere>
      <Sphere args={[20, 32, 32]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#31b8c6" transparent opacity={0.02} wireframe />
      </Sphere>

      {mySoundArtists.map((artist, i) => (
        <FloatingCard
          key={artist.id}
          artist={artist}
          position={cardPositions[i]}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

/* ──────────────────────────────────────────────
   Side Panel — slides in from the right, horizontal layout
   Nothing gets cut off; 3D galaxy shrinks to the left
   ────────────────────────────────────────────── */
function SidePanel({ artist, onClose }) {
  const cardRef = useRef(null);

  if (!artist) return null;

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const rotateX = ((e.clientY - rect.top) - rect.height / 2) / 20;
    const rotateY = (rect.width / 2 - (e.clientX - rect.left)) / 20;
    cardRef.current.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  };

  const handleMouseLeave = () => {
    if (cardRef.current) {
      cardRef.current.style.transition = 'transform 0.4s ease-out';
      cardRef.current.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg)';
    }
  };

  const handleMouseEnter = () => {
    if (cardRef.current) cardRef.current.style.transition = 'none';
  };

  return (
    <div className="galaxy-side-panel">
      <button className="galaxy-side-close" onClick={onClose} aria-label="Close artist detail">
        <X size={18} />
      </button>

      <div
        ref={cardRef}
        className="galaxy-side-card"
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ transformStyle: 'preserve-3d' }}
      >
        <img className="galaxy-side-img" src={artist.imageUrl} alt={artist.name} />
        <h3 className="galaxy-side-name">{artist.name}</h3>
        <p className="galaxy-side-tag">{artist.tag}</p>
        <p className="galaxy-side-desc">{artist.description}</p>
        <a
          href={artist.spotifyUrl}
          target="_blank"
          rel="noreferrer"
          className="galaxy-side-spotify"
        >
          <ExternalLink size={15} strokeWidth={1.8} />
          Open on Spotify
        </a>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   2D Fallback Grid — for mobile / narrow
   ────────────────────────────────────────────── */
function FallbackGrid({ onSelect, selected, onClose }) {
  return (
    <div className="galaxy-grid-layout">
      <div className="galaxy-grid">
        {mySoundArtists.map((artist) => (
          <div
            key={artist.id}
            className={`galaxy-grid-card ${selected?.id === artist.id ? 'active' : ''}`}
            onClick={() => onSelect(artist)}
          >
            <img src={artist.imageUrl} alt={artist.name} />
            <p className="galaxy-grid-card-name">{artist.name}</p>
            <p className="galaxy-grid-card-tag">{artist.tag}</p>
          </div>
        ))}
      </div>

      {selected && (
        <div className="galaxy-grid-detail">
          <button className="galaxy-side-close static" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
          <img className="galaxy-side-img" src={selected.imageUrl} alt={selected.name} />
          <h3 className="galaxy-side-name">{selected.name}</h3>
          <p className="galaxy-side-tag">{selected.tag}</p>
          <p className="galaxy-side-desc">{selected.description}</p>
          <a href={selected.spotifyUrl} target="_blank" rel="noreferrer" className="galaxy-side-spotify">
            <ExternalLink size={15} strokeWidth={1.8} />
            Open on Spotify
          </a>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
   ArtistGalaxy — main export
   ────────────────────────────────────────────── */
export default function ArtistGalaxy() {
  const [selected, setSelected] = useState(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => document.body.classList.contains('dark-mode'));
  const wrapperRef = useRef(null);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.body.classList.contains('dark-mode'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setIsNarrow(entry.contentRect.width < 500);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handleSelect = useCallback((artist) => setSelected(artist), []);
  const handleClose = useCallback(() => setSelected(null), []);

  return (
    <div className="galaxy-wrapper" ref={wrapperRef}>

      {isNarrow ? (
        /* ── 2D mobile grid ── */
        <>
          <div className="galaxy-overlay">
            <h2 className="galaxy-title">Artist Gallery</h2>
            <p className="galaxy-helper">Tap an artist to view details</p>
          </div>
          <div style={{ paddingTop: '64px', height: '100%', overflow: 'auto', background: '#050510' }}>
            <FallbackGrid onSelect={handleSelect} selected={selected} onClose={handleClose} />
          </div>
        </>
      ) : (
        /* ── Desktop: horizontal split ── */
        <div className="galaxy-split">
          {/* Left: 3D canvas area */}
          <div className={`galaxy-canvas-area ${selected ? 'with-panel' : ''}`}>
            <StarfieldBackground />

            <div className="galaxy-overlay">
              <h2 className="galaxy-title">Artist Gallery</h2>
              <p className="galaxy-helper">Drag · Scroll · Click an artist</p>
            </div>

            <Canvas
              className="galaxy-canvas"
              camera={{ position: [0, 0, 18], fov: 60 }}
              style={{ position: 'absolute', inset: 0, zIndex: 10 }}
              onCreated={({ gl }) => { gl.domElement.style.pointerEvents = 'auto'; }}
            >
              <Suspense fallback={null}>
                <Environment preset="night" />
                <ambientLight intensity={0.4} />
                <pointLight position={[10, 10, 10]} intensity={0.6} />
                <pointLight position={[-10, -10, -10]} intensity={0.3} />
                <CardGalaxy onSelect={handleSelect} isDarkMode={isDarkMode} />
                <OrbitControls
                  enablePan={false}
                  enableZoom={true}
                  enableRotate={true}
                  minDistance={8}
                  maxDistance={36}
                  rotateSpeed={0.5}
                  zoomSpeed={1.1}
                />
              </Suspense>
            </Canvas>
          </div>

          {/* Right: side panel — slides in, nothing cut off */}
          {selected && <SidePanel artist={selected} onClose={handleClose} />}
        </div>
      )}
    </div>
  );
}
