/**
 * Moodring Design System
 * 
 * A complete brand identity system for Solana-native prediction infrastructure.
 * "Calm precision" - Futuristic, not noisy. Bloomberg Terminal meets Solana aesthetics.
 */

export * from './colors';
export * from './typography';
export * from './spacing';
export * from './shadows';

// Animation timing functions for Framer Motion
export const animations = {
  // Easing curves
  easing: {
    smooth: [0.4, 0, 0.2, 1],
    spring: [0.175, 0.885, 0.32, 1.275],
    snappy: [0.4, 0, 0.6, 1],
    entrance: [0, 0, 0.2, 1],
    exit: [0.4, 0, 1, 1],
  },
  
  // Duration presets (in seconds)
  duration: {
    instant: 0.1,
    fast: 0.15,
    normal: 0.25,
    slow: 0.4,
    verySlow: 0.6,
    page: 0.5,
  },
  
  // Spring configurations for Framer Motion
  spring: {
    gentle: { type: 'spring', stiffness: 100, damping: 15 },
    snappy: { type: 'spring', stiffness: 400, damping: 30 },
    bouncy: { type: 'spring', stiffness: 300, damping: 10 },
    stiff: { type: 'spring', stiffness: 500, damping: 35 },
  },
} as const;

// Z-index scale
export const zIndex = {
  behind: -1,
  base: 0,
  elevated: 10,
  dropdown: 100,
  sticky: 200,
  modal: 300,
  tooltip: 400,
  toast: 500,
} as const;

// Breakpoints (matching Tailwind defaults)
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

