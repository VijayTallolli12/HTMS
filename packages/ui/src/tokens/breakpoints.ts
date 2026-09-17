export const BREAKPOINTS = {
  mobile: '640px', // Mobile phones (< 640px)
  tablet: '1024px', // Tablets & small touch laptops (640px - 1024px)
  desktop: '1440px', // Desktop displays (1024px - 1440px)
  wide: '1920px', // Large desktop monitors (> 1440px)
} as const;

export type BreakpointToken = keyof typeof BREAKPOINTS;
