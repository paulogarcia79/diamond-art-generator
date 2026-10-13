export type DrillShape = 'square' | 'round';
export type ViewMode = 'symbols' | 'simulated' | 'split';
export type ToolMode = 'pan' | 'brush' | 'picker';

export interface DmcColor {
  code: string;        // e.g., "310", "BLANC", "B5200"
  name: string;        // e.g., "Black"
  r: number;
  g: number;
  b: number;
  hex: string;
  lab?: [number, number, number]; // Precomputed [L, a, b] for fast lookup
}

export interface ActivePaletteItem extends DmcColor {
  symbol: string;      // Assigned character: 'A', '#', '1', etc.
  count: number;       // Total drills in the current pattern
  contrastColor: '#000000' | '#FFFFFF'; // Optimal symbol text color based on luminance
}

export interface GridCell {
  x: number;
  y: number;
  dmcCode: string;     // References ActivePaletteItem.code
}

export interface ProjectConfig {
  widthCm: number;               // Physical width (e.g., 40cm)
  heightCm: number;              // Physical height (e.g., 50cm)
  drillShape: DrillShape;        // Square (2.5mm) or Round (2.8mm)
  maxColors: number;             // Range: 10 to 90
  ditheringStrength: number;     // Range: 0.0 (none) to 1.0 (full Floyd-Steinberg)
  minColorThreshold: number;     // Despeckle threshold (e.g., remove colors with < 15 drills)
}

export interface QuantizeWorkerInput {
  imageDataBuffer: Uint8ClampedArray;
  imageWidth: number;
  imageHeight: number;
  config: ProjectConfig;
  dmcPalette: DmcColor[];
}

export interface QuantizeWorkerOutput {
  grid: string[][]; // 2D array [row][col] of DMC codes
  activePalette: ActivePaletteItem[];
  gridWidth: number;
  gridHeight: number;
}
