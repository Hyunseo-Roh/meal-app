/**
 * Quiet Authority — design tokens (LOCKED).
 *
 * This file is the SINGLE SOURCE OF TRUTH for color, type, and spacing.
 * Nothing else in the app may hardcode a hex color, font size, or spacing
 * value. Import from here instead.
 *
 * The type ladder is locked to exactly 4 sizes. We deliberately do NOT
 * export raw font sizes — only the 4 named roles below — so it is impossible
 * to reach for 15 / 18 / 20 (all forbidden).
 */

// ----------------------------------------------------------------------------
// Colors — the only palette. Exact hex, semantic names.
// ----------------------------------------------------------------------------
export const colors = {
  bg: '#EDEAE3', // Bone — screen background
  card: '#DCD3C5', // Greige — cards
  chipBorder: '#C9C2B6', // Warm Gray — borders
  textSecondary: '#53544F', // Warm Gray Deep — muted text (AA: 6.36:1 on Bone, 5.15:1 on Greige)
  accent: '#8A9AA6', // Cool Slate — single accent (selected chips, primary buttons, active nav)
  text: '#2E2E2C', // Charcoal Ink — text, never pure black
  have: '#7C8A6B', // Sage — semantic "have"/success ONLY (Gap Tracker ✓). NEVER a general accent.
} as const;

export type ColorName = keyof typeof colors;

// ----------------------------------------------------------------------------
// Type ladder — exactly 4 roles. No in-between sizes. 15 / 18 / 20 forbidden.
// Font family: Inter. Hierarchy = size + color first, not bold overuse.
// ----------------------------------------------------------------------------
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
} as const;

/**
 * The 4 named type roles. Each bakes in size, line-height, weight, and (for
 * caption) the uppercase + letter-spacing treatment. Consumers pick a role,
 * never a number.
 */
export const typography = {
  display: {
    fontFamily: fonts.semibold,
    fontSize: 32,
    lineHeight: 38,
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: 24,
    lineHeight: 30,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  caption: {
    // Label role: 13/16 Medium, UPPERCASE, +6% tracking.
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 13 * 0.06,
    textTransform: 'uppercase',
  },
} as const;

export type TypeVariant = keyof typeof typography;

// ----------------------------------------------------------------------------
// Spacing — 4px grid.
// ----------------------------------------------------------------------------
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const layout = {
  screenMargin: 24, // horizontal screen margin
  maxContentWidth: 390, // center on wider screens
} as const;
