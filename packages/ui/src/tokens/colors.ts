export const LUXURY_PALETTE = {
  // Background & Surfacing
  navyPrimary: '#0B132B',
  navySecondary: '#1C2541',
  slateAccent: '#3A506B',
  surfaceCard: '#131D3B',
  surfaceBorder: '#233154',

  // Brand Accents
  goldAccent: '#C5A880',
  goldLight: '#E0CCA9',
  goldDark: '#9E8257',

  // Status Indicators
  statusSuccess: '#10B981', // Operational / Clean
  statusWarning: '#F59E0B', // Degraded / Inspecting
  statusDanger: '#EF4444', // Down / Critical
  statusInfo: '#3B82F6',

  // Typography
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
} as const;

export type ColorToken = keyof typeof LUXURY_PALETTE;
