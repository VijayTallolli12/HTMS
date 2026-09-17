export const RADII = {
  none: '0px',
  sm: '4px', // Badges, tags, subtle inner elements
  md: '8px', // Standard buttons, input fields, dropdowns
  lg: '12px', // Cards, modals, drawers
  full: '9999px', // Pill badges, circular avatars
} as const;

export type RadiusToken = keyof typeof RADII;
