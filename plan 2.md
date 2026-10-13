# Feature Implementation Plan: Horizontal Mirror / Flip PDF Export

## 1. Objective & Context
Enable a **Mirror / Flip Horizontally** mode in the PDF export pipeline of `diamond-art-generator`.  
When physically transferring printed templates face-down onto a raw cotton canvas (e.g., via Acrylic Gel Medium / Laser Toner transfer), the physical transfer inverts the image and symbols horizontally.

To ensure the final transferred canvas reads in the correct orientation:
1. **Page 1 (Cover & DMC Inventory Legend):** Must remain in **normal (unmirrored) orientation** for direct human reference.
2. **Page 2+ (1:1 Physical Scale Pattern Tiles):** Must reverse horizontal tile ordering (`totalTileCols - 1 - tCol`) AND apply a PDF Current Transformation Matrix (CTM) horizontal reflection (`-1 0 0 1 pageWidthPt 0 cm`) so both the cell positions and vector font glyphs (`A`, `R`, `3`, etc.) are physically mirrored on the printed page.

---

## 2. Affected Files
1. `src/types/diamond.ts` — Add `PdfExportOptions` type definition.
2. `src/composables/usePdfExporter.ts` — Update `exportToPdf` signature, CTM graphics state logic, tile ordering, and output filename.
3. `src/components/ExportModal.vue` — Add reactive `mirrorHorizontal` state, toggle UI control, summary indicator, and payload pass-through.
4. `tests/pdfExporter.test.ts` — Add unit tests verifying backward compatibility and mirrored PDF generation.

---

## 3. Step-by-Step Implementation Tasks

### Task 1: Define Export Options Contract (`src/types/diamond.ts`)
- **Action:** Append the `PdfExportOptions` interface to `src/types/diamond.ts`.
- **Code Specification:**

```typescript
export interface PdfExportOptions {
  paperFormat: 'a4' | 'letter' | 'full';
  mirrorHorizontal: boolean;
}
```

---

### Task 2: Upgrade PDF Vector Engine (`src/composables/usePdfExporter.ts`)
- **Action:** Refactor `exportToPdf` in `src/composables/usePdfExporter.ts` to accept either the legacy string parameter (`'a4' | 'letter' | 'full'`) or the `PdfExportOptions` object so existing callers and tests remain backward-compatible.
- **Technical Requirements:**
  1. **Signature & Normalization:**
     - Accept `options: Partial<PdfExportOptions> | 'a4' | 'letter' | 'full' = 'a4'`.
     - Extract `paperFormat = typeof options === 'string' ? options : (options.paperFormat ?? 'a4')`.
     - Extract `mirrorHorizontal = typeof options === 'object' ? Boolean(options.mirrorHorizontal) : false`.
  2. **Legend Page Metadata (Page 1):**
     - Keep Page 1 unmirrored.
     - Add print mode metadata line at `(14, 34)`:
       `Print Mode: ${mirrorHorizontal ? 'MIRRORED (For Face-Down Transfer)' : 'Standard (Direct Read)'} | Total Colors: ${palette.length}`
     - Shift `autoTable` `startY` to `40` to accommodate the new metadata line.
  3. **Horizontal Tile Reversal (Page 2+):**
     - Inside the `tCol` loop, calculate:
       `const effectiveTileCol = mirrorHorizontal ? (totalTileCols - 1 - tCol) : tCol;`
     - Compute `startCol = effectiveTileCol * colsPerTile` and `endCol = Math.min(startCol + colsPerTile, config.gridCols)`.
  4. **Page Header (Unmirrored):**
     - Render the top tile instruction header (`Tile [Row X, Col Y]...`) **before** applying the PDF transformation matrix so the person cutting and taping the pages can read the tile coordinates normally.
  5. **PDF Graphics State Reflection (CTM):**
     - Define conversion constant: `const mmToPt = 72 / 25.4;`.
     - When `mirrorHorizontal === true`:
       - Save graphics state: `doc.internal.write('q');`
       - Apply horizontal reflection matrix across page width:
         `doc.internal.write(`-1 0 0 1 ${(pageWidthMm * mmToPt).toFixed(4)} 0 cm`);`
       - Compute `originX = mirrorHorizontal ? (pageWidthMm - marginMm - tileWidthMm) : marginMm` so partial edge tiles still align flush to the physical left margin of the printed sheet.
     - Draw crop marks, coordinate rulers, tinted cell backgrounds, vector symbols, and 10x10 major grid lines inside the transformed state.
     - Restore graphics state at the end of each page loop when `mirrorHorizontal === true`:
       `doc.internal.write('Q');`
  6. **Output Filename:**
     - Append `-mirrored` to the saved filename when active:
       `diamond-art-${config.widthCm}x${config.heightCm}cm-${paperFormat}${mirrorHorizontal ? '-mirrored' : ''}.pdf`

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

    const drillSizeMm = config.drillShape === 'square' ? 2.5 : 2.8;
    const totalWidthMm = config.gridCols * drillSizeMm;
    const totalHeightMm = config.gridRows * drillSizeMm;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // PAGE 1: COVER & DMC INVENTORY LEGEND (Always unmirrored)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Diamond Art Pattern & Inventory', 14, 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    const modeLabel = mirrorHorizontal ? 'MIRRORED (For Face-Down Transfer)' : 'Standard (Direct Read)';
    doc.text(
      `Canvas Size: ${config.widthCm}x${config.heightCm} cm  |  Grid: ${config.gridCols}x${config.gridRows} drills  |  Drill: ${config.drillShape.toUpperCase()} (${drillSizeMm}mm)`,
      14,
      28
    );
    doc.text(`Print Mode: ${modeLabel}  |  Total Colors: ${palette.length}`, 14, 34);

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
          `1:1 Scale (${drillSizeMm}mm)${mirrorHorizontal ? '  |  [MIRRORED FOR TRANSFER]' : ''}`;
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
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(3.5);
        doc.setTextColor(110, 110, 110);

        for (let r = startRow; r < endRow; r++) {
          const localRow = r - startRow;
          const cellY = originY + localRow * drillSizeMm;

          if ((r + 1) % 5 === 0 || r === startRow) {
            doc.text(`${r + 1}`, originX - 1.2, cellY + drillSizeMm * 0.65, { align: 'right' });
          }

          for (let c = startCol; c < endCol; c++) {
            const localCol = c - startCol;
            const cellX = originX + localCol * drillSizeMm;

            if (r === startRow && ((c + 1) % 5 === 0 || c === startCol)) {
              doc.text(`${c + 1}`, cellX + drillSizeMm / 2, originY - 1.2, { align: 'center' });
            }

            const paletteIdx = gridData[r * config.gridCols + c];
            const item = palette[paletteIdx];
            if (!item) continue;

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
            doc.text(
              item.symbol,
              cellX + drillSizeMm / 2,
              cellY + drillSizeMm * 0.73,
              { align: 'center' }
            );
          }
        }

        // 10x10 Major Grid Lines
        doc.setDrawColor(60, 60, 60);
        doc.setLineWidth(0.25);
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

    const suffix = mirrorHorizontal ? '-mirrored' : '';
    doc.save(`diamond-art-${config.widthCm}x${config.heightCm}cm-${paperFormat}${suffix}.pdf`);
  };

  return { exportToPdf };
}
```

---

### Task 3: Update Export Modal UI (`src/components/ExportModal.vue`)
- **Action:** Add the Mirror/Flip toggle switch and status indicator to `src/components/ExportModal.vue`.
- **Technical Requirements:**
  1. Add `const mirrorHorizontal = ref(false);` to the component state.
  2. Add a checkbox toggle bound to `v-model="mirrorHorizontal"` explaining its use for face-down Acrylic Gel Medium / Toner transfers.
  3. Add an `Orientation` status line in the summary box showing `Mirrored (Face-Down Transfer)` or `Normal (Direct Print)`.
  4. Pass `{ paperFormat: selectedFormat.value, mirrorHorizontal: mirrorHorizontal.value }` into `exportToPdf(...)`.

---

### Task 4: Expand Unit Test Suite (`tests/pdfExporter.test.ts`)
- **Action:** Add unit test cases in `tests/pdfExporter.test.ts` to verify both standard and mirrored exports.
- **Test Specification:**

```typescript
it('supports mirrored horizontal export without throwing', () => {
  const { exportToPdf } = usePdfExporter();
  expect(() => {
    exportToPdf(mockConfig, mockGrid, mockPalette, {
      paperFormat: 'a4',
      mirrorHorizontal: true
    });
  }).not.toThrow();
});
```

---

## 4. Verification & Acceptance Criteria
- [ ] `npm run test` (Vitest) passes all existing and new unit tests in `tests/pdfExporter.test.ts`.
- [ ] `npm run build` (`vue-tsc` + `vite build`) compiles cleanly with zero TypeScript errors.
- [ ] Exporting with **Mirror / Flip Horizontally** unchecked produces `diamond-art-{W}x{H}cm-{format}.pdf`.
- [ ] Exporting with **Mirror / Flip Horizontally** checked produces `diamond-art-{W}x{H}cm-{format}-mirrored.pdf` where Page 1 is normal and Page 2+ tiles and symbol glyphs are horizontally mirrored.