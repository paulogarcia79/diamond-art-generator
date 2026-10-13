import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ActivePaletteItem, ProjectConfig, PdfExportOptions } from '../types/diamond';

export { PdfExportOptions };

function writeRawPdf(doc: jsPDF, text: string) {
  (doc.internal as any).write(text);
}

export async function exportDiamondArtPdf(options: PdfExportOptions): Promise<Blob> {
  const {
    title = 'Diamond Art Pattern Template',
    config,
    grid = [],
    activePalette = [],
    gridWidth = 0,
    gridHeight = 0,
    exportMode = 'tiled',
    mirrorHorizontal = false,
    onProgress,
    thumbnailDataUrl
  } = options;

  if (!config) {
    throw new Error('Project config is required for PDF export');
  }

  const drillMm = config.drillShape === 'square' ? 2.5 : 2.8;
  const paletteMap = new Map(activePalette.map(item => [item.code, item]));
  const mmToPt = 72 / 25.4;

  const updateProgress = (pct: number, status: string) => {
    if (onProgress) onProgress(pct, status);
  };

  updateProgress(5, 'Initializing PDF document...');

  // Initialize doc
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // PAGE 1: Cover Sheet
  updateProgress(10, 'Generating cover sheet & project summary...');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(30, 41, 59);
  doc.text(title, 105, 30, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated on ${new Date().toLocaleDateString()} • Full Scaled Vector Blueprint`, 105, 38, { align: 'center' });

  // Thumbnail if provided
  let currentY = 50;
  if (thumbnailDataUrl) {
    try {
      doc.addImage(thumbnailDataUrl, 'PNG', 55, currentY, 100, 75, undefined, 'FAST');
      currentY += 85;
    } catch {
      // Fallback if image fails
    }
  }

  // Summary Specs Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(25, currentY, 160, 68, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('Project Specifications', 35, currentY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);

  const totalDrills = gridWidth * gridHeight;
  const drillTypeLabel = config.drillShape === 'square' ? 'Square (2.5 mm)' : 'Round (2.8 mm)';
  const printModeLabel = mirrorHorizontal
    ? 'MIRRORED (For Face-Down Transfer)'
    : 'Standard (Direct Print)';

  const specs = [
    `Physical Canvas Size: ${config.widthCm} cm × ${config.heightCm} cm`,
    `Grid Resolution: ${gridWidth} drills (width) × ${gridHeight} drills (height)`,
    `Drill Type & Size: ${drillTypeLabel}`,
    `Total Drills: ${totalDrills.toLocaleString()}`,
    `Active DMC Colors: ${activePalette.length} shades`,
    `Print Orientation: ${printModeLabel}`
  ];

  specs.forEach((spec, idx) => {
    doc.text(`• ${spec}`, 35, currentY + 22 + idx * 7);
  });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text('100% vector-generated. Print at 100% scale (no scaling) for exact drill match.', 105, 280, { align: 'center' });

  // PAGE 2: DMC Inventory & Shopping List
  updateProgress(20, 'Generating DMC inventory & shopping list...');
  doc.addPage('a4', 'portrait');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text('DMC Floss & Drill Inventory List', 14, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Print Mode: ${printModeLabel} | Total Colors: ${activePalette.length}`,
    14,
    27
  );

  const tableRows = activePalette.map(item => {
    const bufferCount = Math.ceil(item.count * 1.2);
    const weightGrams = (bufferCount * 0.005).toFixed(1);
    const packs = Math.ceil(bufferCount / 1000);
    return [
      item.symbol,
      '', // Swatch drawn in didDrawCell hook
      item.code,
      item.name,
      item.count.toLocaleString(),
      bufferCount.toLocaleString(),
      `${weightGrams} g (${packs} pack${packs > 1 ? 's' : ''})`
    ];
  });

  autoTable(doc, {
    startY: 34,
    margin: { left: 14, right: 14 },
    tableWidth: 182,
    head: [['Sym', 'Color', 'DMC', 'Color Name', 'Exact Count', '+20% Buffer', 'Est. Weight']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [14, 165, 233],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'center', fontStyle: 'bold' },
      3: { halign: 'left' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
      6: { halign: 'right' }
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const item = activePalette[data.row.index];
        if (item) {
          doc.setFillColor(item.r, item.g, item.b);
          doc.setDrawColor(200, 200, 200);
          doc.rect(data.cell.x + 2, data.cell.y + 2, 12, 6, 'FD');
        }
      }
    }
  });

  // PAGES 3+: PATTERN GRID
  if (exportMode === 'single') {
    // Mode A: Single Giant Blueprint Page
    updateProgress(35, 'Compiling Single Giant Blueprint vector grid...');
    const marginMm = 30; // 3cm margins
    const pageWMm = config.widthCm * 10 + marginMm * 2;
    const pageHMm = config.heightCm * 10 + marginMm * 2;

    const orientation = pageWMm > pageHMm ? 'l' : 'p';
    doc.addPage([pageWMm, pageHMm], orientation);

    // Title on Blueprint (Unmirrored)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    const blueprintTitle = `${title} (1:1 Scale)${mirrorHorizontal ? ' [MIRRORED FOR TRANSFER]' : ''}`;
    doc.text(blueprintTitle, marginMm, marginMm - 12);

    const blueprintGridWMm = gridWidth * drillMm;

    // Apply CTM horizontal reflection if enabled
    if (mirrorHorizontal) {
      const pageWidthPt = (pageWMm * mmToPt).toFixed(4);
      writeRawPdf(doc, 'q');
      writeRawPdf(doc, `-1 0 0 1 ${pageWidthPt} 0 cm`);
    }

    const startX = mirrorHorizontal ? pageWMm - marginMm - blueprintGridWMm : marginMm;
    const startY = marginMm;

    // Batch draw cells
    renderVectorGridChunk({
      doc,
      grid,
      paletteMap,
      drillMm,
      startX,
      startY,
      startCellX: 0,
      endCellX: gridWidth,
      startCellY: 0,
      endCellY: gridHeight
    });

    updateProgress(90, 'Finalizing vector lines and coordinates...');
    drawGridRulerLines({
      doc,
      startX,
      startY,
      cellCountX: gridWidth,
      cellCountY: gridHeight,
      drillMm
    });

    if (mirrorHorizontal) {
      writeRawPdf(doc, 'Q');
    }

  } else {
    // Mode B: Tiled A4 Pages
    // Each A4 page fits ~65 x 90 drills at 2.5mm scale comfortably with margins
    const tileCols = Math.max(1, Math.floor(180 / drillMm)); // ~72 drills
    const tileRows = Math.max(1, Math.floor(250 / drillMm)); // ~100 drills
    const overlap = 2; // 2 drills overlap

    const numTilesX = Math.ceil(gridWidth / (tileCols - overlap));
    const numTilesY = Math.ceil(gridHeight / (tileRows - overlap));
    const totalTiles = numTilesX * numTilesY;

    let tileIndex = 0;

    for (let ty = 0; ty < numTilesY; ty++) {
      for (let tx = 0; tx < numTilesX; tx++) {
        tileIndex++;
        const pct = Math.round(35 + (tileIndex / totalTiles) * 55);
        updateProgress(pct, `Generating Page Tile ${tileIndex} of ${totalTiles}...`);

        doc.addPage('a4', 'portrait');

        // Reverse horizontal tile order when mirrored for face-down assembly
        const effectiveTileCol = mirrorHorizontal ? (numTilesX - 1 - tx) : tx;

        const cellStartX = effectiveTileCol * (tileCols - overlap);
        const cellEndX = Math.min(gridWidth, cellStartX + tileCols);
        const cellStartY = ty * (tileRows - overlap);
        const cellEndY = Math.min(gridHeight, cellStartY + tileRows);

        const countX = cellEndX - cellStartX;
        const countY = cellEndY - cellStartY;
        const tileWidthMm = countX * drillMm;

        const marginX = (210 - tileWidthMm) / 2;
        const marginY = 30; // Leave room for header

        // Tile Header (Always Unmirrored for human cutting and assembly)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        const headerMirrorSuffix = mirrorHorizontal ? '  |  [MIRRORED FOR TRANSFER]' : '';
        doc.text(
          `${title} — Sheet [Row ${ty + 1}/${numTilesY}, Col ${tx + 1}/${numTilesX}] (Page ${tileIndex} of ${totalTiles})${headerMirrorSuffix}`,
          14,
          15
        );

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(
          `Cells X: [${cellStartX + 1} - ${cellEndX}], Y: [${cellStartY + 1} - ${cellEndY}] • 2-drill shaded overlap margin`,
          14,
          20
        );

        // Apply Horizontal Reflection Matrix if enabled
        if (mirrorHorizontal) {
          const pageWidthPt = (210 * mmToPt).toFixed(4);
          writeRawPdf(doc, 'q');
          writeRawPdf(doc, `-1 0 0 1 ${pageWidthPt} 0 cm`);
        }

        const originX = mirrorHorizontal ? (210 - marginX - tileWidthMm) : marginX;

        // Draw cells for this tile
        renderVectorGridChunk({
          doc,
          grid,
          paletteMap,
          drillMm,
          startX: originX,
          startY: marginY,
          startCellX: cellStartX,
          endCellX: cellEndX,
          startCellY: cellStartY,
          endCellY: cellEndY
        });

        // Draw grid lines
        drawGridRulerLines({
          doc,
          startX: originX,
          startY: marginY,
          cellCountX: countX,
          cellCountY: countY,
          drillMm,
          baseOffsetX: cellStartX,
          baseOffsetY: cellStartY
        });

        if (mirrorHorizontal) {
          writeRawPdf(doc, 'Q');
        }
      }
    }
  }

  updateProgress(98, 'Compressing and outputting PDF...');
  const blob = doc.output('blob');
  updateProgress(100, 'Complete');

  return blob;
}

interface GridChunkOptions {
  doc: jsPDF;
  grid: string[][];
  paletteMap: Map<string, ActivePaletteItem>;
  drillMm: number;
  startX: number;
  startY: number;
  startCellX: number;
  endCellX: number;
  startCellY: number;
  endCellY: number;
}

function renderVectorGridChunk(options: GridChunkOptions) {
  const {
    doc,
    grid,
    paletteMap,
    drillMm,
    startX,
    startY,
    startCellX,
    endCellX,
    startCellY,
    endCellY
  } = options;

  doc.setFont('courier', 'bold');
  const fontSize = drillMm * 1.8;
  doc.setFontSize(fontSize);

  for (let y = startCellY; y < endCellY; y++) {
    const posY = startY + (y - startCellY) * drillMm;

    for (let x = startCellX; x < endCellX; x++) {
      const posX = startX + (x - startCellX) * drillMm;
      const code = grid[y]?.[x];
      const item = paletteMap.get(code);

      if (item) {
        // Draw background
        doc.setFillColor(item.r, item.g, item.b);
        doc.rect(posX, posY, drillMm, drillMm, 'F');

        // Draw symbol
        const textRGB = item.contrastColor === '#000000' ? [0, 0, 0] : [255, 255, 255];
        doc.setTextColor(textRGB[0], textRGB[1], textRGB[2]);

        // Filter symbol to standard ASCII safe character if necessary
        const symbolChar = item.symbol.length === 1 ? item.symbol : item.symbol[0];
        doc.text(symbolChar, posX + drillMm / 2, posY + drillMm / 2 + (drillMm * 0.1), {
          align: 'center',
          baseline: 'middle'
        });
      }
    }
  }
}

interface RulerOptions {
  doc: jsPDF;
  startX: number;
  startY: number;
  cellCountX: number;
  cellCountY: number;
  drillMm: number;
  baseOffsetX?: number;
  baseOffsetY?: number;
}

function drawGridRulerLines(options: RulerOptions) {
  const { doc, startX, startY, cellCountX, cellCountY, drillMm, baseOffsetX = 0, baseOffsetY = 0 } = options;
  const totalW = cellCountX * drillMm;
  const totalH = cellCountY * drillMm;

  // Thin grid lines
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.05);

  for (let x = 0; x <= cellCountX; x++) {
    const lx = startX + x * drillMm;
    doc.line(lx, startY, lx, startY + totalH);
  }
  for (let y = 0; y <= cellCountY; y++) {
    const ly = startY + y * drillMm;
    doc.line(startX, ly, startX + totalW, ly);
  }

  // Bold 10x10 ruler lines
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(70, 70, 70);

  for (let x = 0; x <= cellCountX; x++) {
    const globalX = baseOffsetX + x;
    if (globalX % 10 === 0) {
      const lx = startX + x * drillMm;
      doc.line(lx, startY, lx, startY + totalH);
      // Coordinate label on top
      if (globalX > 0) {
        doc.text(String(globalX), lx, startY - 1.5, { align: 'center' });
      }
    }
  }

  for (let y = 0; y <= cellCountY; y++) {
    const globalY = baseOffsetY + y;
    if (globalY % 10 === 0) {
      const ly = startY + y * drillMm;
      doc.line(startX, ly, startX + totalW, ly);
      // Coordinate label on left
      if (globalY > 0) {
        doc.text(String(globalY), startX - 2, ly + 0.8, { align: 'right' });
      }
    }
  }
}

/**
 * Composable hook providing export functions compatible with plan 2.md specification
 */
export function usePdfExporter() {
  const exportToPdf = async (
    config: ProjectConfig,
    gridData: Uint16Array | string[][],
    palette: any[],
    options: Partial<PdfExportOptions> | 'a4' | 'letter' | 'full' = 'a4'
  ): Promise<Blob> => {
    const paperFormat = typeof options === 'string' ? options : (options.paperFormat ?? 'a4');
    const mirrorHorizontal = typeof options === 'object' ? Boolean(options.mirrorHorizontal) : false;

    const drillSizeMm = config.drillShape === 'square' ? 2.5 : 2.8;
    const gridCols = Math.max(1, Math.floor((config.widthCm * 10) / drillSizeMm));
    const gridRows = Math.max(1, Math.floor((config.heightCm * 10) / drillSizeMm));

    let grid: string[][];
    if (Array.isArray(gridData)) {
      grid = gridData as string[][];
    } else {
      grid = Array.from({ length: gridRows }, (_, r) =>
        Array.from({ length: gridCols }, (_, c) => {
          const idx = gridData[r * gridCols + c];
          const item = palette[idx];
          return item?.dmc?.code || item?.code || '310';
        })
      );
    }

    const activePalette: ActivePaletteItem[] = palette.map((p, idx) => {
      const code = p.dmc?.code || p.code || String(idx);
      const name = p.dmc?.name || p.name || `DMC ${code}`;
      const [r, g, b] = p.dmc?.rgb || [p.r ?? 0, p.g ?? 0, p.b ?? 0];
      const hex = p.hex || `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
      return {
        code,
        name,
        r,
        g,
        b,
        hex,
        symbol: p.symbol || String.fromCharCode(65 + (idx % 26)),
        count: p.count || 0,
        contrastColor: p.contrastColor || (0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? '#000000' : '#FFFFFF')
      };
    });

    const exportMode = paperFormat === 'full' ? 'single' : 'tiled';

    return exportDiamondArtPdf({
      title: 'Diamond Art Pattern & Inventory',
      config,
      grid,
      activePalette,
      gridWidth: grid[0]?.length || gridCols,
      gridHeight: grid.length || gridRows,
      exportMode,
      paperFormat,
      mirrorHorizontal
    });
  };

  return { exportToPdf, exportDiamondArtPdf };
}
