import type {
  ActivePaletteItem,
  DmcColor,
  QuantizeWorkerInput,
  QuantizeWorkerOutput
} from '../types/diamond';
import {
  prepareDmcPalette,
  findClosestDmc,
  rgbToLab,
  deltaE76,
  calculateLuminance
} from '../utils/colorMath';
import symbolsList from '../assets/symbols.json';

self.onmessage = (e: MessageEvent<QuantizeWorkerInput>) => {
  const { imageDataBuffer, imageWidth, imageHeight, config, dmcPalette } = e.data;

  try {
    const postProgress = (progress: number, stage: string) => {
      self.postMessage({ type: 'PROGRESS', progress, stage });
    };

    postProgress(5, 'Preparing DMC Palette...');
    const dmcWithLab = prepareDmcPalette(dmcPalette);

    postProgress(15, 'Converting pixels to perceptual color space...');
    const totalPixels = imageWidth * imageHeight;
    const pixelLabs: [number, number, number][] = new Array(totalPixels);
    const pixelRgbFloat: Float32Array = new Float32Array(totalPixels * 3);

    for (let i = 0; i < totalPixels; i++) {
      const offset = i * 4;
      const r = imageDataBuffer[offset];
      const g = imageDataBuffer[offset + 1];
      const b = imageDataBuffer[offset + 2];

      pixelRgbFloat[i * 3] = r;
      pixelRgbFloat[i * 3 + 1] = g;
      pixelRgbFloat[i * 3 + 2] = b;

      pixelLabs[i] = rgbToLab(r, g, b);
    }

    // K-Means++ Clustering in CIELAB
    const k = Math.min(config.maxColors, dmcWithLab.length, totalPixels);
    postProgress(25, `Clustering ${k} prominent color centroids...`);

    const centroids: [number, number, number][] = [];
    // 1. Pick first centroid at random
    centroids.push([...pixelLabs[Math.floor(Math.random() * totalPixels)]]);

    // 2. Pick remaining centroids proportional to distance squared
    const distances = new Float64Array(totalPixels);
    for (let c = 1; c < k; c++) {
      let sumDistSq = 0;
      for (let i = 0; i < totalPixels; i++) {
        let minDist = Infinity;
        const pLab = pixelLabs[i];
        for (let j = 0; j < centroids.length; j++) {
          const d = deltaE76(pLab, centroids[j]);
          if (d < minDist) minDist = d;
        }
        distances[i] = minDist * minDist;
        sumDistSq += distances[i];
      }

      let r = Math.random() * sumDistSq;
      let chosenIdx = totalPixels - 1;
      for (let i = 0; i < totalPixels; i++) {
        r -= distances[i];
        if (r <= 0) {
          chosenIdx = i;
          break;
        }
      }
      centroids.push([...pixelLabs[chosenIdx]]);
    }

    // 3. Iterative refinement (10 iterations)
    const MAX_ITERATIONS = 10;
    const assignments = new Int32Array(totalPixels);

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      let changed = 0;
      for (let i = 0; i < totalPixels; i++) {
        let minDist = Infinity;
        let bestCluster = 0;
        const pLab = pixelLabs[i];
        for (let c = 0; c < k; c++) {
          const d = deltaE76(pLab, centroids[c]);
          if (d < minDist) {
            minDist = d;
            bestCluster = c;
          }
        }
        if (assignments[i] !== bestCluster) {
          assignments[i] = bestCluster;
          changed++;
        }
      }

      // Recompute centroids
      const sumsL = new Float64Array(k);
      const sumsA = new Float64Array(k);
      const sumsB = new Float64Array(k);
      const counts = new Int32Array(k);

      for (let i = 0; i < totalPixels; i++) {
        const cluster = assignments[i];
        sumsL[cluster] += pixelLabs[i][0];
        sumsA[cluster] += pixelLabs[i][1];
        sumsB[cluster] += pixelLabs[i][2];
        counts[cluster]++;
      }

      for (let c = 0; c < k; c++) {
        if (counts[c] > 0) {
          centroids[c][0] = sumsL[c] / counts[c];
          centroids[c][1] = sumsA[c] / counts[c];
          centroids[c][2] = sumsB[c] / counts[c];
        }
      }

      if (changed / totalPixels < 0.01) break; // Converged
    }

    postProgress(50, 'Matching centroids to official DMC floss...');
    // Snap centroids to DMC Palette & deduplicate
    const candidateMap = new Map<string, DmcColor & { lab: [number, number, number] }>();
    for (const centroid of centroids) {
      const match = findClosestDmc(centroid, dmcWithLab);
      candidateMap.set(match.code, match);
    }

    // Ensure we have at least 1 candidate color
    if (candidateMap.size === 0) {
      candidateMap.set(dmcWithLab[0].code, dmcWithLab[0]);
    }
    const candidateDmcList = Array.from(candidateMap.values());

    postProgress(65, 'Applying Floyd-Steinberg dithering...');
    // Copy RGB float buffer for error diffusion
    const workRgb = new Float32Array(pixelRgbFloat);
    const grid: string[][] = Array.from({ length: imageHeight }, () => new Array(imageWidth));
    const alpha = Math.max(0, Math.min(1, config.ditheringStrength));

    for (let y = 0; y < imageHeight; y++) {
      for (let x = 0; x < imageWidth; x++) {
        const idx = y * imageWidth + x;
        const curR = Math.max(0, Math.min(255, workRgb[idx * 3]));
        const curG = Math.max(0, Math.min(255, workRgb[idx * 3 + 1]));
        const curB = Math.max(0, Math.min(255, workRgb[idx * 3 + 2]));

        const curLab = rgbToLab(curR, curG, curB);
        const match = findClosestDmc(curLab, candidateDmcList);
        grid[y][x] = match.code;

        if (alpha > 0) {
          const errR = (curR - match.r) * alpha;
          const errG = (curG - match.g) * alpha;
          const errB = (curB - match.b) * alpha;

          // (x+1, y) += 7/16
          if (x + 1 < imageWidth) {
            const nIdx = (y * imageWidth + (x + 1)) * 3;
            workRgb[nIdx] += errR * (7 / 16);
            workRgb[nIdx + 1] += errG * (7 / 16);
            workRgb[nIdx + 2] += errB * (7 / 16);
          }
          // (x-1, y+1) += 3/16
          if (x - 1 >= 0 && y + 1 < imageHeight) {
            const nIdx = ((y + 1) * imageWidth + (x - 1)) * 3;
            workRgb[nIdx] += errR * (3 / 16);
            workRgb[nIdx + 1] += errG * (3 / 16);
            workRgb[nIdx + 2] += errB * (3 / 16);
          }
          // (x, y+1) += 5/16
          if (y + 1 < imageHeight) {
            const nIdx = ((y + 1) * imageWidth + x) * 3;
            workRgb[nIdx] += errR * (5 / 16);
            workRgb[nIdx + 1] += errG * (5 / 16);
            workRgb[nIdx + 2] += errB * (5 / 16);
          }
          // (x+1, y+1) += 1/16
          if (x + 1 < imageWidth && y + 1 < imageHeight) {
            const nIdx = ((y + 1) * imageWidth + (x + 1)) * 3;
            workRgb[nIdx] += errR * (1 / 16);
            workRgb[nIdx + 1] += errG * (1 / 16);
            workRgb[nIdx + 2] += errB * (1 / 16);
          }
        }
      }
    }

    postProgress(85, 'Cleaning orphan colors & despeckling...');
    // Despeckling: count occurrences
    const colorCounts = new Map<string, number>();
    for (let y = 0; y < imageHeight; y++) {
      for (let x = 0; x < imageWidth; x++) {
        const code = grid[y][x];
        colorCounts.set(code, (colorCounts.get(code) || 0) + 1);
      }
    }

    const minThreshold = config.minColorThreshold || 0;
    if (minThreshold > 0) {
      const surviving = candidateDmcList.filter(c => (colorCounts.get(c.code) || 0) >= minThreshold);
      // Only filter if at least 1 color survives
      if (surviving.length > 0 && surviving.length < candidateDmcList.length) {
        const remapping = new Map<string, string>();
        for (const candidate of candidateDmcList) {
          if ((colorCounts.get(candidate.code) || 0) < minThreshold) {
            const closestSurviving = findClosestDmc(candidate.lab, surviving);
            remapping.set(candidate.code, closestSurviving.code);
          }
        }

        for (let y = 0; y < imageHeight; y++) {
          for (let x = 0; x < imageWidth; x++) {
            const curCode = grid[y][x];
            if (remapping.has(curCode)) {
              grid[y][x] = remapping.get(curCode)!;
            }
          }
        }
      }
    }

    postProgress(95, 'Assigning symbols and generating inventory...');
    // Final count and symbol assignment
    const finalCounts = new Map<string, number>();
    for (let y = 0; y < imageHeight; y++) {
      for (let x = 0; x < imageWidth; x++) {
        const code = grid[y][x];
        finalCounts.set(code, (finalCounts.get(code) || 0) + 1);
      }
    }

    // Build active palette list sorted by count descending
    const activePalette: ActivePaletteItem[] = [];
    const usedDmcCodes = Array.from(finalCounts.keys());
    const dmcLookup = new Map(dmcWithLab.map(c => [c.code, c]));

    const sortedCodes = usedDmcCodes.sort((a, b) => (finalCounts.get(b) || 0) - (finalCounts.get(a) || 0));

    const symbols: string[] = Array.isArray(symbolsList) ? symbolsList : [];

    for (let i = 0; i < sortedCodes.length; i++) {
      const code = sortedCodes[i];
      const dmc = dmcLookup.get(code) || {
        code,
        name: `DMC ${code}`,
        r: 128,
        g: 128,
        b: 128,
        hex: '#808080',
        lab: [50, 0, 0] as [number, number, number]
      };

      const symbol = i < symbols.length ? symbols[i] : String.fromCharCode(65 + (i % 26)) + Math.floor(i / 26);
      const contrastColor = calculateLuminance(dmc.r, dmc.g, dmc.b) > 140 ? '#000000' : '#FFFFFF';

      activePalette.push({
        ...dmc,
        symbol,
        count: finalCounts.get(code) || 0,
        contrastColor
      });
    }

    postProgress(100, 'Done');
    const result: QuantizeWorkerOutput = {
      grid,
      activePalette,
      gridWidth: imageWidth,
      gridHeight: imageHeight
    };

    self.postMessage({ type: 'SUCCESS', result });
  } catch (error: any) {
    self.postMessage({ type: 'ERROR', error: error?.message || String(error) });
  }
};
