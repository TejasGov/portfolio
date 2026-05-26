import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Sparkles, MapPin } from 'lucide-react';
import { workData } from '../../data';
import './WorkExperience.css';

const getContrastColor = (hex, isDarkTheme) => {
  if (isDarkTheme) return hex;
  const colorMap = {
    '#F59E0B': '#B45309', // Dark yellow/orange
    '#34D399': '#047857', // Dark green
    '#F87171': '#B91C1C', // Dark red
    '#38BDF8': '#0369A1', // Dark blue
    '#A78BFA': '#6D28D9', // Dark purple
    '#5E9EFF': '#1D4ED8', // Dark blue
    '#FF8C5E': '#C2410C', // Dark orange
    '#C084FC': '#7E22CE', // Dark purple
    '#4ADE80': '#15803D', // Dark green
    '#FFD95A': '#A16207', // Dark gold/yellow
  };
  return colorMap[hex] || '#1d1d1f';
};

export default function WorkExperience({ viewMode }) {
  const [activeIdx, setActiveIdx] = useState(-1);
  const [stSel, setStSel] = useState(0);

  const scrollRef = useRef(null);
  const innerRef = useRef(null);
  const canvasRef = useRef(null);
  const spineFillRef = useRef(null);
  const spineFutureRef = useRef(null);
  const nebulaRef = useRef(null);

  const activeIdxRef = useRef(-1);

  // Sync ref with state to prevent closure staleness in listeners
  useEffect(() => {
    activeIdxRef.current = activeIdx;
  }, [activeIdx]);

  // Mutation observer to watch dark-mode class on body
  const [isDark, setIsDark] = useState(document.body.classList.contains('dark-mode'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.body.classList.contains('dark-mode'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const drawStars = () => {
    const canvas = canvasRef.current;
    const scroll = scrollRef.current;
    const inner = innerRef.current;
    if (!canvas || !scroll || !inner) return;

    const W = scroll.offsetWidth;
    const H = Math.max(inner.scrollHeight, 600);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const starOpacityMultiplier = isDark ? 1.0 : 0.35;
    const palette = isDark 
      ? ['255,255,255', '190,210,255', '255,210,180', '210,190,255', '180,255,220']
      : ['100,110,130', '150,160,180', '120,130,150'];

    const starCount = isDark ? 280 : 120;
    for (let i = 0; i < starCount; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = Math.random() * 1.3 + 0.15;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${palette[Math.floor(Math.random() * palette.length)]}, ${(0.08 + Math.random() * 0.55) * starOpacityMultiplier})`;
      ctx.fill();
    }

    if (isDark) {
      for (let i = 0; i < 16; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255, ${0.55 + Math.random() * 0.4})`;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x - 7, y);
        ctx.lineTo(x + 7, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y - 7);
        ctx.lineTo(x, y + 7);
        ctx.stroke();
      }
    }
  };

  const getClosestActiveIndex = (st, scroller) => {
    const center = st + scroller.clientHeight * 0.38;
    let closest = 0;
    let minDist = Infinity;
    const entries = scroller.querySelectorAll('.entry');
    entries.forEach((entry, i) => {
      const top = entry.offsetTop + 14;
      const dist = Math.abs(top - center);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });
    return closest;
  };

  const onScroll = () => {
    const scroller = scrollRef.current;
    const inner = innerRef.current;
    if (!scroller || !inner) return;

    const st = scroller.scrollTop;

    // Fade scroll hint
    const hintEl = scroller.querySelector('.scroll-hint');
    if (hintEl) {
      hintEl.style.opacity = st > 20 ? '0' : '1';
    }

    const horizonEl = inner.querySelector('.horizon');
    const spineTrackEl = inner.querySelector('.spine-track');
    if (!spineTrackEl) return;

    const horizonTop = horizonEl ? horizonEl.offsetTop : spineTrackEl.offsetHeight;
    const targetY = st + scroller.clientHeight * 0.38;
    const fillH = Math.min(targetY, spineTrackEl.offsetHeight);

    // Spine fill adjustments
    if (spineFillRef.current) {
      spineFillRef.current.style.height = Math.min(fillH, horizonTop) + 'px';
      
      const currentActiveIdx = getClosestActiveIndex(st, scroller);
      const activeJob = workData[currentActiveIdx >= 0 ? currentActiveIdx : 0];
      if (activeJob) {
        spineFillRef.current.style.background = `linear-gradient(to bottom, transparent 0%, ${activeJob.color} 50%, ${activeJob.color})`;
        
        const [rr, gg, bb] = activeJob.rgb;
        if (!activeJob.future && isDark) {
          spineFillRef.current.style.boxShadow = `0 0 8px 2px rgba(${rr},${gg},${bb},0.65), 0 0 22px 5px rgba(${rr},${gg},${bb},0.28)`;
        } else {
          spineFillRef.current.style.boxShadow = 'none';
        }
      }
    }

    // Spine future adjustments
    if (spineFutureRef.current) {
      spineFutureRef.current.style.top = horizonTop + 'px';
      spineFutureRef.current.style.height = Math.max(0, spineTrackEl.offsetHeight - horizonTop) + 'px';
    }

    // Node highlight triggers
    const closest = getClosestActiveIndex(st, scroller);
    if (closest !== activeIdxRef.current) {
      setActiveIdx(closest);
    }
  };

  // Re-draw and bind scroll handlers for Timeline Mode
  useEffect(() => {
    if (viewMode !== 'tl') return;

    const scroller = scrollRef.current;
    const handleResize = () => {
      drawStars();
      onScroll();
    };

    drawStars();
    onScroll();

    scroller?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    // Run slightly delayed to capture final container sizing
    const timer = setTimeout(() => {
      drawStars();
      onScroll();
    }, 150);

    return () => {
      scroller?.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [viewMode, isDark]);

  // Handle Nebula positioning on node changes
  useEffect(() => {
    if (viewMode !== 'tl') {
      // Clear nebula ref styles when leaving timeline to prevent bleed
      if (nebulaRef.current) {
        nebulaRef.current.style.opacity = '0';
        nebulaRef.current.style.background = 'none';
      }
      return;
    }
    const scroller = scrollRef.current;
    const nebula = nebulaRef.current;
    if (!scroller || !nebula) return;

    const activeJob = workData[activeIdx >= 0 ? activeIdx : 0];
    if (!activeJob) return;

    const entries = scroller.querySelectorAll('.entry');
    const currentEntry = entries[activeIdx];
    if (currentEntry) {
      const nodeTop = currentEntry.offsetTop + 14;
      nebula.style.top = (nodeTop - 190) + 'px';
      
      const [r, g, b] = activeJob.rgb;
      nebula.style.background = `radial-gradient(circle, rgba(${r},${g},${b},1), transparent 70%)`;
      nebula.style.opacity = activeJob.future ? '0.1' : (isDark ? '0.2' : '0.06');
    }
  }, [activeIdx, viewMode, isDark]);

  // Pre-process elements chronologically
  const timelineElements = [];
  let lastYear = '';
  let horizonInserted = false;

  workData.forEach((j, i) => {
    if (j.future && !horizonInserted) {
      timelineElements.push({
        type: 'horizon',
        key: `horizon-${i}`
      });
      horizonInserted = true;
      lastYear = '';
    }
    if (j.year !== lastYear) {
      timelineElements.push({
        type: 'year',
        year: j.year,
        future: j.future,
        key: `year-${j.year}-${i}`
      });
      lastYear = j.year;
    }
    timelineElements.push({
      type: 'job',
      job: j,
      index: i,
      key: `job-${i}`
    });
  });

  const renderCard = (j, isLit) => {
    return (
      <div className={`card ${j.future ? 'future' : ''} ${isLit ? 'lit' : ''}`}>
        <div className="c-period" style={{ color: getContrastColor(j.color, isDark) }}>{j.period}</div>
        <div className="c-role">{j.role}</div>
        <div className="c-org">{j.org}</div>
        <div className="c-type">
          <span className={`c-pill ${j.future ? 'future-pill' : ''}`}>{j.type}</span>
          {j.future && <span className="c-pill future-pill">✦ Incoming</span>}
        </div>
        <div className="c-detail">
          {j.bullets.map((b, idx) => (
            <div key={idx} className="c-bullet">· {b}</div>
          ))}
          <div className="c-tags">
            {j.skills.map((s, idx) => (
              <span key={idx} className="c-tag">{s}</span>
            ))}
          </div>
          {j.impact && <div className="c-impact">{j.impact}</div>}
        </div>
      </div>
    );
  };

  const selectedJob = workData[stSel];
  const pastJobs = workData.filter(j => !j.future);
  const futureJobs = workData.filter(j => j.future);

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%', minHeight: 0, position: 'relative' }}>
      {viewMode === 'tl' ? (
        <div ref={scrollRef} className="tl-scroll" id="tl-scroll" style={{ width: '100%' }}>
          <canvas ref={canvasRef} id="starfield" />
          <div ref={nebulaRef} className="nebula" id="nebula" />
          <div ref={innerRef} className="tl-inner" id="tl-inner">
            <div className="spine-track">
              <div ref={spineFillRef} className="spine-fill" id="spine-fill" />
              <div ref={spineFutureRef} className="spine-future" id="spine-future" />
            </div>
            
            {timelineElements.map(el => {
              if (el.type === 'horizon') {
                return (
                  <div key={el.key} className="horizon">
                    <div className="horizon-line" />
                    <span className="horizon-label">· · · upcoming · · ·</span>
                    <div className="horizon-line" />
                  </div>
                );
              }
              if (el.type === 'year') {
                return (
                  <div key={el.key} className="year-marker">
                    <span className={`year-label ${el.future ? 'future-year' : ''}`}>{el.year}</span>
                  </div>
                );
              }
              
              const j = el.job;
              const side = el.index % 2 === 0 ? 'left' : 'right';
              const isLit = el.index === activeIdx;

              return (
                <div key={el.key} className={`entry ${side}`}>
                  {side === 'left' ? renderCard(j, isLit) : <div className="empty" />}
                  <div className="node-col">
                    <div 
                      className={`node ${j.future ? 'future-node' : ''} ${isLit ? 'lit' : ''}`}
                      style={{
                        background: isLit && !j.future ? j.color : undefined,
                        boxShadow: isLit && !j.future 
                          ? `0 0 0 3px rgba(${j.rgb[0]},${j.rgb[1]},${j.rgb[2]},0.22), 0 0 14px 4px rgba(${j.rgb[0]},${j.rgb[1]},${j.rgb[2]},0.5), 0 0 32px 10px rgba(${j.rgb[0]},${j.rgb[1]},${j.rgb[2]},0.18)`
                          : undefined
                      }}
                    />
                  </div>
                  {side === 'right' ? renderCard(j, isLit) : <div className="empty" />}
                </div>
              );
            })}
          </div>
          <div className="scroll-hint" id="scroll-hint">
            <span>
              <svg 
                viewBox="0 0 24 24" 
                width="12" 
                height="12" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                fill="none" 
                style={{ marginRight: '4px', verticalAlign: '-2px' }}
              >
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
              scroll to travel through time
            </span>
          </div>
        </div>
      ) : (
        <div id="v-st" style={{ display: 'flex', width: '100%', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Sidebar */}
          <div className="sidebar">
            <div className="sb-label">All Roles</div>
            <div id="sb-list">
              {pastJobs.map((j) => {
                const idx = workData.indexOf(j);
                const isSelected = stSel === idx;
                return (
                  <div 
                    key={idx} 
                    className={`sb-row ${isSelected ? 'on' : ''}`} 
                    onClick={() => setStSel(idx)}
                  >
                    <div className="sb-ico" style={{ background: j.bg }}>{j.emoji}</div>
                    <div className="sb-text">
                      <div className="sb-role">{j.role}</div>
                      <div className="sb-org">{j.org}</div>
                    </div>
                    <div 
                      className="sb-dot" 
                      style={{ background: j.current ? '#28C840' : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)') }} 
                    />
                  </div>
                );
              })}

              {futureJobs.length > 0 && <div className="sb-divider">✦ Upcoming</div>}
              
              {futureJobs.map((j) => {
                const idx = workData.indexOf(j);
                const isSelected = stSel === idx;
                return (
                  <div 
                    key={idx} 
                    className={`sb-row future-row ${isSelected ? 'on' : ''}`} 
                    onClick={() => setStSel(idx)}
                  >
                    <div className="sb-ico future-ico">{j.emoji}</div>
                    <div className="sb-text">
                      <div className="sb-role">{j.role}</div>
                      <div className="sb-org">{j.org}</div>
                    </div>
                    <div 
                      className="sb-dot" 
                      style={{ 
                        background: isDark ? 'rgba(255,217,90,0.4)' : '#D97706', 
                        boxShadow: isDark ? '0 0 4px rgba(255,217,90,0.4)' : 'none' 
                      }} 
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Details Pane */}
          <div className="detail" style={{ opacity: 1, background: isDark ? '#1c1c1e' : '#ffffff' }}>
            {selectedJob && (
              <>
                <div className="d-top">
                  <div 
                    className="d-ico" 
                    style={{ 
                      background: selectedJob.bg, 
                      border: selectedJob.future ? '1px dashed rgba(255,217,90,0.3)' : undefined 
                    }}
                  >
                    {selectedJob.emoji}
                  </div>
                  <div>
                    <div className="d-name" style={{ color: isDark ? '#ffffff' : '#000000' }}>{selectedJob.role}</div>
                    <div className="d-sub" style={{ color: getContrastColor(selectedJob.color, isDark) }}>{selectedJob.org}</div>
                  </div>
                </div>

                <div className="d-meta">
                  <Calendar size={12} style={{ color: isDark ? '#aaaaaa' : '#555555', marginRight: '4px' }} />
                  <MapPin size={12} style={{ color: isDark ? '#aaaaaa' : '#555555', marginRight: '4px' }} />
                  <span className="d-per" style={{ color: isDark ? '#aaaaaa' : '#555555' }}>{selectedJob.period} · {selectedJob.location}</span>
                  {selectedJob.future ? (
                    <span className="badge" style={{ background: isDark ? '#2d2a1e' : '#fef3cd', color: isDark ? '#e0c040' : '#856404', border: isDark ? '0.5px dashed #b89930' : '0.5px dashed #856404' }}>✦ Incoming</span>
                  ) : selectedJob.current ? (
                    <span className="badge" style={{ background: isDark ? '#1a2e1a' : '#d4edda', color: '#28C840', border: '0.5px solid #28C840' }}>● Active</span>
                  ) : (
                    <span className="badge" style={{ background: isDark ? '#2a2a2a' : '#f0f0f0', color: isDark ? '#999999' : '#666666', border: isDark ? '0.5px solid #444444' : '0.5px solid #cccccc' }}>Completed</span>
                  )}
                </div>

                <div className="grp">
                  <div className="grp-lbl" style={{ color: isDark ? '#888888' : '#666666' }}>What I {selectedJob.future ? 'plan to' : ''} do</div>
                  <div className="sblock">
                    {selectedJob.bullets.map((b, idx) => (
                      <div key={idx} className="sitem">
                        <div style={{ display: 'inline-flex', marginTop: '4px', marginRight: '8px' }}>
                          <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: getContrastColor(selectedJob.color, isDark) }} />
                        </div>
                        <div className="sitem-txt" style={{ color: isDark ? '#e0e0e0' : '#1d1d1f' }}>{b}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grp">
                  <div className="grp-lbl" style={{ color: isDark ? '#888888' : '#666666' }}>Skills</div>
                  <div className="skills">
                    {selectedJob.skills.map((s, idx) => (
                      <span key={idx} className="sk" style={{ background: isDark ? '#2a2a2a' : '#f0f0f0', border: isDark ? '0.5px solid #444444' : '0.5px solid #cccccc', color: isDark ? '#d0d0d0' : '#333333' }}>{s}</span>
                    ))}
                  </div>
                </div>

                {selectedJob.impact && (
                  <div className="grp">
                    <div className="grp-lbl" style={{ color: isDark ? '#888888' : '#666666' }}>{selectedJob.future ? 'What this will mean' : 'What it configured in me'}</div>
                    <div className="sblock">
                      <div className="sitem">
                        <Sparkles size={12} style={{ color: getContrastColor(selectedJob.color, isDark), marginRight: '8px', marginTop: '2px', flexShrink: 0 }} />
                        <div className="sitem-txt" style={{ color: isDark ? '#999999' : '#555555', fontStyle: 'italic' }}>
                          {selectedJob.impact}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
