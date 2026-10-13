/**
 * Area-averaging downsampler to convert high-resolution source images into
 * crisp pixel grids of GridWidth x GridHeight without bilinear muddying.
 */

export interface CropRect {
  sx: number;
  sy: number;
  sWidth: number;
  sHeight: number;
}

/**
 * Calculates a center-crop rectangle to match the target aspect ratio
 */
export function calculateCenterCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): CropRect {
  const targetAspect = targetWidth / targetHeight;
  const sourceAspect = sourceWidth / sourceHeight;

  let sx = 0;
  let sy = 0;
  let sWidth = sourceWidth;
  let sHeight = sourceHeight;

  if (sourceAspect > targetAspect) {
    // Source is wider than target: crop sides
    sWidth = Math.round(sourceHeight * targetAspect);
    sx = Math.round((sourceWidth - sWidth) / 2);
  } else if (sourceAspect < targetAspect) {
    // Source is taller than target: crop top/bottom
    sHeight = Math.round(sourceWidth / targetAspect);
    sy = Math.round((sourceHeight - sHeight) / 2);
  }

  return { sx, sy, sWidth, sHeight };
}

/**
 * Downsamples an image onto a target grid of dimensions (targetWidth x targetHeight)
 * using true box area averaging for sharp, accurate color representation.
 */
export function downsampleImage(
  sourceImage: CanvasImageSource,
  targetWidth: number,
  targetHeight: number,
  crop?: CropRect
): ImageData {
  // 1. Draw cropped source to an intermediate canvas to access pixel data
  const sourceWidth = (sourceImage as any).naturalWidth || (sourceImage as any).videoWidth || (sourceImage as any).width;
  const sourceHeight = (sourceImage as any).naturalHeight || (sourceImage as any).videoHeight || (sourceImage as any).height;

  const cropArea = crop || calculateCenterCrop(sourceWidth, sourceHeight, targetWidth, targetHeight);

  // If source is huge, we can sample from an offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = cropArea.sWidth;
  canvas.height = cropArea.sHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Failed to get 2D canvas context for downsampling');
  }

  ctx.drawImage(
    sourceImage,
    cropArea.sx,
    cropArea.sy,
    cropArea.sWidth,
    cropArea.sHeight,
    0,
    0,
    cropArea.sWidth,
    cropArea.sHeight
  );

  const srcImageData = ctx.getImageData(0, 0, cropArea.sWidth, cropArea.sHeight);
  return downsampleImageData(srcImageData, targetWidth, targetHeight);
}

/**
 * Pure area-averaging algorithm operating directly on source ImageData
 */
export function downsampleImageData(
  srcData: ImageData,
  targetWidth: number,
  targetHeight: number
): ImageData {
  const srcW = srcData.width;
  const srcH = srcData.height;
  const srcPixels = srcData.data;

  // Output buffer: targetWidth x targetHeight x 4 (RGBA)
  const outData = new Uint8ClampedArray(targetWidth * targetHeight * 4);

  const scaleX = srcW / targetWidth;
  const scaleY = srcH / targetHeight;

  for (let ty = 0; ty < targetHeight; ty++) {
    const srcYStart = ty * scaleY;
    const srcYEnd = (ty + 1) * scaleY;

    const yStartInt = Math.floor(srcYStart);
    const yEndInt = Math.min(srcH - 1, Math.floor(srcYEnd));

    for (let tx = 0; tx < targetWidth; tx++) {
      const srcXStart = tx * scaleX;
      const srcXEnd = (tx + 1) * scaleX;

      const xStartInt = Math.floor(srcXStart);
      const xEndInt = Math.min(srcW - 1, Math.floor(srcXEnd));

      let totalWeight = 0;
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;

      for (let sy = yStartInt; sy <= yEndInt; sy++) {
        // Compute overlap weight in Y direction
        const yTop = Math.max(sy, srcYStart);
        const yBottom = Math.min(sy + 1, srcYEnd);
        const weightY = Math.max(0, yBottom - yTop);
        if (weightY <= 0) continue;

        const rowOffset = sy * srcW * 4;

        for (let sx = xStartInt; sx <= xEndInt; sx++) {
          // Compute overlap weight in X direction
          const xLeft = Math.max(sx, srcXStart);
          const xRight = Math.min(sx + 1, srcXEnd);
          const weightX = Math.max(0, xRight - xLeft);
          if (weightX <= 0) continue;

          const weight = weightX * weightY;
          const pxOffset = rowOffset + sx * 4;

          rSum += srcPixels[pxOffset] * weight;
          gSum += srcPixels[pxOffset + 1] * weight;
          bSum += srcPixels[pxOffset + 2] * weight;
          totalWeight += weight;
        }
      }

      const outIndex = (ty * targetWidth + tx) * 4;
      if (totalWeight > 0) {
        outData[outIndex] = Math.round(rSum / totalWeight);
        outData[outIndex + 1] = Math.round(gSum / totalWeight);
        outData[outIndex + 2] = Math.round(bSum / totalWeight);
        outData[outIndex + 3] = 255;
      } else {
        outData[outIndex] = 255;
        outData[outIndex + 1] = 255;
        outData[outIndex + 2] = 255;
        outData[outIndex + 3] = 255;
      }
    }
  }

  // Create an ImageData object or mock depending on environment (e.g. Node vs Browser)
  if (typeof ImageData !== 'undefined') {
    return new ImageData(outData, targetWidth, targetHeight);
  }
  return {
    data: outData,
    width: targetWidth,
    height: targetHeight,
    colorSpace: 'srgb'
  } as ImageData;
}
