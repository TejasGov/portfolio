import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Instagram, Linkedin, Github, Youtube, PenTool, Database } from 'lucide-react';

/* ── Brand color config per social ── */
const BRANDS = {
  instagram: {
    bg: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
    iconColor: '#C13584',
    border: 'rgba(193, 53, 132, 0.38)',
    glow: 'rgba(193, 53, 132, 0.28)',
  },
  linkedin: {
    bg: '#0077B5',
    iconColor: '#0077B5',
    border: 'rgba(0, 119, 181, 0.38)',
    glow: 'rgba(0, 119, 181, 0.32)',
  },
  github: {
    bg: '#7C3AED',
    iconColor: '#7C3AED',
    border: 'rgba(124, 58, 237, 0.38)',
    glow: 'rgba(124, 58, 237, 0.3)',
  },
  youtube: {
    bg: '#FF0000',
    iconColor: '#e00',
    border: 'rgba(255, 0, 0, 0.35)',
    glow: 'rgba(255, 0, 0, 0.28)',
  },
  x: {
    bg: '#14171A',
    iconColor: '#14171A',
    border: 'rgba(0, 0, 0, 0.28)',
    glow: 'rgba(0, 0, 0, 0.22)',
  },
  wordpress: {
    bg: '#0073AA',
    iconColor: '#0073AA',
    border: 'rgba(0, 115, 170, 0.38)',
    glow: 'rgba(0, 115, 170, 0.3)',
  },
  kaggle: {
    bg: '#20BEFF',
    iconColor: '#0099CC',
    border: 'rgba(32, 190, 255, 0.38)',
    glow: 'rgba(32, 190, 255, 0.32)',
  },
};

const ICON_SIZE = 28;

function DrawerIcon({ icon, animatedIcon, animatedScale = 1.55, label, link, brand }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.a
      href={link}
      target="_blank"
      rel="noreferrer"
      whileHover={{ scale: 1.08, y: -3 }}
      whileTap={{ scale: 0.91 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        textDecoration: 'none',
      }}
    >
      {/* Icon tile */}
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          background: 'var(--card-bg)',
          border: `1px solid ${hovered ? brand.border : 'var(--card-border)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: hovered
            ? `0 10px 24px ${brand.glow}, 0 2px 8px rgba(0,0,0,0.08)`
            : '0 4px 12px rgba(0,0,0,0.08)',
          transition: 'box-shadow 0.25s ease, border-color 0.22s ease',
        }}
      >
        {/* Brand color/gradient overlay at ~18% opacity */}
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            background: brand.bg,
            pointerEvents: 'none',
          }}
          animate={{ opacity: hovered ? 0.18 : 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        />

        <div style={{ position: 'relative', width: ICON_SIZE, height: ICON_SIZE, zIndex: 1, flexShrink: 0 }}>
          {/* Default-colored icon */}
          <motion.div
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--dock-icon-color)',
            }}
            animate={{ opacity: hovered ? 0 : 1 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {icon}
          </motion.div>

          {/* Brand-colored / Animated icon */}
          <motion.div
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: brand.iconColor,
            }}
            animate={{ opacity: hovered ? 1 : 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {/* By conditionally rendering the img tag with a key based on hover, 
                it forces the browser to restart the SVG SMIL animation from 0s. */}
            {animatedIcon ? (
              hovered ? (
                <img key="anim-hover" src={animatedIcon} alt={label} style={{ width: '100%', height: '100%', transform: `scale(${animatedScale})` }} />
              ) : (
                <img key="anim-idle" src={animatedIcon} alt={label} style={{ width: '100%', height: '100%', transform: `scale(${animatedScale})` }} />
              )
            ) : (
              icon
            )}
          </motion.div>
        </div>
      </div>

      {/* Label */}
      <span
        style={{
          fontSize: '12px',
          fontWeight: '500',
          color: hovered ? brand.iconColor : 'var(--text-main)',
          transition: 'color 0.22s ease',
        }}
      >
        {label}
      </span>
    </motion.a>
  );
}

export default function SocialsDrawer({ isOpen, onClose }) {
  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="socials-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 900,
              backdropFilter: 'blur(2px)',
              backgroundColor: 'rgba(0,0,0,0.05)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="socials-panel"
            initial={{ opacity: 0, y: 50, scale: 0.95, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, y: 50, scale: 0.95, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="glass-panel"
            style={{
              position: 'absolute',
              bottom: '120px',
              left: '50%',
              zIndex: 950,
              padding: '24px',
              borderRadius: '24px',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '24px',
              width: 'max-content',
              border: '1px solid var(--glass-border)',
              boxShadow: 'var(--glass-shadow)',
            }}
          >
            <DrawerIcon
              icon={<Instagram size={ICON_SIZE} />}
              animatedIcon="/socials/instagram.svg"
              label="Instagram"
              link="https://www.instagram.com/tejasgovind_"
              brand={BRANDS.instagram}
            />
            <DrawerIcon
              icon={<Linkedin size={ICON_SIZE} />}
              animatedIcon="/socials/linkedin.svg"
              animatedScale={2.0}
              label="LinkedIn"
              link="https://www.linkedin.com/in/tejas-govind-29520a2b2/"
              brand={BRANDS.linkedin}
            />
            <DrawerIcon
              icon={<Github size={ICON_SIZE} />}
              animatedIcon="/socials/git.svg"
              label="GitHub"
              link="https://github.com/TejasGov"
              brand={BRANDS.github}
            />
            <DrawerIcon
              icon={<Youtube size={ICON_SIZE} />}
              animatedIcon="/socials/Youtube.svg"
              animatedScale={2.0}
              label="YouTube"
              link="https://www.youtube.com/@tejasgovind"
              brand={BRANDS.youtube}
            />
            <DrawerIcon
              icon={
                <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.858L1.671 2.25H8.08l4.253 5.622L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
                </svg>
              }
              animatedIcon="/socials/X.svg"
              label="X"
              link="https://x.com/TejasGovin17982"
              brand={BRANDS.x}
            />
            <DrawerIcon
              icon={<PenTool size={ICON_SIZE} />}
              label="WordPress"
              link="https://tejasgovind.wordpress.com"
              brand={BRANDS.wordpress}
            />
            <DrawerIcon
              icon={<Database size={ICON_SIZE} />}
              label="Kaggle"
              link="https://www.kaggle.com/tejasgovind"
              brand={BRANDS.kaggle}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
