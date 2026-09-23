export const LUXURY_PALETTE = {
  // Background & Surfacing (Light Neutral Canvas)
  navyPrimary: '#F8FAFC',
  navySecondary: '#FFFFFF',
  slateAccent: '#F1F5F9',
  surfaceCard: '#FFFFFF',
  surfaceBorder: '#E2E8F0',

  // Brand Accents (Restrained Warm Camel / Bronze)
  goldAccent: '#9A7B38',
  goldLight: '#FDF8EE',
  goldDark: '#83672E',

  // Status Indicators (Calibrated for Light Surfaces)
  statusSuccess: '#059669', // Operational / Clean
  statusWarning: '#D97706', // Degraded / Inspecting
  statusDanger: '#DC2626',  // Down / Critical
  statusInfo: '#2563EB',

  // Typography (Charcoal & Slate)
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
} as const;

export type ColorToken = keyof typeof LUXURY_PALETTE;
