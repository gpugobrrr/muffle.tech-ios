import { Platform } from 'react-native';

/**
 * muffle.tech workspace design tokens
 * Warm concrete / architectural paper field, weathered slate type,
 * blue for interaction only.
 */
export const Colors = {
  canvas: '#F1F1ED',
  surface: '#FAFAF7',
  surfaceMuted: '#F5F4EF',

  border: '#D5D2CA',
  borderStrong: '#B9B6AE',
  /** Soft internal separators — limestone-adjacent, not cool grey */
  borderMuted: '#E4E1D9',

  text: '#20262B',
  textSecondary: '#737A7D',
  textMuted: '#A5A49E',

  accent: '#3B82F6',
  accentSoft: '#E8F0FD',
  /** Hairline accents — faint blue separators */
  accentFaint: '#C5D8F5',

  amber: '#C9842B',
  amberSoft: '#F4E8D6',

  danger: '#A95846',
  dangerSoft: '#F2E3DE',

  slate: '#5F6873',
  concrete: '#D9D6CF',
  limestone: '#C9C2B5',
} as const;

/** Status chips — compact, semantic, material-inspired */
export const StatusColors = {
  draft: {
    foreground: Colors.amber,
    background: Colors.amberSoft,
  },
  captured: {
    foreground: Colors.accent,
    background: Colors.accentSoft,
  },
  reviewed: {
    foreground: Colors.slate,
    background: Colors.surfaceMuted,
  },
  active: {
    foreground: Colors.accent,
    background: Colors.accentSoft,
  },
  ready: {
    foreground: Colors.slate,
    background: Colors.surfaceMuted,
  },
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    mono: 'Menlo',
  },
  default: {
    sans: 'sans-serif',
    mono: 'monospace',
  },
  web: {
    sans: 'system-ui, -apple-system, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
})!;

/** Spacing scale — keep generous margins like the desktop workspace */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 28,
} as const;

export const Type = {
  brand: 15,
  label: 10,
  body: 12,
  mono: 11,
  watermark: 13,
} as const;
