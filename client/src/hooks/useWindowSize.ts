import { useState, useEffect } from 'react';

// Tracks the current browser window dimensions, updating on resize. Used by useGameLayout to compute
// responsive seat positions and card layout measurements.
export default function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handler = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return size;
}
