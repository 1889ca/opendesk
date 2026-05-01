/** Contract: contracts/sheets-chart/rules.md */

const PALETTES: Record<string, string[]> = {
  default: [
    '#4E79A7', '#F28E2B', '#E15759', '#76B7B2',
    '#59A14F', '#EDC948', '#B07AA1', '#FF9DA7',
    '#9C755F', '#BAB0AC',
  ],
  vivid: [
    '#2196F3', '#FF5722', '#4CAF50', '#FFC107',
    '#9C27B0', '#00BCD4', '#FF9800', '#8BC34A',
    '#E91E63', '#607D8B',
  ],
  muted: [
    '#8DAEC4', '#D4A574', '#C48A8C', '#9DC5C1',
    '#8FBD87', '#D6C77A', '#B99AB5', '#E0B5BA',
    '#B09A8A', '#C5C0BC',
  ],
};

export type PaletteName = 'default' | 'vivid' | 'muted';

export function getColor(index: number, palette: PaletteName = 'default'): string {
  const colors = PALETTES[palette];
  return colors[index % colors.length];
}

export function getPalette(name: PaletteName = 'default'): string[] {
  return [...PALETTES[name]];
}
