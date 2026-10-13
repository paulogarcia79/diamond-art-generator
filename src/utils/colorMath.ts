import type { DmcColor } from '../types/diamond';

// D65 reference white point
const XN = 0.95047;
const YN = 1.0;
const ZN = 1.08883;

const EPSILON = 216 / 24389; // 0.00885645
const KAPPA = 24389 / 27;    // 903.296296

/**
 * Converts sRGB channel (0-255) to linear RGB (0-1)
 */
export function srgbToLinear(c: number): number {
  const norm = c / 255;
  return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

/**
 * Converts sRGB [0-255] to CIE XYZ [0-1] under D65
 */
export function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const rLin = srgbToLinear(r);
  const gLin = srgbToLinear(g);
  const bLin = srgbToLinear(b);

  const x = rLin * 0.4124564 + gLin * 0.3575761 + bLin * 0.1804375;
  const y = rLin * 0.2126729 + gLin * 0.7151522 + bLin * 0.0721750;
  const z = rLin * 0.0193339 + gLin * 0.1191920 + bLin * 0.9503041;

  return [x, y, z];
}

function fLab(t: number): number {
  return t > EPSILON ? Math.cbrt(t) : (KAPPA * t + 16) / 116;
}

/**
 * Converts CIE XYZ to CIELAB [L*, a*, b*]
 */
export function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  const xr = x / XN;
  const yr = y / YN;
  const zr = z / ZN;

  const fx = fLab(xr);
  const fy = fLab(yr);
  const fz = fLab(zr);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);

  return [L, a, b];
}

/**
 * Converts sRGB [0-255] directly to CIELAB [L*, a*, b*]
 */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const [x, y, z] = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
}

/**
 * Computes CIE76 perceptual color difference Delta E
 */
export function deltaE76(
  lab1: [number, number, number],
  lab2: [number, number, number]
): number {
  const dL = lab1[0] - lab2[0];
  const da = lab1[1] - lab2[1];
  const db = lab1[2] - lab2[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * Calculates standard perceived luminance (0-255)
 */
export function calculateLuminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Determines whether black or white text has highest contrast on given background
 */
export function getContrastColor(r: number, g: number, b: number): '#000000' | '#FFFFFF' {
  return calculateLuminance(r, g, b) > 140 ? '#000000' : '#FFFFFF';
}

/**
 * Ensures all DmcColors have precomputed LAB values
 */
export function prepareDmcPalette(palette: DmcColor[]): (DmcColor & { lab: [number, number, number] })[] {
  return palette.map(color => {
    if (color.lab && color.lab.length === 3) {
      return color as DmcColor & { lab: [number, number, number] };
    }
    return {
      ...color,
      lab: rgbToLab(color.r, color.g, color.b)
    };
  });
}

/**
 * Finds the nearest DMC color in palette for a given LAB color
 */
export function findClosestDmc(
  targetLab: [number, number, number],
  dmcPaletteWithLab: (DmcColor & { lab: [number, number, number] })[]
): DmcColor & { lab: [number, number, number] } {
  let minDistance = Infinity;
  let closest = dmcPaletteWithLab[0];

  for (let i = 0; i < dmcPaletteWithLab.length; i++) {
    const candidate = dmcPaletteWithLab[i];
    const dist = deltaE76(targetLab, candidate.lab);
    if (dist < minDistance) {
      minDistance = dist;
      closest = candidate;
    }
  }

  return closest;
}
