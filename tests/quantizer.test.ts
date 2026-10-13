import { describe, it, expect } from 'vitest';
import type { DmcColor } from '../src/types/diamond';
import { prepareDmcPalette, findClosestDmc, rgbToLab } from '../src/utils/colorMath';

describe('quantization pipeline logic', () => {
  const dmcCatalog: DmcColor[] = [
    { code: '310', name: 'Black', r: 0, g: 0, b: 0, hex: '#000000' },
    { code: 'BLANC', name: 'White', r: 255, g: 255, b: 255, hex: '#FFFFFF' },
    { code: '666', name: 'Bright Red', r: 227, g: 29, b: 46, hex: '#E31D2E' },
    { code: '796', name: 'Dark Royal Blue', r: 17, g: 65, b: 125, hex: '#11417D' }
  ];

  it('snaps RGB colors to the closest DMC catalog shade', () => {
    const paletteWithLab = prepareDmcPalette(dmcCatalog);

    // Deep midnight blue (10, 40, 100) -> 796
    const blueLab = rgbToLab(10, 40, 100);
    const closestBlue = findClosestDmc(blueLab, paletteWithLab);
    expect(closestBlue.code).toBe('796');

    // Crimson red (210, 20, 40) -> 666
    const crimsonLab = rgbToLab(210, 20, 40);
    const closestRed = findClosestDmc(crimsonLab, paletteWithLab);
    expect(closestRed.code).toBe('666');
  });

  it('handles orphan color despeckling remapping correctly', () => {
    const paletteWithLab = prepareDmcPalette(dmcCatalog);
    // Grid with 98 black drills and 2 stray white drills
    const grid: string[][] = Array.from({ length: 10 }, () => new Array(10).fill('310'));
    grid[0][0] = 'BLANC';
    grid[0][1] = 'BLANC';

    // Count
    const counts = new Map<string, number>();
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const c = grid[y][x];
        counts.set(c, (counts.get(c) || 0) + 1);
      }
    }

    const minThreshold = 5; // Stray cells (< 5) should be eliminated
    const surviving = paletteWithLab.filter(c => (counts.get(c.code) || 0) >= minThreshold);

    expect(surviving.length).toBe(1);
    expect(surviving[0].code).toBe('310');

    // Remap orphans
    const remapping = new Map<string, string>();
    for (const c of paletteWithLab) {
      if ((counts.get(c.code) || 0) < minThreshold && (counts.get(c.code) || 0) > 0) {
        const closestSurviving = findClosestDmc(c.lab, surviving);
        remapping.set(c.code, closestSurviving.code);
      }
    }

    expect(remapping.get('BLANC')).toBe('310');

    // Apply
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const cur = grid[y][x];
        if (remapping.has(cur)) {
          grid[y][x] = remapping.get(cur)!;
        }
      }
    }

    // Grid should now be 100% 310
    expect(grid[0][0]).toBe('310');
    expect(grid[0][1]).toBe('310');
  });
});
