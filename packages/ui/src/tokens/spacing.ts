export const SPACING = {
  none: '0px',
  '1': '4px', // 0.25rem
  '2': '8px', // 0.5rem - base 8pt unit
  '3': '12px', // 0.75rem
  '4': '16px', // 1rem - standard component padding
  '5': '20px', // 1.25rem
  '6': '24px', // 1.5rem - card padding
  '8': '32px', // 2rem - section spacing
  '10': '40px', // 2.5rem
  '12': '48px', // 3rem - large section gap
  '16': '64px', // 4rem - page level gap
} as const;

export type SpacingToken = keyof typeof SPACING;
