import { useState, useEffect } from 'react';

// Enhanced responsive hook with more features
export const useResponsive = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  const [breakpoint, setBreakpoint] = useState<string>('mobile');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setWindowSize({ width, height });
      setBreakpoint(getBreakpoint(width));
      setOrientation(width > height ? 'landscape' : 'portrait');
    };

    // Initial call
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    ...windowSize,
    breakpoint,
    orientation,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    isLarge: breakpoint === 'large',
    isXLarge: breakpoint === 'xlarge',
  };
};

// Get breakpoint based on width
export const getBreakpoint = (width: number): string => {
  if (width <= 480) return 'mobile';
  if (width <= 768) return 'small-tablet';
  if (width <= 1024) return 'tablet';
  if (width <= 1440) return 'laptop';
  if (width <= 1920) return 'desktop';
  return 'xlarge';
};

// Responsive breakpoints
export const BREAKPOINTS = {
  mobile: 480,
  tablet: 768,
  laptop: 1024,
  desktop: 1440,
  xlarge: 1920,
} as const;

// Media query strings
export const MEDIA_QUERIES = {
  mobile: `(max-width: ${BREAKPOINTS.mobile}px)`,
  tablet: `(min-width: ${BREAKPOINTS.mobile + 1}px) and (max-width: ${BREAKPOINTS.tablet}px)`,
  laptop: `(min-width: ${BREAKPOINTS.tablet + 1}px) and (max-width: ${BREAKPOINTS.laptop}px)`,
  desktop: `(min-width: ${BREAKPOINTS.laptop + 1}px) and (max-width: ${BREAKPOINTS.desktop}px)`,
  xlarge: `(min-width: ${BREAKPOINTS.desktop + 1}px)`,
  // Combined queries
  mobileAndTablet: `(max-width: ${BREAKPOINTS.tablet}px)`,
  tabletAndUp: `(min-width: ${BREAKPOINTS.tablet + 1}px)`,
  laptopAndUp: `(min-width: ${BREAKPOINTS.laptop + 1}px)`,
  desktopAndUp: `(min-width: ${BREAKPOINTS.desktop + 1}px)`,
} as const;

// Responsive values utility
export const useResponsiveValue = <T>(values: {
  mobile?: T;
  tablet?: T;
  laptop?: T;
  desktop?: T;
  xlarge?: T;
  default: T;
}) => {
  const { breakpoint } = useResponsive();
  
  switch (breakpoint) {
    case 'mobile':
      return values.mobile ?? values.default;
    case 'small-tablet':
    case 'tablet':
      return values.tablet ?? values.default;
    case 'laptop':
      return values.laptop ?? values.default;
    case 'desktop':
      return values.desktop ?? values.default;
    case 'xlarge':
      return values.xlarge ?? values.default;
    default:
      return values.default;
  }
};

// Responsive grid columns
export const useResponsiveGrid = (columns: {
  mobile?: number;
  tablet?: number;
  laptop?: number;
  desktop?: number;
  xlarge?: number;
}) => {
  const { breakpoint } = useResponsiveValue({
    mobile: columns.mobile ?? 1,
    tablet: columns.tablet ?? 2,
    laptop: columns.laptop ?? 3,
    desktop: columns.desktop ?? 4,
    xlarge: columns.xlarge ?? 5,
    default: 1,
  });

  return {
    gridTemplateColumns: `repeat(${breakpoint}, 1fr)`,
    columns: breakpoint,
  };
};

// Responsive spacing
export const useResponsiveSpacing = (spacing: {
  mobile?: string;
  tablet?: string;
  laptop?: string;
  desktop?: string;
  xlarge?: string;
  default: string;
}) => {
  return useResponsiveValue({
    mobile: spacing.mobile ?? spacing.default,
    tablet: spacing.tablet ?? spacing.default,
    laptop: spacing.laptop ?? spacing.default,
    desktop: spacing.desktop ?? spacing.default,
    xlarge: spacing.xlarge ?? spacing.default,
    default: spacing.default,
  });
};

// Responsive font sizes
export const useResponsiveFontSize = (sizes: {
  mobile?: string;
  tablet?: string;
  laptop?: string;
  desktop?: string;
  xlarge?: string;
  default: string;
}) => {
  return useResponsiveValue({
    mobile: sizes.mobile ?? sizes.default,
    tablet: sizes.tablet ?? sizes.default,
    laptop: sizes.laptop ?? sizes.default,
    desktop: sizes.desktop ?? sizes.default,
    xlarge: sizes.xlarge ?? sizes.default,
    default: sizes.default,
  });
};

// Container queries hook (for component-level responsiveness)
export const useContainerQuery = (containerRef: React.RefObject<HTMLElement>, query: string) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    
    // Create a ResizeObserver to watch container size changes
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        
        // Parse the query (e.g., "min-width: 400px")
        const [property, value] = query.split(':').map(s => s.trim());
        const numericValue = parseInt(value.replace('px', ''));
        
        let matchesQuery = false;
        switch (property) {
          case 'min-width':
            matchesQuery = width >= numericValue;
            break;
          case 'max-width':
            matchesQuery = width <= numericValue;
            break;
          case 'width':
            matchesQuery = width === numericValue;
            break;
        }
        
        setMatches(matchesQuery);
      }
    });

    resizeObserver.observe(container);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef, query]);

  return matches;
};

// Responsive image hook
export const useResponsiveImage = (src: string, sizes?: {
  mobile?: string;
  tablet?: string;
  laptop?: string;
  desktop?: string;
  xlarge?: string;
}) => {
  const { breakpoint } = useResponsive();
  
  const getImageSize = () => {
    switch (breakpoint) {
      case 'mobile':
        return sizes?.mobile ?? '100vw';
      case 'small-tablet':
      case 'tablet':
        return sizes?.tablet ?? '50vw';
      case 'laptop':
        return sizes?.laptop ?? '33vw';
      case 'desktop':
        return sizes?.desktop ?? '25vw';
      case 'xlarge':
        return sizes?.xlarge ?? '20vw';
      default:
        return '100vw';
    }
  };

  return {
    src,
    sizes: getImageSize(),
    alt: 'Responsive image',
  };
};

// Responsive visibility hook
export const useResponsiveVisibility = () => {
  const { breakpoint } = useResponsive();
  
  return {
    showOnMobile: ['mobile'].includes(breakpoint),
    showOnTablet: ['small-tablet', 'tablet'].includes(breakpoint),
    showOnLaptop: ['laptop'].includes(breakpoint),
    showOnDesktop: ['desktop', 'xlarge'].includes(breakpoint),
    hideOnMobile: !['mobile'].includes(breakpoint),
    hideOnTablet: !['small-tablet', 'tablet'].includes(breakpoint),
    hideOnLaptop: !['laptop'].includes(breakpoint),
    hideOnDesktop: !['desktop', 'xlarge'].includes(breakpoint),
  };
};

// Responsive layout hook
export const useResponsiveLayout = () => {
  const { breakpoint, width, height } = useResponsive();
  
  return {
    isPortrait: height > width,
    isLandscape: width > height,
    aspectRatio: width / height,
    isSquare: Math.abs(width - height) < 50,
    isWide: width > height * 1.5,
    isTall: height > width * 1.5,
    breakpoint,
  };
};
