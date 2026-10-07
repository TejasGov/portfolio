import { useEffect, useRef } from 'react';
export default function Atmosphere({ paused }) {
  const videoRef = useRef(null);
  useEffect(() => {
    const video = videoRef.current;
    const sync = () => {
      if (paused || document.hidden) video.pause();
      else video.play().catch(() => {});
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [paused]);
  return <div className="atmosphere" aria-hidden="true"><div className="atmosphere-film"><video ref={videoRef} muted loop playsInline preload="metadata" poster="/atmosphere/clouds-poster.webp" tabIndex={-1}><source src="/atmosphere/clouds.mp4" type="video/mp4" /></video><div className="dither-screen" /></div><div className="atmosphere-shade" /></div>;
}
