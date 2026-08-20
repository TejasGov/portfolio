import { useState, useEffect } from 'react';

/* Matches the 600px phone breakpoint used across the stylesheets, for the cases
   where a layout decision has to happen in JS (sizing a canvas, choosing a
   radius) rather than in CSS. */
const QUERY = '(max-width: 600px)';

export default function useIsPhone() {
  const [isPhone, setIsPhone] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = (e) => setIsPhone(e.matches);
    setIsPhone(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isPhone;
}
