import React, { useState, useEffect } from 'react';
import DotMatrixDigit from './DotMatrix';
import './DesktopClock.css';

export default function DesktopClock() {
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
    <>
      {/* Analog Clock */}
      <div className="glass-panel widget-card" style={{
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
      <div className="glass-panel widget-card" style={{
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

        <div className="widget-label" style={{
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
    </>
  );
}
