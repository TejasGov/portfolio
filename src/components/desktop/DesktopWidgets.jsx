import React from 'react';
import DesktopClock from './DesktopClock';
import WeatherCard from './WeatherCard';
import './DesktopWidgets.css';

/* Positions the desktop widget cluster. Stacks vertically along the right edge on
   desktop; the stylesheet flips it into a horizontal row across the top on
   iPhone/iPad, matching the iOS home-screen widget strip. */
export default function DesktopWidgets() {
  return (
    <div className="desktop-widgets">
      <DesktopClock />
      <WeatherCard />
    </div>
  );
}
