import type { ActivePaletteItem, DrillShape, ViewMode } from '../types/diamond';

export interface RendererOptions {
  canvas: HTMLCanvasElement;
  grid: string[][];
  activePalette: ActivePaletteItem[];
  gridWidth: number;
  gridHeight: number;
  drillShape: DrillShape;
  viewMode: ViewMode;
  splitRatio: number;
  panX: number;
  panY: number;
  zoom: number;
  cellSize: number; // default base cell size, e.g. 24px
  hoveredCell?: { x: number; y: number } | null;
}

export function drawDiamondArtCanvas(options: RendererOptions) {
  const {
    canvas,
    grid,
    activePalette,
    gridWidth,
    gridHeight,
    drillShape,
    viewMode,
    splitRatio,
    panX,
    panY,
    zoom,
    cellSize,
    hoveredCell
  } = options;

  const ctx = canvas.getContext('2d');
  if (!ctx || gridWidth === 0 || gridHeight === 0 || grid.length === 0) return;

  const width = canvas.width;
  const height = canvas.height;

  // Clear canvas
  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = '#0f172a'; // Slate-900 background
  ctx.fillRect(0, 0, width, height);

  // Lookup map for fast palette item retrieval
  const paletteMap = new Map<string, ActivePaletteItem>();
  for (let i = 0; i < activePalette.length; i++) {
    paletteMap.set(activePalette[i].code, activePalette[i]);
  }

  // Pre-calculate effective cell size
  const effectiveCellSize = cellSize * zoom;

  // Viewport culling bounds
  const minX = Math.max(0, Math.floor(-panX / effectiveCellSize));
  const maxX = Math.min(gridWidth - 1, Math.ceil((width - panX) / effectiveCellSize));
  const minY = Math.max(0, Math.floor(-panY / effectiveCellSize));
  const maxY = Math.min(gridHeight - 1, Math.ceil((height - panY) / effectiveCellSize));

  if (minX > maxX || minY > maxY) {
    ctx.restore();
    return;
  }

  // Setup transform
  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  // Board canvas background
  const totalPixelW = gridWidth * cellSize;
  const totalPixelH = gridHeight * cellSize;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, totalPixelW, totalPixelH);

  // Helper renderers
  const renderCellChart = (x: number, y: number, item: ActivePaletteItem | undefined) => {
    const px = x * cellSize;
    const py = y * cellSize;

    if (item) {
      ctx.fillStyle = item.hex;
      ctx.fillRect(px, py, cellSize, cellSize);

      // Draw symbol if cell is large enough to read
      if (effectiveCellSize >= 9) {
        ctx.fillStyle = item.contrastColor;
        ctx.font = `bold ${Math.max(8, Math.round(cellSize * 0.65))}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.symbol, px + cellSize / 2, py + cellSize / 2 + 1);
      }
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px, py, cellSize, cellSize);
    }
  };

  const renderCellRealistic = (x: number, y: number, item: ActivePaletteItem | undefined) => {
    const px = x * cellSize;
    const py = y * cellSize;
    const color = item ? item.hex : '#ffffff';

    if (drillShape === 'square') {
      const pad = cellSize * 0.04;
      const drillW = cellSize - pad * 2;
      const cornerRadius = cellSize * 0.12;

      // Base drill
      ctx.fillStyle = color;
      drawRoundedRect(ctx, px + pad, py + pad, drillW, drillW, cornerRadius);
      ctx.fill();

      // Top-left specular bevel highlight
      const grad = ctx.createLinearGradient(px + pad, py + pad, px + pad + drillW, py + pad + drillW);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
      grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.0)');
      grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.0)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
      ctx.fillStyle = grad;
      drawRoundedRect(ctx, px + pad, py + pad, drillW, drillW, cornerRadius);
      ctx.fill();

      // Inner facet shine dot
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillRect(px + pad + drillW * 0.2, py + pad + drillW * 0.2, drillW * 0.2, drillW * 0.2);
    } else {
      // Round drill
      const radius = (cellSize * 0.46);
      const cx = px + cellSize / 2;
      const cy = py + cellSize / 2;

      // Base circle
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Radial 3D resin highlight
      const grad = ctx.createRadialGradient(
        cx - radius * 0.3,
        cy - radius * 0.3,
        radius * 0.05,
        cx,
        cy,
        radius
      );
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
      grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.1)');
      grad.addColorStop(0.85, 'rgba(0, 0, 0, 0.0)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.5)');

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  };

  // Render pass according to viewMode
  if (viewMode === 'symbols') {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const code = grid[y][x];
        const item = paletteMap.get(code);
        renderCellChart(x, y, item);
      }
    }
  } else if (viewMode === 'simulated') {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const code = grid[y][x];
        const item = paletteMap.get(code);
        renderCellRealistic(x, y, item);
      }
    }
  } else if (viewMode === 'split') {
    const splitX = gridWidth * splitRatio;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const code = grid[y][x];
        const item = paletteMap.get(code);
        if (x < splitX) {
          renderCellChart(x, y, item);
        } else {
          renderCellRealistic(x, y, item);
        }
      }
    }
  }

  // Draw Grid Lines (only when zoomed in enough or in Chart mode)
  if (viewMode === 'symbols' || viewMode === 'split') {
    // 1. Thin cell lines
    if (effectiveCellSize >= 8) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();

      for (let x = minX; x <= maxX + 1; x++) {
        ctx.moveTo(x * cellSize, minY * cellSize);
        ctx.lineTo(x * cellSize, (maxY + 1) * cellSize);
      }
      for (let y = minY; y <= maxY + 1; y++) {
        ctx.moveTo(minX * cellSize, y * cellSize);
        ctx.lineTo((maxX + 1) * cellSize, y * cellSize);
      }
      ctx.stroke();
    }

    // 2. Bold 10x10 ruler lines
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.lineWidth = Math.max(1.5, 2.5 / zoom);
    ctx.beginPath();

    const rulerMinX = Math.floor(minX / 10) * 10;
    const rulerMaxX = Math.ceil((maxX + 1) / 10) * 10;
    for (let x = rulerMinX; x <= rulerMaxX; x += 10) {
      if (x >= 0 && x <= gridWidth) {
        ctx.moveTo(x * cellSize, 0);
        ctx.lineTo(x * cellSize, totalPixelH);
      }
    }

    const rulerMinY = Math.floor(minY / 10) * 10;
    const rulerMaxY = Math.ceil((maxY + 1) / 10) * 10;
    for (let y = rulerMinY; y <= rulerMaxY; y += 10) {
      if (y >= 0 && y <= gridHeight) {
        ctx.moveTo(0, y * cellSize);
        ctx.lineTo(totalPixelW, y * cellSize);
      }
    }
    ctx.stroke();
  }

  // Draw Hover highlight if inside bounds
  if (hoveredCell && hoveredCell.x >= 0 && hoveredCell.x < gridWidth && hoveredCell.y >= 0 && hoveredCell.y < gridHeight) {
    ctx.strokeStyle = '#38bdf8'; // Sky-400
    ctx.lineWidth = Math.max(2, 3 / zoom);
    ctx.strokeRect(hoveredCell.x * cellSize, hoveredCell.y * cellSize, cellSize, cellSize);
  }

  // Draw Split Divider Line if in split mode
  if (viewMode === 'split') {
    const dividerX = gridWidth * splitRatio * cellSize;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = Math.max(2, 3 / zoom);
    ctx.beginPath();
    ctx.moveTo(dividerX, 0);
    ctx.lineTo(dividerX, totalPixelH);
    ctx.stroke();
  }

  ctx.restore();
  ctx.restore();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
