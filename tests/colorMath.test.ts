import { describe, it, expect } from 'vitest';
import {
  rgbToLab,
  deltaE76,
  calculateLuminance,
  getContrastColor,
  findClosestDmc,
  prepareDmcPalette
} from '../src/utils/colorMath';
import type { DmcColor } from '../src/types/diamond';

describe('colorMath', () => {
  it('converts Pure White (255, 255, 255) to CIELAB correctly', () => {
    const lab = rgbToLab(255, 255, 255);
    expect(lab[0]).toBeCloseTo(100, 0);
    expect(Math.abs(lab[1])).toBeLessThan(1);
    expect(Math.abs(lab[2])).toBeLessThan(1);
  });

  it('converts Pure Black (0, 0, 0) to CIELAB correctly', () => {
    const lab = rgbToLab(0, 0, 0);
    expect(lab[0]).toBeCloseTo(0, 0);
    expect(Math.abs(lab[1])).toBeLessThan(0.01);
    expect(Math.abs(lab[2])).toBeLessThan(0.01);
  });

  it('calculates Delta E CIE76 accurately', () => {
    const lab1: [number, number, number] = [50, 20, -10];
    const lab2: [number, number, number] = [50, 20, -10];
    expect(deltaE76(lab1, lab2)).toBe(0);

    const lab3: [number, number, number] = [53, 24, -10];
    // sqrt((3)^2 + (4)^2 + 0^2) = 5
    expect(deltaE76(lab1, lab3)).toBeCloseTo(5, 5);
  });

  it('calculates luminance and optimal contrast colors', () => {
    // White background -> black text
    expect(calculateLuminance(255, 255, 255)).toBeCloseTo(255, 5);
    expect(getContrastColor(255, 255, 255)).toBe('#000000');

    // Black background -> white text
    expect(calculateLuminance(0, 0, 0)).toBe(0);
    expect(getContrastColor(0, 0, 0)).toBe('#FFFFFF');

    // Dark Navy (15, 23, 42) -> white text
    expect(getContrastColor(15, 23, 42)).toBe('#FFFFFF');

    // Bright Yellow (254, 240, 138) -> black text
    expect(getContrastColor(254, 240, 138)).toBe('#000000');
  });

  it('finds closest DMC color from palette correctly', () => {
    const samplePalette: DmcColor[] = [
      { code: '310', name: 'Black', r: 0, g: 0, b: 0, hex: '#000000' },
      { code: 'BLANC', name: 'White', r: 255, g: 255, b: 255, hex: '#FFFFFF' },
      { code: '666', name: 'Bright Red', r: 227, g: 29, b: 46, hex: '#E31D2E' }
    ];

    const prepared = prepareDmcPalette(samplePalette);

    // Dark grey should match Black (310)
    const darkGreyLab = rgbToLab(20, 20, 20);
    const closestDark = findClosestDmc(darkGreyLab, prepared);
    expect(closestDark.code).toBe('310');

    // Pinkish/Red should match Red (666)
    const redLab = rgbToLab(200, 30, 40);
    const closestRed = findClosestDmc(redLab, prepared);
    expect(closestRed.code).toBe('666');

    // Light cream should match White (BLANC)
    const creamLab = rgbToLab(250, 250, 240);
    const closestWhite = findClosestDmc(creamLab, prepared);
    expect(closestWhite.code).toBe('BLANC');
  });
});
