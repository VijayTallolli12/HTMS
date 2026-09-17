export const Z_INDEX = {
  base: 0,
  sticky: 10,
  header: 50,
  dropdown: 100,
  drawer: 200,
  backdrop: 300,
  modal: 400,
  toast: 500,
  tooltip: 600,
} as const;

export type ZIndexToken = keyof typeof Z_INDEX;
