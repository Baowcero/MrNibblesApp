'use client';
import { useEffect, useState } from 'react';

/** True when the viewport is at least `px` wide. Used to show a side panel inline on big screens and as an overlay on small ones. */
export function useWide(px = 1280) {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(`(min-width: ${px}px)`);
    const on = () => setWide(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [px]);
  return wide;
}
