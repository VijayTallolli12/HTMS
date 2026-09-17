export const TYPOGRAPHY = {
  fontPrimary: "'Inter', system-ui, -apple-system, sans-serif",
  fontArabic: "'IBM Plex Sans Arabic', 'Noto Sans Arabic', system-ui, sans-serif",
  fontMono: "'JetBrains Mono', monospace",
  fontSerif: "'Playfair Display', serif",
} as const;

export const FONT_SIZES = {
  xs: '0.75rem', // 12px
  sm: '0.875rem', // 14px
  base: '1rem', // 16px - standard body
  lg: '1.125rem', // 18px
  xl: '1.25rem', // 20px - subheadings
  '2xl': '1.5rem', // 24px - card titles
  '3xl': '1.875rem', // 30px - page titles
  '4xl': '2.25rem', // 36px - hero metrics
} as const;

export const FONT_WEIGHTS = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const LINE_HEIGHTS = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const;
