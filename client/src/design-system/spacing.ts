/**
 * Moodring Spacing System
 * 
 * Consistent spacing scale used everywhere in the application
 * Based on a 4px base unit for precise alignment
 */

export const spacing = {
  // Base spacing scale
  px: '1px',
  0: '0',
  0.5: '2px',    // 0.5 * 4px
  1: '4px',      // xs
  2: '8px',      // sm
  3: '12px',
  4: '16px',     // md
  5: '20px',
  6: '24px',     // lg
  7: '28px',
  8: '32px',
  9: '36px',     // xl
  10: '40px',
  11: '44px',
  12: '48px',    // xxl
  14: '56px',
  16: '64px',
  20: '80px',
  24: '96px',
  28: '112px',
  32: '128px',
  36: '144px',
  40: '160px',
  44: '176px',
  48: '192px',
  52: '208px',
  56: '224px',
  60: '240px',
  64: '256px',
  72: '288px',
  80: '320px',
  96: '384px',
} as const;

// Semantic spacing tokens
export const spacingTokens = {
  // Component spacing
  xs: spacing[1],      // 4px - tight spacing
  sm: spacing[2],      // 8px - compact spacing
  md: spacing[4],      // 16px - default spacing
  lg: spacing[6],      // 24px - comfortable spacing
  xl: spacing[9],      // 36px - section gaps
  xxl: spacing[12],    // 48px - major section gaps

  // Layout spacing
  gutter: spacing[4],  // 16px - grid gutter
  sectionX: spacing[4], // Horizontal padding for sections (mobile)
  sectionXLg: spacing[8], // Horizontal padding for sections (desktop)
  sectionY: spacing[16], // Vertical padding for sections (80px)
  sectionYLg: spacing[24], // Large section padding (96px)
  
  // Card spacing
  cardPadding: spacing[5], // 20px
  cardPaddingLg: spacing[6], // 24px
  cardGap: spacing[6], // 24px - gap between cards
  
  // Inline spacing
  inlineXs: spacing[1], // 4px
  inlineSm: spacing[2], // 8px
  inlineMd: spacing[3], // 12px
  inlineLg: spacing[4], // 16px
} as const;

// Border radius tokens
export const borderRadius = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '20px',
  '3xl': '24px',
  full: '9999px',
} as const;

export type SpacingToken = typeof spacing;
export type SpacingSemanticToken = typeof spacingTokens;

