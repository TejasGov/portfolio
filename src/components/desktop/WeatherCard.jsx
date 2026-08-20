import React, { useState, useEffect } from 'react';
import {
  Sun, CloudSun, Cloud, Cloudy, CloudFog,
  CloudDrizzle, CloudRain, CloudSnow, CloudLightning
} from 'lucide-react';
import DotMatrixDigit from './DotMatrix';

/* Change these two lines to point the widget at a different city. */
const LOCATION = { lat: 42.8864, lon: -78.8784, label: 'BUFFALO' };

/* WMO weather codes → short label + icon, kept terse so the row fits the card. */
const CONDITIONS = {
  0:  ['CLEAR',    Sun],
  1:  ['FAIR',     CloudSun],
  2:  ['CLOUDY',   CloudSun],
  3:  ['OVERCAST', Cloudy],
  45: ['FOG',      CloudFog],
  48: ['FOG',      CloudFog],
  51: ['DRIZZLE',  CloudDrizzle],
  53: ['DRIZZLE',  CloudDrizzle],
  55: ['DRIZZLE',  CloudDrizzle],
  56: ['DRIZZLE',  CloudDrizzle],
  57: ['DRIZZLE',  CloudDrizzle],
  61: ['RAIN',     CloudRain],
  63: ['RAIN',     CloudRain],
  65: ['RAIN',     CloudRain],
  66: ['SLEET',    CloudRain],
  67: ['SLEET',    CloudRain],
  71: ['SNOW',     CloudSnow],
  73: ['SNOW',     CloudSnow],
  75: ['SNOW',     CloudSnow],
  77: ['SNOW',     CloudSnow],
  80: ['SHOWERS',  CloudRain],
  81: ['SHOWERS',  CloudRain],
  82: ['SHOWERS',  CloudRain],
  85: ['SNOW',     CloudSnow],
  86: ['SNOW',     CloudSnow],
  95: ['STORM',    CloudLightning],
  96: ['STORM',    CloudLightning],
  99: ['STORM',    CloudLightning],
};

export default function WeatherCard() {
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${LOCATION.lat}&longitude=${LOCATION.lon}` +
          `&current=temperature_2m,weather_code&temperature_unit=fahrenheit`
        );
        if (!res.ok) throw new Error('weather request failed');
        const data = await res.json();
        if (cancelled) return;
        setWeather({
          temp: Math.round(data.current.temperature_2m),
          code: data.current.weather_code,
        });
      } catch {
        if (!cancelled) setWeather(null);
      }
    };

    load();
    const timer = setInterval(load, 15 * 60 * 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const [condition, Icon] = (weather && CONDITIONS[weather.code]) || ['- - -', Cloud];

  // Split the temperature into dot-matrix glyphs, keeping a leading minus for sub-zero days.
  const tempChars = weather
    ? Math.abs(weather.temp).toString().padStart(2, '0').split('')
    : ['-', '-'];
  const isNegative = weather && weather.temp < 0;

  return (
    <div className="glass-panel widget-card weather-card" style={{
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
        <Icon size={52} strokeWidth={1.75} color="#ff3b30" style={{ marginRight: '4px' }} />
        {isNegative && <DotMatrixDigit char="-" color="var(--clock-digital-text)" />}
        {tempChars.map((c, i) => (
          <DotMatrixDigit key={i} char={c} color="var(--clock-digital-text)" />
        ))}
        <DotMatrixDigit char="°" color="#ff3b30" />
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
        <span>{LOCATION.label}</span>
        <span style={{ color: '#ff3b30' }}>|</span>
        <span>{condition}</span>
      </div>
    </div>
  );
}
