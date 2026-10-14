# Feature Implementation Plan: Colorless / Mystery Canvas PDF Export Mode

## 1. Objective & Context
Add a **Colorless Grid (Symbols & Outlines Only)** option to the PDF export pipeline in `diamond-art-generator`[cite: 1].

This mode serves three practical physical workflows:
1. **Manual Tracing / Lightbox / Glass Transfer:** Printing pure black symbols and crisp wireframe cell borders on white paper makes it dramatically higher-contrast when placed underneath glass, acrylic sheets, or canvas on a lightbox.
2. **Toner / Gel Medium Transfer:** Eliminating the 35% background color tint prevents gray/colored toner from transferring into the background of the canvas, leaving only sharp black outlines and symbols.
3. **"Mystery" Diamond Painting & Ink Saver:** Hides the underlying image colors on the pattern grid so the artwork is only revealed as drills are placed, while saving 100% of color ink on the tiled pattern pages (Page 1 Legend retains color swatches so the user still knows which DMC bag matches each symbol).

---

## 2. Affected Files
1. `src/types/diamond.ts` — Add `colorlessGrid?: boolean` to `PdfExportOptions`[cite: 1].
2. `src/composables/usePdfExporter.ts` — Update cell rendering in `exportToPdf` to skip background RGB fills (`'S'` stroke-only instead of `'FD'` fill-and-stroke) and increase border/symbol contrast when `colorlessGrid` is enabled[cite: 1].
3. `src/components/ExportModal.vue` — Add the `colorlessGrid` reactive toggle switch, helper description, and summary indicator[cite: 1].
4. `tests/pdfExporter.test.ts` — Add unit tests verifying colorless PDF generation (both standalone and combined with horizontal mirroring)[cite: 1].

---

## 3. Step-by-Step Implementation Tasks

### Task 1: Extend Export Options Contract (`src/types/diamond.ts`)
- **Action:** Update the `PdfExportOptions` interface in `src/types/diamond.ts` to include `colorlessGrid`[cite: 1].
- **Code Specification:**

```typescript
export interface PdfExportOptions {
  paperFormat: 'a4' | 'letter' | 'full';
  mirrorHorizontal: boolean;
  colorlessGrid?: boolean;
}
```

---

### Task 2: Update PDF Vector Rendering Engine (`src/composables/usePdfExporter.ts`)
- **Action:** Update `exportToPdf` in `src/composables/usePdfExporter.ts` to normalize `colorlessGrid` and render stroke-only wireframe cells with pure black symbols when enabled[cite: 1].
- **Technical Requirements:**
  1. **Option Normalization:**
     - Extract `const colorlessGrid = typeof options === 'object' ? Boolean(options.colorlessGrid) : false;`.
  2. **Page 1 Legend Metadata:**
     - Keep color swatches on Page 1 so the inventory remains usable.
     - Append style metadata to the subtitle on Page 1:
       `Grid Style: ${colorlessGrid ? 'B&W Wireframe (Mystery / Transfer)' : 'Tinted Color'}`.
  3. **Page 2+ Tile Header Metadata:**
     - Append `| [B&W MYSTERY / TRANSFER]` to `headerText` when `colorlessGrid` is active.
  4. **Cell Rendering (Wireframe vs. Tinted Fill):**
     - **When `colorlessGrid === true`:**
       - Do not call `doc.setFillColor(...)`.
       - Set slightly darker, crisper cell borders (`doc.setDrawColor(150, 150, 150)` and `doc.setLineWidth(0.1)`) so the uncolored grid is easy to see under glass or canvas.
       - For `square` drills: call `doc.rect(cellX, cellY, drillSizeMm, drillSizeMm, 'S')` (Stroke only, no fill).
       - For `round` drills: call `doc.rect(cellX, cellY, drillSizeMm, drillSizeMm, 'S')` with light gray (`180, 180, 180`) and `doc.circle(cellX + drillSizeMm / 2, cellY + drillSizeMm / 2, drillSizeMm * 0.45, 'S')` with darker gray (`120, 120, 120`) in Stroke-only mode (`'S'`).
       - Set symbol text color to pure black (`doc.setTextColor(0, 0, 0)`).
     - **When `colorlessGrid === false` (Default):**
       - Retain the 35% RGB + 65% white background tint and `'FD'` (Fill + Draw) rendering.
  5. **10x10 Major Grid Lines:**
     - When `colorlessGrid === true`, draw the 10x10 major grid lines in pure black (`doc.setDrawColor(20, 20, 20)`, `doc.setLineWidth(0.3)`) for maximum visibility during manual tracing or glass work.
  6. **Output Filename:**
     - Append `-bw` to the saved filename when `colorlessGrid` is enabled:
       `diamond-art-${config.widthCm}x${config.heightCm}cm-${paperFormat}${mirrorSuffix}${bwSuffix}.pdf`

- **Complete Replacement Code for `src/composables/usePdfExporter.ts`:**

```typescript
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ProjectConfig, PaletteItem, PdfExportOptions } from '../types/diamond';

export function usePdfExporter() {
  const exportToPdf = (
    config: ProjectConfig,
    gridData: Uint16Array,
    palette: PaletteItem[],
    options: Partial<PdfExportOptions> | 'a4' | 'letter' | 'full' = 'a4'
  ) => {
    const paperFormat = typeof options === 'string' ? options : (options.paperFormat ?? 'a4');
    const mirrorHorizontal = typeof options === 'object' ? Boolean(options.mirrorHorizontal) : false;
    const colorlessGrid = typeof options === 'object' ? Boolean(options.colorlessGrid) : false;

    const drillSizeMm = config.drillShape === 'square' ? 2.5 : 2.8;
    const totalWidthMm = config.gridCols * drillSizeMm;
    const totalHeightMm = config.gridRows * drillSizeMm;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // PAGE 1: COVER & DMC INVENTORY LEGEND (Always unmirrored & with color swatches)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Diamond Art Pattern & Inventory', 14, 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    const modeLabel = mirrorHorizontal ? 'MIRRORED (Face-Down Transfer)' : 'Standard (Direct Read)';
    const styleLabel = colorlessGrid ? 'B&W Wireframe (Mystery / Tracing)' : 'Tinted Color';
    doc.text(
      `Canvas Size: ${config.widthCm}x${config.heightCm} cm  |  Grid: ${config.gridCols}x${config.gridRows} drills  |  Drill: ${config.drillShape.toUpperCase()} (${drillSizeMm}mm)`,
      14,
      28
    );
    doc.text(
      `Orientation: ${modeLabel}  |  Grid Style: ${styleLabel}  |  Colors: ${palette.length}`,
      14,
      34
    );

    const tableBody = palette.map((item) => {
      const safetyCount = Math.ceil(item.count * 1.2);
      const weightGrams = ((safetyCount / 1000) * 5.5).toFixed(1);
      return [
        item.symbol,
        item.dmc.code,
        item.dmc.name,
        '',
        item.count.toLocaleString(),
        safetyCount.toLocaleString(),
        `${weightGrams} g`
      ];
    });

    autoTable(doc, {
      startY: 40,
      head: [['Sym', 'DMC', 'Color Name', 'Swatch', 'Exact Drills', '+20% Buffer', 'Est. Weight']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold' },
        1: { halign: 'center' },
        3: { cellWidth: 16 },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' }
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const item = palette[data.row.index];
          if (item) {
            const [r, g, b] = item.dmc.rgb;
            doc.setFillColor(r, g, b);
            doc.setDrawColor(180, 180, 180);
            doc.rect(
              data.cell.x + 2,
              data.cell.y + 1.5,
              data.cell.width - 4,
              data.cell.height - 3,
              'FD'
            );
          }
        }
      }
    });

    // PAGE 2+: 1:1 PHYSICAL SCALE TILED PATTERN GRID
    const marginMm = 15;
    let pageWidthMm = 210;
    let pageHeightMm = 297;

    if (paperFormat === 'letter') {
      pageWidthMm = 215.9;
      pageHeightMm = 279.4;
    } else if (paperFormat === 'full') {
      pageWidthMm = totalWidthMm + marginMm * 2;
      pageHeightMm = totalHeightMm + marginMm * 2;
    }

    const printableWidthMm = pageWidthMm - marginMm * 2;
    const printableHeightMm = pageHeightMm - marginMm * 2;

    const colsPerTile = Math.max(1, Math.floor(printableWidthMm / drillSizeMm));
    const rowsPerTile = Math.max(1, Math.floor(printableHeightMm / drillSizeMm));

    const totalTileCols = Math.ceil(config.gridCols / colsPerTile);
    const totalTileRows = Math.ceil(config.gridRows / rowsPerTile);
    const mmToPt = 72 / 25.4;

    for (let tRow = 0; tRow < totalTileRows; tRow++) {
      for (let tCol = 0; tCol < totalTileCols; tCol++) {
        const effectiveTileCol = mirrorHorizontal ? (totalTileCols - 1 - tCol) : tCol;

        doc.addPage([pageWidthMm, pageHeightMm], pageWidthMm > pageHeightMm ? 'landscape' : 'portrait');

        const startCol = effectiveTileCol * colsPerTile;
        const endCol = Math.min(startCol + colsPerTile, config.gridCols);
        const startRow = tRow * rowsPerTile;
        const endRow = Math.min(startRow + rowsPerTile, config.gridRows);

        const tileColsCount = endCol - startCol;
        const tileRowsCount = endRow - startRow;
        const tileWidthMm = tileColsCount * drillSizeMm;
        const tileHeightMm = tileRowsCount * drillSizeMm;

        // Unmirrored Header Metadata
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        const headerText =
          `Tile [Row ${tRow + 1}/${totalTileRows}, Col ${tCol + 1}/${totalTileCols}]  |  ` +
          `Cols ${startCol + 1}-${endCol}, Rows ${startRow + 1}-${endRow}  |  ` +
          `1:1 Scale (${drillSizeMm}mm)` +
          `${mirrorHorizontal ? '  |  [MIRRORED]' : ''}` +
          `${colorlessGrid ? '  |  [B&W WIREFRAME]' : ''}`;
        doc.text(headerText, marginMm, marginMm - 6);

        // Apply Horizontal Mirror Transformation Matrix if enabled
        if (mirrorHorizontal) {
          const pageWidthPt = (pageWidthMm * mmToPt).toFixed(4);
          doc.internal.write('q');
          doc.internal.write(`-1 0 0 1 ${pageWidthPt} 0 cm`);
        }

        const originX = mirrorHorizontal
          ? pageWidthMm - marginMm - tileWidthMm
          : marginMm;
        const originY = marginMm;

        // Crop Marks
        const cropLen = 4;
        doc.setDrawColor(120, 120, 120);
        doc.setLineWidth(0.15);
        doc.line(originX - cropLen, originY, originX, originY);
        doc.line(originX, originY - cropLen, originX, originY);
        doc.line(originX + tileWidthMm, originY, originX + tileWidthMm + cropLen, originY);
        doc.line(originX + tileWidthMm, originY - cropLen, originX + tileWidthMm, originY);
        doc.line(originX - cropLen, originY + tileHeightMm, originX, originY + tileHeightMm);
        doc.line(originX, originY + tileHeightMm, originX, originY + tileHeightMm + cropLen);
        doc.line(originX + tileWidthMm, originY + tileHeightMm, originX + tileWidthMm + cropLen, originY + tileHeightMm);
        doc.line(originX + tileWidthMm, originY + tileHeightMm, originX + tileWidthMm, originY + tileHeightMm + cropLen);

        // Grid Cells, Coordinates & Symbols
        for (let r = startRow; r < endRow; r++) {
          const localRow = r - startRow;
          const cellY = originY + localRow * drillSizeMm;

          if ((r + 1) % 5 === 0 || r === startRow) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(3.5);
            doc.setTextColor(110, 110, 110);
            doc.text(`${r + 1}`, originX - 1.2, cellY + drillSizeMm * 0.65, { align: 'right' });
          }

          for (let c = startCol; c < endCol; c++) {
            const localCol = c - startCol;
            const cellX = originX + localCol * drillSizeMm;

            if (r === startRow && ((c + 1) % 5 === 0 || c === startCol)) {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(3.5);
              doc.setTextColor(110, 110, 110);
              doc.text(`${c + 1}`, cellX + drillSizeMm / 2, originY - 1.2, { align: 'center' });
            }

            const paletteIdx = gridData[r * config.gridCols + c];
            const item = palette[paletteIdx];
            if (!item) continue;

            if (colorlessGrid) {
              // B&W Mystery / Transfer Mode: Pure stroke outlines, zero color fill
              doc.setLineWidth(0.1);
              if (config.drillShape === 'square') {
                doc.setDrawColor(150, 150, 150);
                doc.rect(cellX, cellY, drillSizeMm, drillSizeMm, 'S');
              } else {
                doc.setDrawColor(200, 200, 200);
                doc.rect(cellX, cellY, drillSizeMm, drillSizeMm, 'S');
                doc.setDrawColor(130, 130, 130);
                doc.circle(
                  cellX + drillSizeMm / 2,
                  cellY + drillSizeMm / 2,
                  drillSizeMm * 0.45,
                  'S'
                );
              }
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(drillSizeMm * 1.85);
              doc.setTextColor(0, 0, 0);
            } else {
              // Standard Tinted Color Mode
              const [red, green, blue] = item.dmc.rgb;
              const tintR = Math.round(red * 0.35 + 255 * 0.65);
              const tintG = Math.round(green * 0.35 + 255 * 0.65);
              const tintB = Math.round(blue * 0.35 + 255 * 0.65);

              doc.setFillColor(tintR, tintG, tintB);
              doc.setDrawColor(190, 190, 190);
              doc.setLineWidth(0.08);

              if (config.drillShape === 'square') {
                doc.rect(cellX, cellY, drillSizeMm, drillSizeMm, 'FD');
              } else {
                doc.rect(cellX, cellY, drillSizeMm, drillSizeMm, 'S');
                doc.circle(
                  cellX + drillSizeMm / 2,
                  cellY + drillSizeMm / 2,
                  drillSizeMm * 0.45,
                  'FD'
                );
              }
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(drillSizeMm * 1.85);
              doc.setTextColor(15, 15, 15);
            }

            doc.text(
              item.symbol,
              cellX + drillSizeMm / 2,
              cellY + drillSizeMm * 0.73,
              { align: 'center' }
            );
          }
        }

        // 10x10 Major Grid Lines
        if (colorlessGrid) {
          doc.setDrawColor(20, 20, 20);
          doc.setLineWidth(0.3);
        } else {
          doc.setDrawColor(60, 60, 60);
          doc.setLineWidth(0.25);
        }

        for (let c = startCol; c <= endCol; c++) {
          if (c % 10 === 0) {
            const x = originX + (c - startCol) * drillSizeMm;
            doc.line(x, originY, x, originY + tileHeightMm);
          }
        }
        for (let r = startRow; r <= endRow; r++) {
          if (r % 10 === 0) {
            const y = originY + (r - startRow) * drillSizeMm;
            doc.line(originX, y, originX + tileWidthMm, y);
          }
        }

        if (mirrorHorizontal) {
          doc.internal.write('Q');
        }
      }
    }

    const mirrorSuffix = mirrorHorizontal ? '-mirrored' : '';
    const bwSuffix = colorlessGrid ? '-bw' : '';
    doc.save(`diamond-art-${config.widthCm}x${config.heightCm}cm-${paperFormat}${mirrorSuffix}${bwSuffix}.pdf`);
  };

  return { exportToPdf };
}
```

---

### Task 3: Update Export Modal UI (`src/components/ExportModal.vue`)
- **Action:** Add the **Colorless / Mystery Canvas (B&W Symbols Only)** toggle switch and summary indicator to `src/components/ExportModal.vue`[cite: 1].
- **Technical Requirements:**
  1. Add `const colorlessGrid = ref(false);` to the component state.
  2. Insert a toggle card bound to `v-model="colorlessGrid"` explaining its use for **Mystery Canvases, glass/lightbox tracing, and toner transfers**.
  3. Add a `Grid Style` line in the summary box displaying `B&W Symbols Only (Mystery / Transfer)` vs. `Tinted Color Grid`.
  4. Pass `colorlessGrid: colorlessGrid.value` inside the options object passed to `exportToPdf(...)`.

- **UI Snippet to Add in `src/components/ExportModal.vue`:**

```html
<!-- Colorless / Mystery Canvas Toggle -->
<div class="rounded-lg border border-slate-700/80 bg-slate-800/60 p-3.5">
  <label class="flex items-start justify-between gap-3 cursor-pointer">
    <div>
      <span class="block text-sm font-semibold text-slate-100">
        Colorless / Mystery Canvas (Symbols Only)
      </span>
      <span class="mt-0.5 block text-xs text-slate-400 leading-relaxed">
        Prints crisp black symbols and outlines on a pure white grid with zero background color. Ideal for
        <strong>Mystery Canvases, glass/acrylic templates, lightbox tracing,</strong> and clean toner transfers.
      </span>
    </div>
    <input
      type="checkbox"
      v-model="colorlessGrid"
      class="mt-1 h-5 w-5 rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
    />
  </label>
</div>
```

- **Update `handleExport` in `src/components/ExportModal.vue`:**

```typescript
exportToPdf(store.config, store.gridData, store.palette, {
  paperFormat: selectedFormat.value,
  mirrorHorizontal: mirrorHorizontal.value,
  colorlessGrid: colorlessGrid.value
});
```

---

### Task 4: Expand Unit Test Suite (`tests/pdfExporter.test.ts`)
- **Action:** Add unit test cases in `tests/pdfExporter.test.ts` to verify colorless and combined (mirrored + colorless) exports[cite: 1].
- **Test Specification:**

```typescript
it('supports colorless B&W mystery canvas export without throwing', () => {
  const { exportToPdf } = usePdfExporter();
  expect(() => {
    exportToPdf(mockConfig, mockGrid, mockPalette, {
      paperFormat: 'a4',
      mirrorHorizontal: false,
      colorlessGrid: true
    });
  }).not.toThrow();
});

it('supports combined mirrored and colorless export for face-down transfers', () => {
  const { exportToPdf } = usePdfExporter();
  expect(() => {
    exportToPdf(mockConfig, mockGrid, mockPalette, {
      paperFormat: 'a4',
      mirrorHorizontal: true,
      colorlessGrid: true
    });
  }).not.toThrow();
});
```

---

## 4. Verification & Acceptance Criteria
- [ ] `npm run test` (Vitest) passes all unit tests in `tests/pdfExporter.test.ts`[cite: 1].
- [ ] `npm run build` (`vue-tsc` + `vite build`) compiles with zero TypeScript errors[cite: 1].
- [ ] Exporting with **Colorless / Mystery Canvas** checked produces `diamond-art-{W}x{H}cm-{format}-bw.pdf` (or `-mirrored-bw.pdf` when combined).
- [ ] Page 1 (Legend) still displays the DMC color swatches so the user can identify which drills correspond to each symbol.
- [ ] Page 2+ (Pattern Tiles) contain zero background color fills—only crisp wireframe cell borders, emphasized 10x10 major lines, and pure black symbol glyphs.