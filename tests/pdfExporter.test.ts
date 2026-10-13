import { describe, it, expect } from 'vitest';
import { exportDiamondArtPdf } from '../src/composables/usePdfExporter';
import type { ActivePaletteItem, ProjectConfig } from '../src/types/diamond';

describe('usePdfExporter', () => {
  const config: ProjectConfig = {
    widthCm: 10,
    heightCm: 10,
    drillShape: 'square',
    maxColors: 2,
    ditheringStrength: 0.5,
    minColorThreshold: 0
  };

  const activePalette: ActivePaletteItem[] = [
    {
      code: '310',
      name: 'Black',
      r: 0,
      g: 0,
      b: 0,
      hex: '#000000',
      symbol: 'A',
      count: 200,
      contrastColor: '#FFFFFF'
    },
    {
      code: 'BLANC',
      name: 'White',
      r: 255,
      g: 255,
      b: 255,
      hex: '#FFFFFF',
      symbol: 'B',
      count: 200,
      contrastColor: '#000000'
    }
  ];

  // 20x20 grid (400 drills)
  const grid: string[][] = Array.from({ length: 20 }, (_, y) =>
    Array.from({ length: 20 }, (_, x) => ((x + y) % 2 === 0 ? '310' : 'BLANC'))
  );

  it('exports a Single Blueprint vector PDF successfully', async () => {
    let progressReported = false;

    const blob = await exportDiamondArtPdf({
      title: 'Test Blueprint Pattern',
      config,
      grid,
      activePalette,
      gridWidth: 20,
      gridHeight: 20,
      exportMode: 'single',
      onProgress: (pct) => {
        if (pct > 0) progressReported = true;
      }
    });

    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000);
    expect(progressReported).toBe(true);
  });

  it('exports Tiled A4 vector PDF sheets successfully', async () => {
    const blob = await exportDiamondArtPdf({
      title: 'Test Tiled Pattern',
      config,
      grid,
      activePalette,
      gridWidth: 20,
      gridHeight: 20,
      exportMode: 'tiled'
    });

    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000);
  });
});
