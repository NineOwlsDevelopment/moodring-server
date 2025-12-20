/**
 * Moodring Shadow & Glow System
 * 
 * Shadows for depth and neon glows for accent highlights
 */

export const shadows = {
  // Standard elevation shadows
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.2)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.25), 0 2px 4px -2px rgba(0, 0, 0, 0.2)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.25)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.35), 0 8px 10px -6px rgba(0, 0, 0, 0.25)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  
  // Neon glow effects (brand accent)
  neon: '0 0 18px rgba(124, 77, 255, 0.45)',
  neonStrong: '0 0 32px rgba(124, 77, 255, 0.6)',
  neonSubtle: '0 0 12px rgba(124, 77, 255, 0.25)',
  neonSpread: '0 4px 24px rgba(124, 77, 255, 0.35)',
  
  // Aqua glow effects (secondary accent)
  aqua: '0 0 18px rgba(33, 246, 210, 0.4)',
  aquaStrong: '0 0 32px rgba(33, 246, 210, 0.55)',
  aquaSubtle: '0 0 12px rgba(33, 246, 210, 0.2)',
  
  // Combined/brand glow
  brand: '0 0 24px rgba(124, 77, 255, 0.35), 0 0 48px rgba(33, 246, 210, 0.15)',
  brandHover: '0 0 32px rgba(124, 77, 255, 0.5), 0 0 64px rgba(33, 246, 210, 0.25)',
  
  // Card shadows
  card: '0 4px 20px rgba(0, 0, 0, 0.25)',
  cardHover: '0 8px 30px rgba(0, 0, 0, 0.35), 0 0 20px rgba(124, 77, 255, 0.15)',
  cardElevated: '0 12px 40px rgba(0, 0, 0, 0.4)',
  
  // Interactive element shadows
  button: '0 2px 8px rgba(0, 0, 0, 0.2)',
  buttonHover: '0 4px 16px rgba(0, 0, 0, 0.3)',
  buttonPrimary: '0 4px 16px rgba(124, 77, 255, 0.4)',
  buttonPrimaryHover: '0 6px 24px rgba(124, 77, 255, 0.55)',
  
  // Inner shadows for inputs
  inner: 'inset 0 1px 3px rgba(0, 0, 0, 0.2)',
  innerFocus: 'inset 0 0 0 2px rgba(124, 77, 255, 0.5)',
} as const;

// Ring (focus) styles
export const rings = {
  default: '0 0 0 2px rgba(124, 77, 255, 0.5)',
  strong: '0 0 0 3px rgba(124, 77, 255, 0.6)',
  offset: '0 0 0 2px #0A0A0D, 0 0 0 4px rgba(124, 77, 255, 0.5)',
} as const;

export type ShadowToken = typeof shadows;

