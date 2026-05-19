import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup, useMotionValue, useTransform, useSpring, useDragControls, useAnimation } from 'framer-motion';
import { Mail, Github, Linkedin, Instagram, FileText, Sun, Moon, Globe, Youtube, Twitter, PenTool, Database, Command, Battery, Wifi, Search, SlidersHorizontal, Mic, Volume2, Grid3X3, Layers, LayoutList } from 'lucide-react';
import memojiImg from './img/memoji.png';

import photo1 from './img/1.jpg';
import photo2 from './img/2.jpg';
import photo3 from './img/3.jpg';
import photo4 from './img/4.jpeg';
import photo5 from './img/5.jpeg';
import photo6 from './img/6.jpeg';
import photo7 from './img/7.jpeg';
import photo8 from './img/8.jpeg';
import photo9 from './img/9.jpeg';
import photo10 from './img/10.jpeg';
import photo11 from './img/11.jpeg';
import photo12 from './img/12.jpeg';
import photo13 from './img/13.jpeg';
import photo14 from './img/14.jpeg';
import photo15 from './img/15.jpeg';
import photo16 from './img/16.jpeg';
import photo17 from './img/17.jpeg';
import photo18 from './img/18.jpeg';
import photo19 from './img/19.jpeg';
import photo20 from './img/20.jpeg';
import photo21 from './img/21.jpeg';
import photo22 from './img/22.jpeg';

const desktopItems = [
  {
    id: "projects",
    title: "Projects",
    color: "linear-gradient(135deg, #FF9A9E 0%, #FECFEF 99%, #FECFEF 100%)",
    x: '15vw',
    y: '20vh',
  },
  {
    id: "work-ex",
    title: "Work Ex.",
    color: "linear-gradient(120deg, #84FAB0 0%, #8FD3F4 100%)",
    x: '65vw',
    y: '35vh',
  },
  {
    id: "photography",
    title: "Photography",
    color: "linear-gradient(120deg, #A1C4FD 0%, #C2E9FB 100%)",
    x: '40vw',
    y: '60vh',
  }
];

// Content Data
const projectsData = [
  {
    title: "Smash Cricket Project",
    tech: "Python, OpenCV, MediaPipe, NumPy, Flask",
    bullets: [
      "Built a Python-based game that simulates hand cricket using a webcam to detect hand gestures (1-6 fingers) and implemented a full stack version of it using TypeScript and React and deployed it on Vercel.",
      "Utilized Mediapipe for accurate hand landmark detection and OpenCV for real-time video processing; used NumPy for numerical operations."
    ],
    image: "/smash.png",
    link: "https://smash-cricket.vercel.app/"
  },
  {
    title: "Multimodal Cognitive Support System",
    tech: "Python, LLaMA-3, YOLOv8, XGBoost, Google Cloud",
    bullets: [
      "Architected a multimodal machine learning pipeline to assist users with ADHD by predicting task abandonment risks in real-time, focusing on enterprise level scalability.",
      "Integrated LLaMA-3-8B to perform semantic task analysis, and generate complexity score.",
      "Deployed YOLOv8 and MediaPipe Face Mesh for real-time computer vision analysis, detecting behavioral cues such as gaze direction and fatigue with <2s system latency."
    ],
    image: "/cognitive.png",
    link: "#"
  },
  {
    title: "Revere - Wearable AI for Alzheimer's Care",
    tech: "Python, Gemini 2.0 Flash API, Raspberry Pi, NextJS",
    bullets: [
      "Smart glasses prototype that performs real-time facial recognition and delivers audio relationship prompts to reduce patient distress, using a multimodal pipeline on a Raspberry Pi Zero 2 W with I2S audio output.",
      "Implemented proactive wandering detection to discreetly alert the caregivers addressing a leading cause of injury among the 6M+ Americans with Alzheimer's.",
      "Developed a Higgsfield and Veo scroll scrub inspired website powered by GSAP and WebGL for caregiver's web dashboard and main landing page."
    ],
    image: "/revere.png",
    link: "#"
  }
];

const workData = [
  {
    company: "University at Buffalo",
    role: "Community Volunteer",
    date: "Feb 2026 - Present",
    shortMonth: "Feb",
    shortYear: "2026",
    location: "Buffalo, New York, United States · On-site",
    bullets: [
      "Engaged in non-clinical volunteering at Seneca Street CDC, collaborating with the UB Pre-Dental Association.",
      "Assisted children in community growth initiatives, enhancing their social exposure and development."
    ],
    skills: "Community Outreach, Community Service and +1 skill"
  },
  {
    company: "University at Buffalo Libraries",
    role: "Student Assistant",
    date: "Aug 2025 - Present",
    shortMonth: "Aug",
    shortYear: "2025",
    location: "Buffalo, New York, United States · On-site",
    bullets: [],
    skills: "Time Management, Communication and +1 skill"
  },
  {
    company: "University at Buffalo Athletics",
    role: "Campus Outreach Student Assistant",
    date: "Jul 2025 - Present",
    shortMonth: "Jul",
    shortYear: "2025",
    location: "Buffalo, New York, United States · On-site",
    bullets: [
      "Represented UB Recreation at tabling events and fairs, promoting programs and services.",
      "Engaged with over 800 students on campus to answer questions and encourage participation.",
      "Collaborated with team members and supervisors to ensure smooth operations"
    ],
    skills: "Communication, Leadership, +2 skills"
  },
  {
    company: "MedTourEasy",
    role: "Data Analyst Trainee",
    date: "Jun 2025",
    shortMonth: "Jun",
    shortYear: "2025",
    location: "Remote",
    bullets: [
      "Worked on the project “Analysis of Chemical Components” using real-world datasets.",
      "Performed data cleaning & wrangling with Excel and SQL.",
      "Created visualizations and dashboards in Tableau and Google Data Studio.",
      "Conducted exploratory data analysis (EDA) to extract actionable insights.",
      "Strengthened skills in data-driven decision making, collaboration, and reporting."
    ],
    skills: "SQL and Google Sheets"
  },
  {
    company: "UB College of Arts and Sciences",
    role: "Undergraduate Research Assistant",
    date: "Feb 2025 - Present",
    shortMonth: "Feb",
    shortYear: "2025",
    location: "Buffalo, New York, United States · On-site",
    bullets: [
      "Researching using virtual reality(VR) to study how immersive media affects morality and behavior.",
      "Investigating how media influences ethical decision-making and social attitudes.",
      "Analyzing behavioral patterns across different age groups to understand generational differences."
    ],
    skills: "Virtual Reality (VR), Media Psychology and +2 skills"
  },
  {
    company: "University at Buffalo Athletics",
    role: "Student Assistant",
    date: "Jan 2025 - Present",
    shortMonth: "Jan",
    shortYear: "2025",
    location: "Buffalo, New York, United States · On-site",
    bullets: [
      "Conducted routine inspections and reported maintenance issues to ensure user safety.",
      "Enforced facility policies and procedures to uphold safety and maintain a respectful environment.",
      "Collaborated with fellow staff members to enhance the overall experience for patrons.",
      "Managed peak-hour traffic and resolved conflicts with calmness and professionalism.",
      "Maintained detailed records of equipment usage and incidents, supporting administrative reporting",
      "Trained new student employees on gym protocols, safety guidelines, and customer service."
    ],
    skills: "Communication, Customer Service, +5 skills"
  },
  {
    company: "UB Campus Dining & Shops",
    role: "Student Assistant",
    date: "Sep 2024 - Dec 2024",
    shortMonth: "Sep",
    shortYear: "2024",
    location: "Buffalo, New York, United States · On-site",
    bullets: [
      "Assisted customers with transactions in UB’s busiest dining hall, serving over 800 students nightly.",
      "Efficiently processed cash, credit, and meal plan payments with speed and accuracy.",
      "Delivered friendly, high-quality customer service in a fast-paced, high-pressure setting.",
      "Maintained cleanliness and organization of the workstation in compliance with food safety standards.",
      "Collaborated with team members to ensure smooth service during peak hours."
    ],
    skills: "Customer Service, Conflict Resolution and +4 skills"
  },
  {
    company: "Clean Campus",
    role: "Social Media & Marketing Head",
    date: "Apr 2024 - Present",
    shortMonth: "Apr",
    shortYear: "2024",
    location: "Buffalo, New York, United States · Hybrid",
    bullets: [
      "Led social media strategy and content creation for the Clean Campus initiative.",
      "Managed and scheduled posts across Instagram, Facebook, and LinkedIn.",
      "Designed graphics using Canva and wrote captions to promote sustainability and cleanliness.",
      "Increased engagement through interactive posts, reels, and campaigns.",
      "Monitored analytics to refine content strategy and boost reach and increased outreach by 125%.",
      "Collaborated with other student groups for cross-promotion."
    ],
    skills: "Canva, Video Editing and +6 skills"
  },
  {
    company: "Sunflower Association",
    role: "Co-Founder",
    date: "May 2022 - Present",
    shortMonth: "May",
    shortYear: "2022",
    location: "Prayagraj, Uttar Pradesh, India · Hybrid",
    bullets: [
      "Conducted various events like food distribution, health care packages distributions, used clothes distribution, etc. for a social cause across the city."
    ],
    skills: "Team Management, Event Planning and +3 skills"
  }
];

const photographyData = [
  photo1, photo2, photo3, photo4, photo5, photo6, photo7, photo8, photo9, photo10,
  photo11, photo12, photo13, photo14, photo15, photo16, photo17, photo18, photo19,
  photo20, photo21, photo22
];

export default function App() {
  const [activeWindows, setActiveWindows] = useState([]);
  const [minimizedWindows, setMinimizedWindows] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSocialsOpen, setIsSocialsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showBoot, setShowBoot] = useState(true);
  const constraintsRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(prefersDark);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const toggleWindow = (id) => {
    if (minimizedWindows.includes(id)) {
      // Restore from minimized
      setMinimizedWindows(prev => prev.filter(wId => wId !== id));
      setActiveWindows(prev => [...prev.filter(wId => wId !== id), id]); // bring to front
    } else if (activeWindows.includes(id)) {
      // Bring to front
      setActiveWindows(prev => [...prev.filter(wId => wId !== id), id]);
    } else {
      // Open new
      setActiveWindows(prev => [...prev, id]);
    }
  };

  const closeWindow = (id) => {
    setActiveWindows(prev => prev.filter(wId => wId !== id));
    setMinimizedWindows(prev => prev.filter(wId => wId !== id));
  };

  const minimizeWindow = (id) => {
    setMinimizedWindows(prev => [...prev, id]);
  };

  const handleSearchSelect = (id) => {
    setIsSearchOpen(false);
    toggleWindow(id);
  };

  return (
    <>
      <AnimatePresence>
        {showBoot && <BootScreen onComplete={() => setShowBoot(false)} />}
      </AnimatePresence>

      <div ref={constraintsRef} style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <div className="desktop-bg" />
      
      {/* Top Navbar */}
      <TopNavbar 
        activeWindowId={activeWindows.length > 0 && !minimizedWindows.includes(activeWindows[activeWindows.length - 1]) ? activeWindows[activeWindows.length - 1] : null} 
        onToggleHelp={() => setIsHelpOpen(true)}
        toggleTheme={toggleTheme}
        isDarkMode={isDarkMode}
        onToggleSearch={() => setIsSearchOpen(true)}
        onOpenTerminal={() => toggleWindow('terminal')}
      />

      {/* Spotlight Search */}
      <AnimatePresence>
        {isSearchOpen && <SpotlightSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onSelect={handleSearchSelect} />}
      </AnimatePresence>

      {/* Help Modal */}
      <AnimatePresence>
        {isHelpOpen && <HelpModal activeWindowId={activeWindows.length > 0 && !minimizedWindows.includes(activeWindows[activeWindows.length - 1]) ? activeWindows[activeWindows.length - 1] : null} onClose={() => setIsHelpOpen(false)} />}
      </AnimatePresence>

      {/* Desktop Widgets */}
      <DesktopClock />

      {/* Desktop Folders */}
      {desktopItems.map((item) => (
        <motion.div
          key={item.id}
          className="desktop-icon"
          style={{ position: 'absolute', left: item.x, top: item.y, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onDoubleClick={() => toggleWindow(item.id)}
        >
          {/* Simple MacOS-like Folder Icon shape using CSS */}
          <div style={{ width: '80px', height: '65px', borderRadius: '8px', background: item.color, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-8px', left: '0', width: '35px', height: '15px', background: item.color, borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }} />
          </div>
          <span style={{ color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.5)', fontSize: '14px', fontWeight: '500' }}>
            {item.title}
          </span>
        </motion.div>
      ))}

      {/* Window Modals */}
      <AnimatePresence>
        {activeWindows.map((windowId, index) => {
          if (minimizedWindows.includes(windowId)) return null; // Hide if minimized
          return (
            <WindowModal 
              key={windowId}
              id={windowId} 
              onClose={() => closeWindow(windowId)}
              onMinimize={() => minimizeWindow(windowId)}
              zIndex={100 + index}
              onFocus={() => toggleWindow(windowId)}
              constraintsRef={constraintsRef}
              onOpenWindow={toggleWindow}
            />
          );
        })}
      </AnimatePresence>

      {/* Socials Drawer Overlay */}
      <AnimatePresence>
        {isSocialsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSocialsOpen(false)}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 900,
              backdropFilter: 'blur(2px)',
              backgroundColor: 'rgba(0,0,0,0.05)'
            }}
          />
        )}
      </AnimatePresence>

      {/* Socials Drawer */}
      <AnimatePresence>
        {isSocialsOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, y: 50, scale: 0.95, x: '-50%' }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
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
              boxShadow: 'var(--glass-shadow)'
            }}
          >
            <DrawerIcon icon={<Instagram size={28} color="var(--dock-icon-color)" />} label="Instagram" link="https://www.instagram.com/tejasgovind_" />
            <DrawerIcon icon={<Linkedin size={28} color="var(--dock-icon-color)" />} label="LinkedIn" link="https://www.linkedin.com/in/tejas-govind-29520a2b2/" />
            <DrawerIcon icon={<Github size={28} color="var(--dock-icon-color)" />} label="GitHub" link="https://github.com/TejasGov" />
            <DrawerIcon icon={<Youtube size={28} color="var(--dock-icon-color)" />} label="YouTube" link="https://www.youtube.com/@tejasgovind" />
            <DrawerIcon icon={
              <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--dock-icon-color)">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.858L1.671 2.25H8.08l4.253 5.622L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
              </svg>
            } label="X" link="https://x.com/TejasGovin17982" />
            <DrawerIcon icon={<PenTool size={28} color="var(--dock-icon-color)" />} label="WordPress" link="https://tejasgovind.wordpress.com" />
            <DrawerIcon icon={<Database size={28} color="var(--dock-icon-color)" />} label="Kaggle" link="https://www.kaggle.com/tejasgovind" />
          </motion.div>
        )}
      </AnimatePresence>

      <Dock>
        <DockIcon 
          icon={<img src={memojiImg} alt="Memoji" style={{width: '100%', height: '100%', objectFit: 'cover'}} />} 
          label="About Me" 
          isActive={activeWindows.includes('about')}
          onClick={() => toggleWindow('about')}
          hoverColor="rgba(255, 255, 255, 0.3)" 
        />
        <div style={{ width: '1px', background: 'var(--timeline-line)', margin: '0 4px' }} />
        <DockIcon icon={<FileText color="var(--dock-icon-color)" />} label="Resume" hoverColor="var(--dock-item-hover)" />
        <DockIcon 
          icon={<Globe color="var(--dock-icon-color)" />} 
          label="Socials" 
          hoverColor="var(--dock-item-hover)" 
          onClick={() => setIsSocialsOpen(!isSocialsOpen)} 
          isActive={isSocialsOpen} 
        />
        <DockIcon icon={<Mail color="var(--dock-icon-color)" />} label="Email" hoverColor="var(--dock-item-hover)" />
        <div style={{ width: '1px', background: 'var(--timeline-line)', margin: '0 4px' }} />
        <DockIcon 
          icon={<Mic color="var(--dock-icon-color)" />} 
          label="Voice Agent" 
          onClick={() => {}}
          hoverColor="var(--dock-item-hover)" 
        />
      </Dock>
    </div>
    </>
  );
}

function Dock({ children }) {
  const mouseX = useMotionValue(Infinity);

  return (
    <div style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
      <motion.div 
        className="glass-panel dock" 
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        initial={{ y: 100, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        style={{ display: 'flex', gap: '12px', padding: '12px 16px', alignItems: 'flex-end', height: '72px' }}
      >
        {React.Children.map(children, child => {
          if (child.type === 'div') return child; // For the divider
          return React.cloneElement(child, { mouseX });
        })}
      </motion.div>
    </div>
  );
}

function DrawerIcon({ icon, label, link }) {
  return (
    <motion.a 
      href={link}
      target="_blank"
      rel="noreferrer"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
    >
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '16px',
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        {icon}
      </div>
      <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-main)' }}>{label}</span>
    </motion.a>
  );
}

function DesktopClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const seconds = time.getSeconds();
  const minutes = time.getMinutes();
  const hours = time.getHours();

  const secRotation = seconds * 6;
  const minRotation = minutes * 6 + seconds * 0.1;
  const hrRotation = (hours % 12) * 30 + minutes * 0.5;

  const hoursStr = hours.toString().padStart(2, '0');
  const minutesStr = minutes.toString().padStart(2, '0');
  const dateStr = time.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const dayStr = time.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();

  return (
    <div style={{
      position: 'absolute', 
      top: '48px', 
      right: '24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px',
      transform: 'scale(0.55)',
      transformOrigin: 'top right',
      zIndex: 50,
      pointerEvents: 'none'
    }}>
      {/* Analog Clock */}
      <div className="glass-panel" style={{
        width: '160px', 
        height: '160px', 
        borderRadius: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          position: 'relative',
          width: '128px',
          height: '128px',
          borderRadius: '50%',
          border: '1px solid var(--clock-border)',
          background: 'var(--clock-bg)',
          boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.1)'
        }}>
          {/* Ticks */}
          {[...Array(12)].map((_, i) => (
            <div key={i} style={{
              position: 'absolute', top: 0, left: '50%', width: '2px', height: '100%',
              marginLeft: '-1px', transform: `rotate(${i * 30}deg)`
            }}>
              <div style={{
                width: '2px', height: i % 3 === 0 ? '10px' : '4px',
                background: i % 3 === 0 ? 'var(--clock-tick-major)' : 'var(--clock-tick-minor)',
                marginTop: '4px', borderRadius: '1px'
              }} />
            </div>
          ))}
          {/* Hour Hand */}
          <div style={{
            position: 'absolute', top: '28%', left: 'calc(50% - 2.5px)', width: '5px', height: '22%', 
            background: 'var(--clock-hand)', borderRadius: '3px', transformOrigin: 'bottom center', transform: `rotate(${hrRotation}deg)`,
            boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
          }} />
          {/* Minute Hand */}
          <div style={{
            position: 'absolute', top: '12%', left: 'calc(50% - 1.5px)', width: '3px', height: '38%', 
            background: 'var(--clock-hand)', opacity: 0.9, borderRadius: '2px', transformOrigin: 'bottom center', transform: `rotate(${minRotation}deg)`,
            boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
          }} />
          {/* Second Hand */}
          <div style={{
            position: 'absolute', top: '12%', left: 'calc(50% - 1px)', width: '2px', height: '38%', 
            background: '#ff3b30', borderRadius: '1px', transformOrigin: 'bottom center', transform: `rotate(${secRotation}deg)`,
            boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
          }} />
          {/* Center Dot */}
          <div style={{
            position: 'absolute', top: 'calc(50% - 4px)', left: 'calc(50% - 4px)', width: '8px', height: '8px',
            background: 'var(--clock-hand)', borderRadius: '50%', border: '2px solid #ff3b30'
          }} />
        </div>
      </div>

      {/* Digital Clock */}
      <div className="glass-panel" style={{
        width: '320px', 
        height: '180px', 
        borderRadius: '32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        background: 'var(--clock-digital-bg)'
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <DotMatrixDigit char={hoursStr[0]} color="#ff3b30" />
          <DotMatrixDigit char={hoursStr[1]} color="#ff3b30" />
          <div style={{ padding: '0 4px', marginBottom: '8px' }} className="blink-colon">
            <DotMatrixDigit char=":" color="#ff3b30" />
          </div>
          <DotMatrixDigit char={minutesStr[0]} color="var(--clock-digital-text)" />
          <DotMatrixDigit char={minutesStr[1]} color="var(--clock-digital-text)" />
        </div>

        <div style={{
          fontFamily: '"DotGothic16", sans-serif',
          fontSize: '18px',
          letterSpacing: '3px',
          color: 'var(--clock-digital-text)',
          display: 'flex',
          gap: '24px',
          marginTop: '-8px'
        }}>
          <span>{dateStr}</span>
          <span style={{ color: '#ff3b30' }}>|</span>
          <span>{dayStr}</span>
        </div>
      </div>
    </div>
  );
}

const LED_DIGITS = {
  0: [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,1,1],[1,0,1,0,1],[1,1,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  1: [[0,0,1,0,0],[0,1,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,1,1,1,0]],
  2: [[0,1,1,1,0],[1,0,0,0,1],[0,0,0,0,1],[0,0,1,1,0],[0,1,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
  3: [[1,1,1,1,1],[0,0,0,1,0],[0,0,1,0,0],[0,0,0,1,0],[0,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  4: [[0,0,0,1,0],[0,0,1,1,0],[0,1,0,1,0],[1,0,0,1,0],[1,1,1,1,1],[0,0,0,1,0],[0,0,0,1,0]],
  5: [[1,1,1,1,1],[1,0,0,0,0],[1,1,1,1,0],[0,0,0,0,1],[0,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  6: [[0,1,1,1,0],[1,0,0,0,0],[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  7: [[1,1,1,1,1],[0,0,0,0,1],[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0],[0,1,0,0,0],[0,1,0,0,0]],
  8: [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  9: [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,1],[0,0,0,0,1],[0,1,1,1,0]],
  ':': [[0],[0],[1],[0],[1],[0],[0]]
};

const DotMatrixDigit = ({ char, color }) => {
  const matrix = LED_DIGITS[char];
  if (!matrix) return null;
  const w = matrix[0].length * 10;
  const h = matrix.length * 10;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ height: '64px', fill: color }}>
      {matrix.map((row, y) => 
        row.map((val, x) => val ? <circle key={`${x}-${y}`} cx={x * 10 + 5} cy={y * 10 + 5} r="4.5" /> : null)
      )}
    </svg>
  );
};



function WindowModal({ id, onClose, onMinimize, zIndex, onFocus, constraintsRef, onOpenWindow }) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFilled, setIsFilled] = useState(false);
  const controls = useDragControls();
  const animControls = useAnimation();

  useEffect(() => {
    // Initial entrance animation
    animControls.start({ opacity: 1, scale: 1, x: 0, y: 0, transition: { type: "spring", stiffness: 400, damping: 30 } });
  }, [animControls]);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail.id === id) {
        if (e.detail.cmd === 'minimize') {
          onMinimize();
        } else if (e.detail.cmd === 'close') {
          onClose();
        } else if (e.detail.cmd === 'zoom') {
          setIsMaximized(prev => !prev);
          setIsFilled(false);
        } else if (e.detail.cmd === 'fill') {
          setIsFilled(prev => !prev);
          setIsMaximized(false);
        } else if (e.detail.cmd === 'center') {
          animControls.start({ x: 0, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } });
        }
      }
    };
    window.addEventListener('window-command', handler);
    return () => window.removeEventListener('window-command', handler);
  }, [id, onMinimize, animControls]);

  let title = "";
  let content = null;

  if (id === 'projects') {
    title = "Projects";
    content = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '48px', paddingRight: '12px' }}>
        {projectsData.map((p, i) => {
          const isEven = i % 2 === 0;
          return (
            <div key={i} style={{ 
              display: 'flex', 
              flexDirection: isEven ? 'row' : 'row-reverse', 
              flexWrap: 'wrap',
              gap: '32px', 
              background: 'var(--card-bg)', 
              padding: '24px', 
              borderRadius: '16px',
              border: '1px solid var(--card-border)',
              alignItems: 'center'
            }}>
              {/* Text Side */}
              <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h2 style={{ fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px' }}>{p.title}</h2>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {p.tech.split(', ').map(tech => (
                     <span key={tech} style={{ padding: '6px 12px', background: 'var(--badge-bg)', borderRadius: '8px', fontSize: '13px', fontWeight: '500', border: '1px solid var(--badge-border)' }}>{tech}</span>
                  ))}
                </div>
                <ul style={{ color: 'var(--text-muted)', margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '15px', lineHeight: '1.6' }}>
                  {p.bullets.map((bullet, idx) => <li key={idx}>{bullet}</li>)}
                </ul>
              </div>
              
              {/* Image Side */}
              <div style={{ flex: '1 1 300px', minWidth: '250px' }}>
                <a href={p.link} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                  <div style={{ 
                    width: '100%', 
                    aspectRatio: '16/9',
                    borderRadius: '12px', 
                    backgroundImage: `url(${p.image})`, 
                    backgroundSize: 'cover', 
                    backgroundPosition: 'center',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    cursor: 'pointer',
                    border: '1px solid var(--card-border)'
                  }} 
                  className="project-image-hover"
                  />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    );
  } else if (id === 'work-ex') {
    title = "Work Experience";
    content = (
      <div className="timeline-container">
        {workData.map((w, i) => {
          const isEven = i % 2 === 0;
          return (
            <div key={i} className={`timeline-item ${isEven ? 'left' : 'right'}`}>
              <div className="timeline-card">
                <div className="timeline-date-box">
                  <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)' }}>{w.shortMonth}</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-1px', color: '#8FD3F4', lineHeight: '1.2' }}>{w.shortYear}</div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.5px' }}>{w.role}</h2>
                  <div style={{ fontSize: '14px', color: '#A1C4FD', fontWeight: '600' }}>{w.company}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span>{w.date}</span>
                    <span>•</span>
                    <span>{w.location}</span>
                  </div>
                  <ul style={{ color: 'var(--text-muted)', margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', lineHeight: '1.5' }}>
                    {w.bullets.map((bullet, idx) => <li key={idx}>{bullet}</li>)}
                  </ul>
                  <div style={{ marginTop: '12px', fontSize: '13px', fontWeight: '500', color: 'var(--badge-text)', background: 'var(--badge-bg)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--badge-border)' }}>
                    <strong>Skills:</strong> {w.skills}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  } else if (id === 'photography') {
    title = "Photography";
    content = <MorphingPhotoGallery photos={photographyData} />;
  } else if (id === 'about') {
    title = "About Me";
    content = (
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        <img src={memojiImg} alt="Memoji" style={{ width: '120px', height: '120px', borderRadius: '50%', background: 'var(--badge-bg)', border: '1px solid var(--card-border)' }} />
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>Tejas Govind</h1>
          <p style={{ fontSize: '16px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
            Computer Science student at University at Buffalo (Expected May 2027).<br/>
            Passionate about Web Development, Machine Learning, and creating beautiful, intuitive interfaces.
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['React', 'Node.js', 'Python', 'TypeScript', 'MediaPipe', 'YOLOv8', 'Figma'].map(skill => (
              <span key={skill} style={{ padding: '4px 12px', background: 'var(--badge-bg)', border: '1px solid var(--badge-border)', color: 'var(--badge-text)', borderRadius: '16px', fontSize: '12px' }}>{skill}</span>
            ))}
          </div>
        </div>
      </div>
    );
  } else if (id === 'terminal') {
    title = "Terminal";
    content = <TerminalWindow onOpenWindow={onOpenWindow} />;
  } else if (id === 'certificates') {
    title = "Certificates";
    content = <div style={{ color: 'var(--text-main)', opacity: 0.6, textAlign: 'center', marginTop: '40px' }}>Certificates module loading...</div>;
  } else if (id === 'talk-to-me') {
    title = "Talk to Me";
    content = <div style={{ color: 'var(--text-main)', opacity: 0.6, textAlign: 'center', marginTop: '40px' }}>Voice AI engine connecting...</div>;
  } else if (id === 'contact') {
    title = "Contact Me";
    content = <div style={{ color: 'var(--text-main)', opacity: 0.6, textAlign: 'center', marginTop: '40px' }}>Contact forms loading...</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 30 }}
      animate={animControls}
      exit={{ opacity: 0, scale: 0.85, y: 30 }}
      drag={!isMaximized && !isFilled}
      dragListener={false}
      dragControls={controls}
      dragConstraints={constraintsRef}
      dragMomentum={false}
      onPointerDown={onFocus}
      className={`glass-panel window-modal ${isMaximized ? 'maximized' : ''} ${isFilled ? 'filled' : ''}`}
      style={{ zIndex, position: 'absolute' }}
    >
      <div 
        className="window-header" 
        onPointerDown={(e) => {
          if (!isMaximized && !isFilled) {
            controls.start(e);
          }
          onFocus();
        }}
        onDoubleClick={() => setIsMaximized(!isMaximized)}
      >
        <div className="traffic-lights">
          <div className="traffic-light close" onClick={(e) => { e.stopPropagation(); onClose(); }}>
            <svg viewBox="0 0 10 10"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </div>
          <div className="traffic-light minimize" onClick={(e) => { e.stopPropagation(); onMinimize(); }}>
            <svg viewBox="0 0 10 10"><path d="M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </div>
          <div className="traffic-light maximize" onClick={(e) => { e.stopPropagation(); setIsMaximized(!isMaximized); }}>
            <svg viewBox="0 0 10 10"><path d="M1.5 8.5L8.5 1.5M1.5 1.5h7v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
          </div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: '13px', fontWeight: '600', color: 'var(--text-main)', opacity: 0.85, letterSpacing: '0.3px', cursor: 'default' }}>
          {title}
        </div>
        <div style={{ width: '52px', flexShrink: 0 }} />
      </div>
      
      <div 
        className="window-content" 
        style={{ display: 'flex', flexDirection: 'column', gap: id === 'terminal' ? '0' : '24px', padding: id === 'terminal' ? '0' : undefined, cursor: 'auto' }} 
        onPointerDown={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    </motion.div>
  );
}

function DockIcon({ icon, label, isActive, onClick, hoverColor = 'rgba(255,255,255,0.2)', mouseX }) {
  const ref = useRef(null);
  const [hovered, setHovered] = useState(false);

  // Safely handle missing mouseX (e.g. for simple implementation without it)
  const safeMouseX = mouseX || useMotionValue(Infinity);

  const distance = useTransform(safeMouseX, (val) => {
    let bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const sizeSync = useTransform(distance, [-150, 0, 150], [48, 70, 48]);
  const size = useSpring(sizeSync, { mass: 0.1, stiffness: 200, damping: 15 });
  
  return (
    <motion.div 
      ref={ref}
      className="dock-item"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{ 
        position: 'relative', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        width: size,
        height: size
      }}
      onClick={onClick}
    >
      <motion.div
        animate={{ 
          background: hovered 
            ? `linear-gradient(150deg, ${hoverColor} 0%, rgba(255,255,255,0.1) 100%)` 
            : 'linear-gradient(150deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)'
        }}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '25%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: hovered 
            ? 'inset 2px 4px 5px 0px rgba(255, 255, 255, 0.2), inset 0px 0px 1px 1px rgba(255, 255, 255, 0.3), 0 8px 16px rgba(0,0,0,0.2)' 
            : 'inset 2px 4px 5px 0px rgba(255, 255, 255, 0.1), inset 0px 0px 1px 1px rgba(255, 255, 255, 0.1), 0 4px 8px rgba(0,0,0,0.1)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          transition: 'box-shadow 0.3s ease',
          overflow: 'hidden'
        }}
      >
        {React.isValidElement(icon) ? (
          icon.type === 'img' ? icon : React.cloneElement(icon, { style: { width: '45%', height: '45%' } })
        ) : null}
      </motion.div>
      
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            style={{
              position: 'absolute',
              bottom: '-8px',
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 0 4px rgba(255,255,255,0.8)'
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: '-45px',
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(10px)',
              padding: '6px 12px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '500',
              color: 'var(--text-main)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              border: '1px solid var(--glass-border)',
              zIndex: 10
            }}
          >
            {label}
            <div style={{
              position: 'absolute',
              bottom: '-5px',
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: '10px',
              height: '10px',
              background: 'inherit',
              borderRight: '1px solid var(--glass-border)',
              borderBottom: '1px solid var(--glass-border)',
              zIndex: -1
            }} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Photo Gallery (Morphing Layout) ─────────────────────────────────────────

const SWIPE_THRESHOLD = 50;

function MorphingPhotoGallery({ photos }) {
  const [layout, setLayout] = useState('grid'); // 'stack' | 'grid' | 'list'
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [lightbox, setLightbox] = useState(null); // index or null

  const layoutModes = [
    { key: 'stack', icon: <Layers size={15} />, label: 'Stack' },
    { key: 'grid', icon: <Grid3X3 size={15} />, label: 'Grid' },
    { key: 'list', icon: <LayoutList size={15} />, label: 'List' },
  ];

  const handleDragEnd = (_, info) => {
    const { offset, velocity } = info;
    const swipe = Math.abs(offset.x) * velocity.x;
    if (offset.x < -SWIPE_THRESHOLD || swipe < -1000) {
      setActiveIndex(prev => (prev + 1) % photos.length);
    } else if (offset.x > SWIPE_THRESHOLD || swipe > 1000) {
      setActiveIndex(prev => (prev - 1 + photos.length) % photos.length);
    }
    setIsDragging(false);
  };

  const getStackOrder = () => {
    const reordered = [];
    for (let i = 0; i < photos.length; i++) {
      const idx = (activeIndex + i) % photos.length;
      reordered.push({ src: photos[idx], origIdx: idx, stackPos: i });
    }
    return reordered.reverse();
  };

  return (
    <div>
      {/* Layout Toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
        <div style={{
          display: 'flex', gap: '2px', padding: '3px',
          background: 'var(--card-bg)', border: '1px solid var(--card-border)',
          borderRadius: '10px',
        }}>
          {layoutModes.map(m => (
            <button
              key={m.key}
              onClick={() => setLayout(m.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', borderRadius: '8px', border: 'none',
                cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                transition: 'all 0.2s',
                background: layout === m.key ? 'var(--badge-bg)' : 'transparent',
                color: layout === m.key ? 'var(--text-main)' : 'var(--text-muted)',
                boxShadow: layout === m.key ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              }}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Grid Layout ─── */}
      {layout === 'grid' && (
        <LayoutGroup>
          <motion.div
            layout
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '10px',
            }}
          >
            {photos.map((src, i) => (
              <motion.div
                key={i}
                layoutId={`photo-${i}`}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25, delay: i * 0.02 }}
                onClick={() => setLightbox(i)}
                style={{
                  aspectRatio: '1',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: '1px solid var(--card-border)',
                }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                <img src={src} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
              </motion.div>
            ))}
          </motion.div>
        </LayoutGroup>
      )}

      {/* ─── List Layout ─── */}
      {layout === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {photos.map((src, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25, delay: i * 0.025 }}
              onClick={() => setLightbox(i)}
              style={{
                display: 'flex', gap: '16px', alignItems: 'center',
                padding: '10px', borderRadius: '14px',
                background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              whileHover={{ scale: 1.01, backgroundColor: 'var(--badge-bg)' }}
            >
              <img src={src} alt={`Photo ${i + 1}`} style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0 }} loading="lazy" />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>Photo {i + 1}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Photography Collection</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ─── Stack Layout ─── */}
      {layout === 'stack' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div style={{ position: 'relative', width: '300px', height: '380px' }}>
            <AnimatePresence mode="popLayout">
              {getStackOrder().map(({ src, origIdx, stackPos }) => {
                const isTop = stackPos === 0;
                return (
                  <motion.div
                    key={origIdx}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{
                      opacity: stackPos > 3 ? 0 : 1,
                      scale: 1 - stackPos * 0.04,
                      y: stackPos * 10,
                      rotate: (stackPos - 1) * 1.5,
                      zIndex: photos.length - stackPos,
                    }}
                    exit={{ opacity: 0, scale: 0.8, x: -250 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    drag={isTop ? 'x' : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.7}
                    onDragStart={() => setIsDragging(true)}
                    onDragEnd={handleDragEnd}
                    whileDrag={{ scale: 1.03, cursor: 'grabbing' }}
                    onClick={() => { if (!isDragging) setLightbox(origIdx); }}
                    style={{
                      position: 'absolute', top: 0, left: 0,
                      width: '100%', height: '100%',
                      borderRadius: '16px', overflow: 'hidden',
                      border: '1px solid var(--card-border)',
                      cursor: isTop ? 'grab' : 'default',
                      boxShadow: isTop ? '0 12px 40px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.15)',
                    }}
                  >
                    <img src={src} alt={`Photo ${origIdx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
                    {isTop && (
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        padding: '40px 16px 12px',
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
                      }}>
                        <span style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>Photo {origIdx + 1}</span>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>Swipe →</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Dot indicators */}
          <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                style={{
                  width: i === activeIndex ? '16px' : '6px',
                  height: '6px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.25s',
                  background: i === activeIndex ? 'var(--text-main)' : 'var(--text-muted)',
                  opacity: i === activeIndex ? 1 : 0.3,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── Lightbox ─── */}
      <AnimatePresence>
        {lightbox !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 5000,
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(20px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'zoom-out',
            }}
          >
            <motion.img
              src={photos[lightbox]}
              alt={`Photo ${lightbox + 1}`}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              style={{
                maxWidth: '85vw', maxHeight: '85vh',
                objectFit: 'contain',
                borderRadius: '12px',
                boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
              }}
              onClick={e => e.stopPropagation()}
            />
            {/* Photo counter */}
            <div style={{
              position: 'absolute', bottom: '32px',
              color: 'rgba(255,255,255,0.5)', fontSize: '13px',
              fontFamily: "'Inter', sans-serif", letterSpacing: '1px',
            }}>
              {lightbox + 1} / {photos.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Boot Screen ─────────────────────────────────────────────────────────────

function BootScreen({ onComplete }) {
  const [phase, setPhase] = useState('progress'); // 'progress' | 'logo'
  const [progPct, setProgPct] = useState(0);
  const [traceOn, setTraceOn] = useState(false);
  const [fillOn, setFillOn] = useState(false);

  // Phase 1: fill thin Apple-style progress bar over 1.6s
  useEffect(() => {
    let start = null;
    let raf;
    const tick = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1600, 1);
      setProgPct(p * 100);
      if (p < 1) { raf = requestAnimationFrame(tick); }
      else { setTimeout(() => setPhase('logo'), 180); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Phase 2: SVG stroke trace starts, then fill, then exit
  useEffect(() => {
    if (phase !== 'logo') return;
    const t1 = setTimeout(() => setTraceOn(true), 80);        // start tracing
    const t2 = setTimeout(() => setFillOn(true), 1100);       // fill after trace ~done
    const t3 = setTimeout(() => onComplete(), 2600);           // exit
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [phase, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.08 }}
      transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Progress bar — bottom center, Apple-style */}
      <AnimatePresence>
        {phase === 'progress' && (
          <motion.div
            key="bar"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'absolute', bottom: '52px',
              width: '180px', height: '2px',
              background: 'rgba(255,255,255,0.1)', borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div style={{
              height: '100%',
              width: `${progPct}%`,
              background: 'rgba(255,255,255,0.85)',
              borderRadius: '2px',
              transition: 'width 30ms linear',
            }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* TG Logo — SVG stroke trace */}
      <AnimatePresence>
        {phase === 'logo' && (
          <motion.div
            key="logo"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}
          >
            <svg
              width="340" height="170"
              viewBox="0 0 340 170"
              overflow="visible"
            >
              {/* Ghost guide — barely visible */}
              <text
                x="170" y="148"
                textAnchor="middle"
                fontFamily="'Dancing Script', cursive"
                fontSize="134"
                fontWeight="700"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              >TG</text>

              {/* Stroke trace — animates in */}
              <text
                x="170" y="148"
                textAnchor="middle"
                fontFamily="'Dancing Script', cursive"
                fontSize="134"
                fontWeight="700"
                fill="none"
                stroke="white"
                strokeWidth="0.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 3200,
                  strokeDashoffset: traceOn ? 0 : 3200,
                  transition: traceOn ? 'stroke-dashoffset 1.05s cubic-bezier(0.4,0,0.2,1)' : 'none',
                }}
              >TG</text>

              {/* Fill — fades in after trace */}
              <text
                x="170" y="148"
                textAnchor="middle"
                fontFamily="'Dancing Script', cursive"
                fontSize="134"
                fontWeight="700"
                fill="white"
                stroke="none"
                style={{
                  opacity: fillOn ? 0.92 : 0,
                  transition: fillOn ? 'opacity 0.6s ease' : 'none',
                }}
              >TG</text>
            </svg>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0, duration: 0.5 }}
              style={{
                color: 'rgba(255,255,255,0.28)',
                letterSpacing: '6px',
                fontSize: '11px',
                fontFamily: "'Inter', sans-serif",
                textTransform: 'uppercase',
                fontWeight: 400,
                margin: 0,
              }}
            >
              Tejas Govind
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TopNavbar({ activeWindowId, onToggleHelp, toggleTheme, isDarkMode, onToggleSearch, onOpenTerminal }) {
  const [isWindowMenuOpen, setIsWindowMenuOpen] = useState(false);
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(false);
  const [volume, setVolume] = useState(50);

  let windowTitle = "Tejas OS";
  if (activeWindowId === 'projects') windowTitle = "Projects";
  else if (activeWindowId === 'work-ex') windowTitle = "Work Experience";
  else if (activeWindowId === 'photography') windowTitle = "Photography";
  else if (activeWindowId === 'about') windowTitle = "About Me";

  const dispatchCommand = (cmd) => {
    window.dispatchEvent(new CustomEvent('window-command', { detail: { id: activeWindowId, cmd } }));
    setIsWindowMenuOpen(false);
  };

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0,
      height: '28px',
      background: 'var(--navbar-bg)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--navbar-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      color: 'var(--navbar-text)',
      fontSize: '13px',
      fontWeight: '500',
      zIndex: 2000,
      userSelect: 'none'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontFamily: "'Dancing Script', cursive", fontSize: '20px', fontWeight: '700', marginRight: '4px', cursor: 'default' }}>TG</span>
        <span style={{ fontWeight: '700', cursor: 'default' }}>{windowTitle}</span>
        <div style={{ display: 'flex', gap: '16px', opacity: 0.8 }}>
          <span style={{ cursor: 'pointer' }} className="nav-item-hover" onClick={onOpenTerminal}>Terminal</span>
          <div style={{ position: 'relative' }}>
            <span 
              style={{ cursor: activeWindowId ? 'pointer' : 'default', opacity: activeWindowId ? 1 : 0.5 }} 
              className={activeWindowId ? "nav-item-hover" : ""}
              onClick={() => activeWindowId && setIsWindowMenuOpen(!isWindowMenuOpen)}
            >
              Window
            </span>
            <AnimatePresence>
              {isWindowMenuOpen && activeWindowId && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  style={{
                    position: 'absolute',
                    top: '24px',
                    left: '-10px',
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid var(--glass-border)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    borderRadius: '8px',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    minWidth: '150px'
                  }}
                >
                  <MenuItem label="Close" onClick={() => dispatchCommand('close')} />
                  <MenuItem label="Minimize" onClick={() => dispatchCommand('minimize')} />
                  <MenuItem label="Fill" onClick={() => dispatchCommand('fill')} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <span style={{ cursor: 'pointer' }} className="nav-item-hover" onClick={onToggleHelp}>Help</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: 0.8, position: 'relative' }}>
          <div onClick={toggleTheme} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </div>
          <Search size={16} style={{ cursor: 'pointer' }} onClick={onToggleSearch} />
          <div style={{ position: 'relative' }}>
            <SlidersHorizontal 
              size={14} 
              style={{ cursor: 'pointer' }} 
              onClick={() => setIsControlPanelOpen(!isControlPanelOpen)} 
            />
            <AnimatePresence>
              {isControlPanelOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  style={{
                    position: 'absolute',
                    top: '24px',
                    right: '-10px',
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid var(--glass-border)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    minWidth: '200px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-main)' }}>
                    <Volume2 size={16} />
                    <input 
                      type="range" 
                      min="0" max="100" 
                      value={volume} 
                      onChange={(e) => setVolume(e.target.value)} 
                      style={{ flex: 1, cursor: 'pointer' }} 
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuItem({ label, shortcut, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div 
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: '6px',
        background: hovered ? 'var(--badge-bg)' : 'transparent',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
    >
      <span>{label}</span>
      {shortcut && <span style={{ opacity: 0.5, fontSize: '12px' }}>{shortcut}</span>}
    </div>
  );
}

function HelpModal({ activeWindowId, onClose }) {
  let helpText = "Tejas OS is a custom portfolio designed to emulate a native desktop environment. Double click icons to explore!";
  if (activeWindowId === 'projects') helpText = "Projects Directory: Browse through comprehensive case studies and GitHub repositories of my latest work.";
  if (activeWindowId === 'work-ex') helpText = "Work Experience: A dynamic timeline charting my professional journey and volunteer work.";
  if (activeWindowId === 'photography') helpText = "Photography: A curated collection of my favorite captures.";
  if (activeWindowId === 'about') helpText = "About Me: Learn more about my background, skills, and current academic standing.";

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.1)', backdropFilter: 'blur(2px)' }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="glass-panel"
        style={{
          width: '320px', padding: '24px', borderRadius: '24px', position: 'relative', zIndex: 1,
          border: '1px solid var(--glass-border)', boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
          color: 'var(--text-main)', textAlign: 'center'
        }}
      >
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '12px' }}>Tejas OS Help</h3>
        <p style={{ fontSize: '14px', lineHeight: '1.5', opacity: 0.9, marginBottom: '24px' }}>{helpText}</p>
        <button 
          onClick={onClose}
          style={{
            background: 'var(--badge-bg)', border: '1px solid var(--badge-border)', color: 'var(--badge-text)',
            padding: '8px 24px', borderRadius: '16px', fontWeight: '600', cursor: 'pointer'
          }}
        >
          Got it
        </button>
      </motion.div>
    </div>
  );
}

const searchIndex = [
  { id: 'projects', title: 'Projects', synonyms: ['work', 'portfolio', 'apps'], icon: <Globe size={18} /> },
  { id: 'about', title: 'About Me', synonyms: ['bio', 'profile', 'me', 'info'], icon: <img src={memojiImg} alt="Me" style={{width:'18px', borderRadius:'50%'}}/> },
  { id: 'work-ex', title: 'Work Experience', synonyms: ['experience', 'resume', 'career'], icon: <FileText size={18} /> },
  { id: 'photography', title: 'Photography', synonyms: ['photos', 'gallery', 'pictures'], icon: <Instagram size={18} /> },
  { id: 'certificates', title: 'Certificates', synonyms: ['awards', 'achievements'], icon: <FileText size={18} /> },
  { id: 'terminal', title: 'Terminal', synonyms: ['shell', 'cmd', 'command', 'prompt'], icon: <Command size={18} /> },
  { id: 'talk-to-me', title: 'Talk to Me', synonyms: ['ai', 'voice', 'chat'], icon: <Mic size={18} /> },
  { id: 'contact', title: 'Contact Me', synonyms: ['email', 'message', 'connect'], icon: <Mail size={18} /> },
];

function SpotlightSearch({ isOpen, onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const results = searchIndex.filter(item => {
    if (!query) return false;
    const q = query.toLowerCase();
    if (item.title.toLowerCase().includes(q)) return true;
    return item.synonyms.some(s => s.toLowerCase().includes(q));
  });

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    }
    if (e.key === 'Enter' && results.length > 0) {
      onSelect(results[selectedIndex].id);
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 4000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '15vh' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)' }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        style={{
          width: '600px',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(30px)',
          border: '1px solid var(--glass-border)',
          borderRadius: '16px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 24px', borderBottom: results.length > 0 ? '1px solid var(--glass-border)' : 'none' }}>
          <Search size={24} color="var(--text-main)" style={{ opacity: 0.6 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Spotlight Search"
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-main)',
              fontSize: '24px',
              fontWeight: '300',
              marginLeft: '16px',
              width: '100%'
            }}
          />
        </div>
        {results.length > 0 && (
          <div style={{ padding: '8px 0', maxHeight: '300px', overflowY: 'auto' }}>
            {results.map((res, idx) => (
              <div
                key={res.id}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => onSelect(res.id)}
                style={{
                  padding: '12px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  background: idx === selectedIndex ? 'var(--badge-bg)' : 'transparent',
                  color: 'var(--text-main)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ opacity: 0.8, display: 'flex' }}>{res.icon}</div>
                <span style={{ fontSize: '16px', fontWeight: '500' }}>{res.title}</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Interactive Terminal Engine ────────────────────────────────────────────

const MONO = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace";

const MOTD = [
  { text: '████████╗███████╗     ██╗ █████╗ ███████╗', color: '#60a5fa' },
  { text: '╚══██╔══╝██╔════╝     ██║██╔══██╗██╔════╝', color: '#60a5fa' },
  { text: '   ██║   █████╗       ██║███████║███████╗', color: '#818cf8' },
  { text: '   ██║   ██╔══╝  ██   ██║██╔══██║╚════██║', color: '#818cf8' },
  { text: '   ██║   ███████╗╚█████╔╝██║  ██║███████║', color: '#a78bfa' },
  { text: '   ╚═╝   ╚══════╝ ╚════╝ ╚═╝  ╚═╝╚══════╝', color: '#a78bfa' },
  { text: '', color: '' },
  { text: '  Welcome to Tejas OS v1.0  —  darwin-portfolio', color: '#f1f5f9' },
  { text: '  Type `help` to see available commands.', color: '#94a3b8' },
  { text: '', color: '' },
];

const COMMANDS = {
  help: () => [
    { text: 'Available commands:', color: '#f1f5f9' },
    { text: '', color: '' },
    { text: '  whoami      →  Who is Tejas?', color: '#94a3b8' },
    { text: '  about       →  Detailed bio & personality', color: '#94a3b8' },
    { text: '  skills      →  Languages, frameworks & tools', color: '#94a3b8' },
    { text: '  projects    →  View project portfolio', color: '#94a3b8' },
    { text: '  experience  →  Work & volunteer history', color: '#94a3b8' },
    { text: '  education   →  Academic background', color: '#94a3b8' },
    { text: '  contact     →  Get in touch', color: '#94a3b8' },
    { text: '  open <win>  →  Open a window (e.g. open projects)', color: '#94a3b8' },
    { text: '  date        →  Current date & time', color: '#94a3b8' },
    { text: '  uname       →  System info', color: '#94a3b8' },
    { text: '  echo <txt>  →  Echo text', color: '#94a3b8' },
    { text: '  clear       →  Clear terminal', color: '#94a3b8' },
    { text: '', color: '' },
  ],
  whoami: () => [
    { text: '👤  Tejas Govind', color: '#f1f5f9' },
    { text: '    CS @ University at Buffalo  (Expected May 2027)', color: '#94a3b8' },
    { text: '📍  Buffalo, NY  ·  Open to internships & research', color: '#94a3b8' },
    { text: '', color: '' },
  ],
  about: () => [
    { text: '👤  Tejas Govind', color: '#f1f5f9' },
    { text: '    CS @ University at Buffalo  (Expected May 2027)', color: '#94a3b8' },
    { text: '', color: '' },
    { text: '    I build things at the intersection of ML, CV, and web.', color: '#e2e8f0' },
    { text: '    Passionate about designing beautiful, intuitive interfaces', color: '#e2e8f0' },
    { text: '    and deploying real-world AI systems. Volunteer, researcher,', color: '#e2e8f0' },
    { text: '    and lifelong learner.', color: '#e2e8f0' },
    { text: '', color: '' },
  ],
  skills: () => [
    { text: '── Languages ──────────────────────────────────', color: '#64748b' },
    { text: '   Python · JavaScript · TypeScript · C++', color: '#e2e8f0' },
    { text: '── Frameworks ─────────────────────────────────', color: '#64748b' },
    { text: '   React · Node.js · Next.js · Express', color: '#e2e8f0' },
    { text: '── ML / CV ────────────────────────────────────', color: '#64748b' },
    { text: '   MediaPipe · YOLOv8 · OpenCV · TensorFlow', color: '#e2e8f0' },
    { text: '── Tools ──────────────────────────────────────', color: '#64748b' },
    { text: '   Figma · Git · Supabase · Vercel · Docker', color: '#e2e8f0' },
    { text: '', color: '' },
  ],
  projects: () => [
    { text: '1.  Revere          AI-powered caretaker dashboard', color: '#818cf8' },
    { text: '2.  Tejas OS        macOS-inspired portfolio OS (this!)', color: '#818cf8' },
    { text: '3.  Gaze Tracker    Facial mesh + gaze estimation (YOLOv8)', color: '#818cf8' },
    { text: '4.  Supabase App    Real-time serverless collab app', color: '#818cf8' },
    { text: '', color: '' },
    { text: '    Tip: type `open projects` to view full case studies.', color: '#64748b' },
    { text: '', color: '' },
  ],
  experience: () => [
    { text: 'Community Volunteer  ·  UB Pre-Dental Assoc.  ·  Feb 2026–Present', color: '#f1f5f9' },
    { text: 'Student Assistant   ·  UB Libraries           ·  Aug 2025–Present', color: '#f1f5f9' },
    { text: 'Campus Outreach SA  ·  UB Athletics           ·  Jul 2025–Present', color: '#f1f5f9' },
    { text: 'Academic Tutor      ·  UB                     ·  Jun 2025–Present', color: '#f1f5f9' },
    { text: '', color: '' },
    { text: '    Tip: type `open work-ex` to view the full timeline.', color: '#64748b' },
    { text: '', color: '' },
  ],
  education: () => [
    { text: '🎓  University at Buffalo — SUNY', color: '#f1f5f9' },
    { text: '    B.S. Computer Science · Expected May 2027', color: '#94a3b8' },
    { text: '    Buffalo, New York', color: '#64748b' },
    { text: '', color: '' },
  ],
  contact: () => [
    { text: '📧  tejasgovind@buffalo.edu', color: '#34d399' },
    { text: '🔗  linkedin.com/in/tejas-govind-29520a2b2', color: '#34d399' },
    { text: '🐙  github.com/TejasGov', color: '#34d399' },
    { text: '📷  instagram.com/tejasgovind_', color: '#34d399' },
    { text: '', color: '' },
  ],
  date: () => [
    { text: new Date().toString(), color: '#f1f5f9' },
    { text: '', color: '' },
  ],
  uname: () => [
    { text: 'Tejas OS v1.0 (darwin-portfolio)  React 18  Vite', color: '#f1f5f9' },
    { text: '', color: '' },
  ],
};

function TerminalWindow({ onOpenWindow }) {
  const [lines, setLines] = useState(() =>
    MOTD.map(l => ({ ...l, id: Math.random() }))
  );
  const [input, setInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const pushLines = (newLines) => {
    setLines(prev => [...prev, ...newLines.map(l => ({ ...l, id: Math.random() }))]);
  };

  const runCommand = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    // Echo the command
    pushLines([{ text: '', color: '' }, {
      text: null, // signals a prompt line
      cmd: trimmed,
      id: Math.random()
    }]);

    setCmdHistory(prev => [trimmed, ...prev]);
    setHistIdx(-1);

    const [cmd, ...args] = trimmed.toLowerCase().split(/\s+/);

    if (cmd === 'clear') {
      setLines(MOTD.map(l => ({ ...l, id: Math.random() })));
      return;
    }

    if (cmd === 'echo') {
      pushLines([{ text: args.join(' '), color: '#f1f5f9' }, { text: '', color: '' }]);
      return;
    }

    if (cmd === 'open') {
      const windowMap = {
        projects: 'projects', 'work-ex': 'work-ex', workex: 'work-ex',
        photography: 'photography', about: 'about', terminal: 'terminal',
        certificates: 'certificates', contact: 'contact',
      };
      const target = windowMap[args[0]];
      if (target && onOpenWindow) {
        onOpenWindow(target);
        pushLines([{ text: `Opening ${args[0]}...`, color: '#34d399' }, { text: '', color: '' }]);
      } else {
        pushLines([{ text: `open: unknown window '${args[0] || ''}'`, color: '#f87171' }, { text: '', color: '' }]);
      }
      return;
    }

    if (COMMANDS[cmd]) {
      pushLines(COMMANDS[cmd]());
    } else {
      pushLines([
        { text: `zsh: command not found: ${trimmed}`, color: '#f87171' },
        { text: "    (type `help` to see available commands)", color: '#64748b' },
        { text: '', color: '' },
      ]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      runCommand(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIdx = Math.min(histIdx + 1, cmdHistory.length - 1);
      setHistIdx(newIdx);
      setInput(cmdHistory[newIdx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIdx = Math.max(histIdx - 1, -1);
      setHistIdx(newIdx);
      setInput(newIdx === -1 ? '' : cmdHistory[newIdx]);
    }
  };

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', cursor: 'text', background: '#0d1117', borderRadius: '0 0 16px 16px', overflow: 'hidden' }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Output area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 8px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {lines.map(line => {
          if (line.cmd !== undefined) {
            return (
              <div key={line.id} style={{ fontFamily: MONO, fontSize: '13px', lineHeight: '1.7' }}>
                <span style={{ color: '#60a5fa' }}>guest@tejas-os</span>
                <span style={{ color: '#a78bfa' }}>:~$ </span>
                <span style={{ color: '#e2e8f0' }}>{line.cmd}</span>
              </div>
            );
          }
          return (
            <div key={line.id} style={{ fontFamily: MONO, fontSize: '13px', lineHeight: '1.7', color: line.color, whiteSpace: 'pre' }}>
              {line.text}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input line */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 24px 16px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        fontFamily: MONO,
        fontSize: '13px',
        flexShrink: 0
      }}>
        <span style={{ color: '#60a5fa', whiteSpace: 'nowrap' }}>guest@tejas-os</span>
        <span style={{ color: '#a78bfa', whiteSpace: 'nowrap' }}>:~$ </span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#e2e8f0',
            fontFamily: MONO,
            fontSize: '13px',
            caretColor: '#4ade80',
          }}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>
    </div>
  );
}
