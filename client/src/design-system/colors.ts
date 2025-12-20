/**
 * Moodring Brand Color System
 * "Solana-native prediction infrastructure with calm precision."
 *
 * A futuristic, calm, confident aesthetic—like Bloomberg Terminal + Solana gradients + modern fintech minimalism.
 */

export const colors = {
  // Core Palette (Dark Mode Primary)
  ink: {
    black: "#0A0A0D", // Primary background
  },
  graphite: {
    deep: "#16161B", // Cards / surfaces
    light: "#1C1C23", // Elevated surfaces
    hover: "#22222A", // Hover states
  },

  // Accent Colors
  neon: {
    iris: "#7C4DFF", // Accent primary (Solana-inspired purple)
    irisLight: "#9C7AFF", // Lighter variant
    irisDark: "#5C35CC", // Darker variant
  },
  aqua: {
    pulse: "#21F6D2", // Accent secondary (Solana teal)
    pulseLight: "#5FFAE6", // Lighter variant
    pulseDark: "#18C4A8", // Darker variant
  },

  // Neutral Text Colors
  moon: {
    grey: "#C7C9D1", // Text secondary
    greyLight: "#E2E4EA", // Tertiary text
    greyDark: "#8A8C96", // Disabled text
  },

  // Semantic Colors
  semantic: {
    success: "#21F6D2", // Using Aqua Pulse for consistency
    successMuted: "rgba(33, 246, 210, 0.15)",
    danger: "#FF4D6A",
    dangerMuted: "rgba(255, 77, 106, 0.15)",
    warning: "#FFB84D",
    warningMuted: "rgba(255, 184, 77, 0.15)",
  },

  // Pure Colors
  pure: {
    white: "#FFFFFF",
    black: "#000000",
  },
} as const;

// Gradient definitions
export const gradients = {
  // Primary brand gradient - use everywhere for buttons, hero text outlines, glow lines
  brand: "linear-gradient(135deg, #7C4DFF 0%, #21F6D2 100%)",
  brandReverse: "linear-gradient(135deg, #21F6D2 0%, #7C4DFF 100%)",
  brandHorizontal: "linear-gradient(90deg, #7C4DFF 0%, #21F6D2 100%)",

  // Subtle background gradients
  meshDark:
    "radial-gradient(ellipse at 30% 20%, rgba(124, 77, 255, 0.15) 0%, transparent 50%)",
  meshLight:
    "radial-gradient(ellipse at 70% 80%, rgba(33, 246, 210, 0.08) 0%, transparent 50%)",

  // Card gradients
  cardSurface: "linear-gradient(180deg, #1C1C23 0%, #16161B 100%)",

  // Text gradient (for CSS)
  textGradient: "linear-gradient(135deg, #7C4DFF 0%, #21F6D2 100%)",
} as const;

// Shadow/Glow definitions
export const glows = {
  neon: "0 0 18px rgba(124, 77, 255, 0.45)",
  neonStrong: "0 0 32px rgba(124, 77, 255, 0.6)",
  neonSubtle: "0 0 12px rgba(124, 77, 255, 0.25)",
  aqua: "0 0 18px rgba(33, 246, 210, 0.4)",
  aquaStrong: "0 0 32px rgba(33, 246, 210, 0.55)",
} as const;

// Border colors with alpha
export const borders = {
  default: "rgba(255, 255, 255, 0.06)",
  hover: "rgba(124, 77, 255, 0.4)",
  active: "rgba(124, 77, 255, 0.6)",
  subtle: "rgba(255, 255, 255, 0.03)",
} as const;

export type ColorToken = typeof colors;
export type GradientToken = typeof gradients;
export type GlowToken = typeof glows;
