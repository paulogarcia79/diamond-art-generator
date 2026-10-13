import { describe, it, expect } from 'vitest';
import { calculateCenterCrop, downsampleImageData } from '../src/utils/imageResizer';

describe('imageResizer', () => {
  it('computes center crop rectangle to match target aspect ratio', () => {
    // Source: 1000x500 (2:1 aspect), Target: 400x500 (4:5 aspect)
    // Source is wider than target -> crops sides
    const crop = calculateCenterCrop(1000, 500, 400, 500);
    expect(crop.sHeight).toBe(500);
    expect(crop.sWidth).toBe(400); // 500 * (400/500) = 400
    expect(crop.sx).toBe(300); // (1000 - 400) / 2
    expect(crop.sy).toBe(0);

    // Source is taller than target -> crops top/bottom
    const cropTall = calculateCenterCrop(400, 1000, 400, 500);
    expect(cropTall.sWidth).toBe(400);
    expect(cropTall.sHeight).toBe(500);
    expect(cropTall.sx).toBe(0);
    expect(cropTall.sy).toBe(250); // (1000 - 500) / 2
  });

  it('downsamples image data with area averaging', () => {
    // 4x4 image with pure red in top-half and pure blue in bottom-half
    const srcW = 4;
    const srcH = 4;
    const srcData = new Uint8ClampedArray(srcW * srcH * 4);

    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        const idx = (y * srcW + x) * 4;
        if (y < 2) {
          // Red
          srcData[idx] = 200;
          srcData[idx + 1] = 0;
          srcData[idx + 2] = 0;
          srcData[idx + 3] = 255;
        } else {
          // Blue
          srcData[idx] = 0;
          srcData[idx + 1] = 0;
          srcData[idx + 2] = 200;
          srcData[idx + 3] = 255;
        }
      }
    }

    const mockImageData = {
      data: srcData,
      width: srcW,
      height: srcH
    } as ImageData;

    // Downsample to 2x2
    const result = downsampleImageData(mockImageData, 2, 2);
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);

    // Top-left cell (y=0, x=0) should be pure Red (200, 0, 0)
    expect(result.data[0]).toBe(200);
    expect(result.data[1]).toBe(0);
    expect(result.data[2]).toBe(0);

    // Bottom-left cell (y=1, x=0) should be pure Blue (0, 0, 200)
    const bLeftIdx = (1 * 2 + 0) * 4;
    expect(result.data[bLeftIdx]).toBe(0);
    expect(result.data[bLeftIdx + 1]).toBe(0);
    expect(result.data[bLeftIdx + 2]).toBe(200);
  });
});
