export const theme = {
  colors: {
    // Core brand
    navy: '#0d1f3c',
    navyLight: '#1a2f52',
    gold: '#C9A84C',
    goldLight: '#fdf8ee',
    goldBorder: '#e8d5a3',

    // Backgrounds
    cream: '#faf8f2',
    white: '#ffffff',
    warmBorder: '#ece5d3',

    // Text
    textPrimary: '#0d1f3c',
    textSecondary: '#4a3728',
    textMuted: '#8b7355',
    textPlaceholder: '#b8a88a',
    textOnDark: '#ffffff',
    textOnDarkMuted: 'rgba(255,255,255,0.5)',

    // Status
    error: '#ef4444',
    errorBg: '#fef2f2',
    errorBorder: '#fecaca',

    // Role badge colors (no purple)
    roleAdmin: '#0d1f3c',
    roleTeacher: '#059669',
    roleStudent: '#0284c7',
    roleParent: '#C9A84C',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  radius: {
    sm: 8,
    md: 10,
    lg: 12,
    xl: 16,
    xxl: 20,
  },

  font: {
    // Sizes
    sizeXs: 9,
    sizeEyebrow: 10,
    sizeCaption: 11,
    sizeSm: 13,
    sizeMd: 14,
    sizeLg: 15,
    sizeXl: 20,
    sizeHero: 32,

    // Weights (typed as literals for StyleSheet compatibility)
    weightRegular: '400' as const,
    weightMedium: '500' as const,
    weightSemibold: '600' as const,
    weightBold: '700' as const,
  },
} as const;

export type AppTheme = typeof theme;
