/**
 * Moodring Typography System
 * 
 * Font Family: Inter (with Satoshi as alternative)
 * Brand Typography Motif: Large titles with ultra-wide letter spacing and thin gradient strokes
 */

export const typography = {
  // Font families
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
    display: ['Satoshi', 'Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'monospace'],
  },
  
  // Font weights
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  
  // Font sizes with line heights
  fontSize: {
    // Display sizes (for hero/headlines)
    display2xl: ['4.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }], // 72px
    displayXl: ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }], // 60px
    displayLg: ['3rem', { lineHeight: '1.15', letterSpacing: '-0.015em' }], // 48px
    displayMd: ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }], // 36px
    displaySm: ['1.875rem', { lineHeight: '1.25', letterSpacing: '-0.01em' }], // 30px
    
    // Heading sizes
    h1: ['2rem', { lineHeight: '1.25', letterSpacing: '-0.01em' }], // 32px
    h2: ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.005em' }], // 24px
    h3: ['1.25rem', { lineHeight: '1.4' }], // 20px
    h4: ['1.125rem', { lineHeight: '1.4' }], // 18px
    h5: ['1rem', { lineHeight: '1.5' }], // 16px
    
    // Body sizes
    bodyLg: ['1.125rem', { lineHeight: '1.6' }], // 18px
    body: ['1rem', { lineHeight: '1.6' }], // 16px
    bodySm: ['0.875rem', { lineHeight: '1.5' }], // 14px
    bodyXs: ['0.75rem', { lineHeight: '1.5' }], // 12px
    
    // UI sizes
    label: ['0.875rem', { lineHeight: '1.25', letterSpacing: '0.01em' }],
    labelSm: ['0.75rem', { lineHeight: '1.25', letterSpacing: '0.01em' }],
    
    // Numerical UI (prices, volumes)
    dataLg: ['1.5rem', { lineHeight: '1.2', fontVariantNumeric: 'tabular-nums' }],
    dataMd: ['1.125rem', { lineHeight: '1.2', fontVariantNumeric: 'tabular-nums' }],
    dataSm: ['0.875rem', { lineHeight: '1.2', fontVariantNumeric: 'tabular-nums' }],
  },
  
  // Letter spacing
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
    ultrawide: '0.2em', // For brand motif headlines
  },
} as const;

// Semantic typography presets
export const textStyles = {
  heroTitle: {
    fontSize: typography.fontSize.display2xl,
    fontWeight: typography.fontWeight.extrabold,
    letterSpacing: typography.letterSpacing.tight,
  },
  sectionTitle: {
    fontSize: typography.fontSize.displayMd,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: typography.letterSpacing.tight,
  },
  cardTitle: {
    fontSize: typography.fontSize.h4,
    fontWeight: typography.fontWeight.semibold,
  },
  dataValue: {
    fontSize: typography.fontSize.dataLg,
    fontWeight: typography.fontWeight.semibold,
    fontVariantNumeric: 'tabular-nums',
  },
  dataLabel: {
    fontSize: typography.fontSize.labelSm,
    fontWeight: typography.fontWeight.medium,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
} as const;

export type TypographyToken = typeof typography;

