import { useState, useEffect } from 'react';

// Custom hook for window resize and responsive design
export const useWindowResize = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
};

// Custom hook for media queries
export const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
};

// Predefined breakpoint hooks
export const useIsMobile = () => useMediaQuery('(max-width: 768px)');
export const useIsTablet = () => useMediaQuery('(min-width: 769px) and (max-width: 1024px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1025px)');
export const useIsLargeScreen = () => useMediaQuery('(min-width: 1440px)');
export const useIsSmallScreen = () => useMediaQuery('(max-width: 480px)');

// Responsive breakpoints
export const breakpoints = {
  mobile: '480px',
  tablet: '768px',
  laptop: '1024px',
  desktop: '1440px',
  large: '1920px',
} as const;

// Utility function to get current breakpoint
export const getCurrentBreakpoint = (width: number) => {
  if (width <= 480) return 'mobile';
  if (width <= 768) return 'small-tablet';
  if (width <= 1024) return 'tablet';
  if (width <= 1440) return 'laptop';
  if (width <= 1920) return 'desktop';
  return 'large';
};
