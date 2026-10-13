# Complete Implementation Plan: Vue 3 Diamond Art Template Generator

## 1. System Architecture & Tech Stack

This application operates **100% client-side (serverless)**. All image processing, color quantization, canvas rendering, and vector PDF compilation run in the user's browser using Web Workers to prevent UI freezing.

*   **Frontend Framework:** Vue 3 (Composition API, `<script setup>`, TypeScript)
*   **Build Tool:** Vite
*   **State Management:** Pinia (for managing the active palette, grid matrix, and user settings)
*   **Styling:** Tailwind CSS
*   **Color Mathematics:** `culori` or custom lightweight RGB $\rightarrow$ XYZ $\rightarrow$ CIELAB conversion functions
*   **Concurrency:** Native Web Workers (for K-Means clustering and Floyd-Steinberg dithering)
*   **PDF Generation:** `jsPDF` + `jspdf-autotable` (for the DMC inventory sheet and vector canvas output)

---

## 2. Project Directory Structure

```text
diamond-art-generator/
├── public/
│   └── fonts/
│       └── RobotoMono-Bold.ttf        # Embedded font for PDF symbol rendering
├── src/
│   ├── assets/
│   │   ├── dmc-palette.json           # Full 447+ DMC colors (Code, Name, RGB, Hex)
│   │   └── symbols.json               # Ordered array of 100+ high-contrast symbols
│   ├── components/
│   │   ├── ImageUploader.vue          # Drag-and-drop + Aspect ratio cropper
│   │   ├── ControlPanel.vue           # Sliders for dimensions, drill type, max colors, dithering
│   │   ├── InteractiveCanvas.vue      # Zoom/Pan HTML5 Canvas + Manual Brush Tool
│   │   ├── PaletteInspector.vue       # List of active DMC colors, counts, and swap/merge actions
│   │   └── ExportModal.vue            # PDF page size options (Full scale vs. A4 Tiled)
│   ├── composables/
│   │   ├── useCanvasRenderer.ts       # Handles drawing symbols, drills, and grid lines
│   │   └── usePdfExporter.ts          # Vector PDF generation logic
│   ├── stores/
│   │   └── projectStore.ts            # Pinia store holding the 2D matrix and settings
│   ├── types/
│   │   └── diamond.ts                 # TypeScript interfaces
│   ├── utils/
│   │   ├── colorMath.ts               # RGB to CIELAB and Delta E (CIE76 / CIEDE2000)
│   │   └── imageResizer.ts            # Area-averaging downsampler
│   ├── workers/
│   │   └── quantizer.worker.ts        # Heavy image processing offloaded from main thread
│   ├── App.vue
│   └── main.ts
├── package.json
└── vite.config.ts
```

---

## 3. Core Data Models (`src/types/diamond.ts`)

Define strict structures before building the pipeline:

```typescript
export type DrillShape = 'square' | 'round';
export type ViewMode = 'symbols' | 'simulated' | 'split';

export interface DmcColor {
  code: string;        // e.g., "310" or "BLANC"
  name: string;        // e.g., "Black"
  r: number;
  g: number;
  b: number;
  hex: string;
  lab: [number, number, number]; // Precomputed [L, a, b] for fast lookup
}

export interface ActivePaletteItem extends DmcColor {
  symbol: string;      // Assigned character: 'A', '★', '#', etc.
  count: number;       // Total drills in the current pattern
  contrastColor: '#000000' | '#FFFFFF'; // Optimal symbol text color based on luminance
}

export interface GridCell {
  x: number;
  y: number;
  dmcCode: string;     // References ActivePaletteItem.code
}

export interface ProjectConfig {
  widthCm: number;               // Physical width (e.g., 40cm)
  heightCm: number;              // Physical height (e.g., 50cm)
  drillShape: DrillShape;        // Square (2.5mm) or Round (2.8mm)
  maxColors: number;             // Range: 10 to 90
  ditheringStrength: number;     // Range: 0.0 (none) to 1.0 (full Floyd-Steinberg)
  minColorThreshold: number;     // Despeckle threshold (e.g., remove colors with < 15 drills)
}
```

---

## 4. Step-by-Step Implementation Pipeline

### Phase 1: Static Data Preparation (`dmc-palette.json` & `symbols.json`)
1.  **DMC Database:** Create `dmc-palette.json` containing the standard 447 DMC colors. At app initialization, iterate through this list once and compute the **CIELAB** coordinates ($L^*, a^*, b^*$) for each DMC color so you never recalculate them during pixel loops.
2.  **Symbol List:** Create an array of clear, unambiguous single characters in `symbols.json` ordered by visual clarity:
    *   *Tier 1 (Alphanumeric):* `A-Z` (excluding `I`, `O` if using `1`, `0`), `1-9`
    *   *Tier 2 (High-contrast ASCII/Unicode):* `@`, `#`, `$`, `%`, `&`, `+`, `?`, `=`, `▲`, `▼`, `◆`, `♥`, `★`, `✚`, `✖`, `●`

### Phase 2: Physical Grid Calculation & Image Downsampling (`imageResizer.ts`)
1.  **Compute Grid Dimensions:**
    *   Square drill size = $2.5\text{ mm}$ ($4\text{ drills per cm}$)
    *   Round drill size = $2.8\text{ mm}$ ($\approx 3.57\text{ drills per cm}$)
    *   Calculate matrix resolution:
        $$\text{GridWidth} = \left\lfloor \frac{\text{widthCm} \times 10}{\text{drillSizeMm}} \right\rfloor, \quad \text{GridHeight} = \left\lfloor \frac{\text{heightCm} \times 10}{\text{drillSizeMm}} \right\rfloor$$
2.  **Area-Averaging Downsample:**
    *   Do not use standard HTML5 `ctx.drawImage(img, 0, 0, gridW, gridH)` directly on a huge 4000px photo, as browser bilinear interpolation causes muddy edges.
    *   Instead, step down the image in halves (mipmapping) or average the RGB values of all source pixels falling inside each target cell box to produce a clean `ImageData` array of size $\text{GridWidth} \times \text{GridHeight}$.

### Phase 3: Color Quantization & DMC Mapping (`quantizer.worker.ts`)
Run this entire phase inside a **Web Worker** so the Vue UI remains at 60 FPS:

1.  **Convert Pixels to CIELAB:**
    *   First convert sRGB $(R, G, B \in [0, 255])$ to linear RGB, then to CIE XYZ (D65 illuminant), and finally to CIELAB $(L^*, a^*, b^*)$.
2.  **K-Means++ Clustering (Reducing to `maxColors`):**
    *   Initialize $K = \text{maxColors}$ centroids using K-Means++ on the downsampled pixel array.
    *   Run 10–15 iterations grouping pixels by minimum perceptual distance:
        $$\Delta E_{76} = \sqrt{(L_2^* - L_1^*)^2 + (a_2^* - a_1^*)^2 + (b_2^* - b_1^*)^2}$$
3.  **Snap Centroids to Official DMC Palette:**
    *   Map each of the $K$ centroids to its closest match in `dmc-palette.json` using $\Delta E$.
    *   Deduplicate the resulting DMC list (two centroids might snap to the same DMC code). This becomes your **Candidate Active Palette**.
4.  **Floyd-Steinberg Dithering with Adjustable Strength:**
    *   Iterate through the grid top-to-bottom, left-to-right.
    *   Find the closest DMC color in the **Candidate Active Palette** for pixel $(x, y)$.
    *   Calculate RGB quantization error: $\vec{E} = \text{Pixel}_{\text{RGB}} - \text{DMC}_{\text{RGB}}$.
    *   Multiply $\vec{E}$ by `config.ditheringStrength` ($\alpha \in [0, 1]$) and diffuse to neighbors:
        *   $(x + 1, y) \mathrel{+}= \vec{E} \times \alpha \times \frac{7}{16}$
        *   $(x - 1, y + 1) \mathrel{+}= \vec{E} \times \alpha \times \frac{3}{16}$
        *   $(x, y + 1) \mathrel{+}= \vec{E} \times \alpha \times \frac{5}{16}$
        *   $(x + 1, y + 1) \mathrel{+}= \vec{E} \times \alpha \times \frac{1}{16}$
5.  **Despeckling / Orphan Cleanup:**
    *   Count total occurrences of each DMC code across the matrix.
    *   Identify any DMC code where $\text{count} < \text{config.minColorThreshold}$.
    *   Remove those low-frequency colors from the active palette and re-map their cells to the closest remaining active DMC color.
6.  **Symbol & Contrast Assignment:**
    *   Sort the final Active Palette by DMC code or frequency.
    *   Assign symbols sequentially from `symbols.json`.
    *   Calculate relative luminance for each DMC color to decide if the symbol printed on top should be black or white:
        $$Y = 0.2126 R + 0.7152 G + 0.0722 B$$
        If $Y > 140$, `contrastColor = '#000000'`, else `'#FFFFFF'`.

---

## 5. Interactive Vue Workspace (`InteractiveCanvas.vue`)

1.  **Dual-Layer Rendering:**
    *   Use an HTML5 `<canvas>` with pan and zoom (`wheel` and `pointermove` events).
    *   **View Mode 1 (Template/Chart View):** Renders each cell with its DMC hex background, a thin grey border, bold black borders every $10 \times 10$ drills (standard diamond art ruler blocks), and the centered symbol.
    *   **View Mode 2 (Realistic Simulation):** Renders a dark adhesive-canvas texture in the background, then draws either rounded-corner squares with a subtle 3D bevel highlight or circles with a specular dot to simulate shiny resin drills.
2.  **Manual Touch-Up Tools:**
    *   **Eyedropper & Brush:** Clicking a cell while in "Brush Mode" overwrites `grid[y][x].dmcCode` with the currently selected DMC color from `PaletteInspector.vue` and automatically updates the drill inventory count in Pinia.
    *   **Color Merge:** Allow the user to click "Replace Color X with Color Y" in the sidebar if they want to manually eliminate a color.

---

## 6. Vector PDF Export Engine (`usePdfExporter.ts`)

Never export the PDF by taking a raster screenshot (`canvas.toDataURL()`) of the pattern—it will look blurry when printed and consumes massive memory. Instead, draw vector primitives using `jsPDF`.

### PDF Structure (Multi-Page Document)

#### Page 1: Cover & Project Summary
*   Project Title, Thumbnail of the simulated result, Physical Dimensions ($\text{cm}$), Grid Dimensions ($\text{drills}$), Drill Type (Square $2.5\text{ mm}$ / Round $2.8\text{ mm}$), and Total Drill Count.

#### Page 2: DMC Inventory & Shopping List (`jspdf-autotable`)
Generate a clean table with the following columns:
1.  **Symbol** (Centered, bold)
2.  **Color Swatch** (Draw a filled rectangle using `doc.setFillColor(r, g, b)` inside the `didDrawCell` hook)
3.  **DMC Code** (e.g., `310`)
4.  **DMC Name** (e.g., `Black`)
5.  **Exact Drill Count** (e.g., `1,420`)
6.  **Recommended Drills (+20% Buffer)** ($\lceil \text{count} \times 1.2 \rceil$)
7.  **Estimated Packs / Weight in Grams** ($\approx 5\text{ g}$ per $1,000$ drills)

#### Pages 3+: The Pattern Grid (Two Export Modes)

Offer the user two checkboxes in `ExportModal.vue`:

*   **Mode A: Single Giant Blueprint Page (For Wide-Format Plotters / Print Shops)**
    *   Initialize a custom page size matching the physical canvas plus a $3\text{ cm}$ margin:
        ```typescript
        const doc = new jsPDF({
          orientation: widthCm > heightCm ? 'l' : 'p',
          unit: 'mm',
          format: [widthCm * 10 + 60, heightCm * 10 + 60]
        });
        ```
    *   Loop through $y$ and $x$, setting each cell size to exactly $2.5\text{ mm}$ (square) or $2.8\text{ mm}$ (round):
        ```typescript
        // 1. Draw colored background (slightly lightened or pure)
        doc.setFillColor(dmc.r, dmc.g, dmc.b);
        doc.rect(posX, posY, drillMm, drillMm, 'F');

        // 2. Draw symbol
        doc.setTextColor(dmc.contrastColor);
        doc.setFontSize(4.5); // Calibrated for 2.5mm cell
        doc.text(dmc.symbol, posX + drillMm / 2, posY + drillMm / 2, {
          align: 'center',
          baseline: 'middle'
        });
        ```
    *   Draw grid lines in a single batch pass on top: thin lines ($0.05\text{ mm}$) for individual cells, and thick lines ($0.25\text{ mm}$) every $10$ cells with row/column coordinate numbers along the outside perimeter.

*   **Mode B: Tiled A4 / Letter Pages (For Home Printers)**
    *   Divide the total matrix into chunks of **$65 \times 90$ drills per A4 page** (which fits comfortably at true $2.5\text{ mm}$ scale on A4 with margins and overlap guides).
    *   Include a **2-row/2-column shaded overlap margin** on the edges of each page so the user can align and tape the printed sheets together accurately.
    *   Print a mini-minimap in the top-right header of each page showing `"Tile (Row 2, Col 3) of 12"`.

---

## 7. Implementation Roadmap & Milestones

| Milestone | Deliverable | Key Files |
| :--- | :--- | :--- |
| **M1: Setup & Color Engine** | Vite + Vue 3 + Tailwind scaffold; load `dmc-palette.json` and verify RGB $\rightarrow$ CIELAB $\rightarrow$ $\Delta E$ unit tests. | `colorMath.ts`, `dmc-palette.json` |
| **M2: Downsampler & Worker** | Upload an image, crop to target aspect ratio, downsample to target drill count, and quantize to DMC codes in a Web Worker. | `imageResizer.ts`, `quantizer.worker.ts` |
| **M3: Canvas Viewport** | Render the processed 2D matrix on an HTML5 Canvas with pan/zoom, $10 \times 10$ ruler lines, and toggleable Symbol vs. Realistic views. | `InteractiveCanvas.vue`, `useCanvasRenderer.ts` |
| **M4: Refinement Tools** | Add Floyd-Steinberg dithering slider, orphan-color despeckling, and manual click-to-paint brush. | `ControlPanel.vue`, `PaletteInspector.vue` |
| **M5: Vector PDF Generator** | Implement `usePdfExporter.ts` with the DMC inventory table, true-to-scale $2.5\text{ mm}/2.8\text{ mm}$ rendering, and A4 tiling support. | `usePdfExporter.ts`, `ExportModal.vue` |