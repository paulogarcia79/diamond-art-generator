import { describe, it, expect } from 'vitest';
import { exportDiamondArtPdf, usePdfExporter } from '../src/composables/usePdfExporter';
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

  it('supports mirrored horizontal export for Single Blueprint without throwing', async () => {
    const blob = await exportDiamondArtPdf({
      title: 'Test Mirrored Blueprint',
      config,
      grid,
      activePalette,
      gridWidth: 20,
      gridHeight: 20,
      exportMode: 'single',
      mirrorHorizontal: true
    });

    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000);
  });

  it('supports mirrored horizontal export for Tiled A4 without throwing', async () => {
    const blob = await exportDiamondArtPdf({
      title: 'Test Mirrored Tiled Pattern',
      config,
      grid,
      activePalette,
      gridWidth: 20,
      gridHeight: 20,
      exportMode: 'tiled',
      mirrorHorizontal: true
    });

    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000);
  });

  it('supports colorless B&W mystery canvas export without throwing', async () => {
    const blob = await exportDiamondArtPdf({
      title: 'Test Colorless Grid Pattern',
      config,
      grid,
      activePalette,
      gridWidth: 20,
      gridHeight: 20,
      exportMode: 'tiled',
      colorlessGrid: true
    });

    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000);
  });

  it('supports combined mirrored and colorless export for face-down transfers', async () => {
    const blob = await exportDiamondArtPdf({
      title: 'Test Mirrored Colorless Pattern',
      config,
      grid,
      activePalette,
      gridWidth: 20,
      gridHeight: 20,
      exportMode: 'tiled',
      mirrorHorizontal: true,
      colorlessGrid: true
    });

    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000);
  });

  it('supports usePdfExporter().exportToPdf() composable function with standard, mirrored, and colorless options', async () => {
    const { exportToPdf } = usePdfExporter();

    // Test with Uint16Array gridData and standard options
    const rawGrid = new Uint16Array(400);
    for (let i = 0; i < 400; i++) rawGrid[i] = i % 2;

    const blobStandard = await exportToPdf(config, rawGrid, activePalette, {
      paperFormat: 'a4',
      mirrorHorizontal: false
    });
    expect(blobStandard).toBeDefined();
    expect(blobStandard.size).toBeGreaterThan(1000);

    // Test with mirrored options
    const blobMirrored = await exportToPdf(config, rawGrid, activePalette, {
      paperFormat: 'a4',
      mirrorHorizontal: true
    });
    expect(blobMirrored).toBeDefined();
    expect(blobMirrored.size).toBeGreaterThan(1000);

    // Test with colorless option
    const blobColorless = await exportToPdf(config, rawGrid, activePalette, {
      paperFormat: 'a4',
      mirrorHorizontal: false,
      colorlessGrid: true
    });
    expect(blobColorless).toBeDefined();
    expect(blobColorless.size).toBeGreaterThan(1000);

    // Test combined mirrored + colorless
    const blobBoth = await exportToPdf(config, rawGrid, activePalette, {
      paperFormat: 'a4',
      mirrorHorizontal: true,
      colorlessGrid: true
    });
    expect(blobBoth).toBeDefined();
    expect(blobBoth.size).toBeGreaterThan(1000);

    // Test legacy string format argument
    const blobLegacy = await exportToPdf(config, rawGrid, activePalette, 'a4');
    expect(blobLegacy).toBeDefined();
    expect(blobLegacy.size).toBeGreaterThan(1000);
  });
});
