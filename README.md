# Diamond Art Studio 💎

A 100% client-side (serverless) **Diamond Painting Template Generator** built with **Vue 3**, **TypeScript**, **Vite**, **Tailwind CSS**, and **Pinia**.

Transform any photo or illustration into a true-to-scale, publication-grade diamond art blueprint mapped to official **DMC floss colors**, with interactive editing tools and vector PDF export.

---

## ✨ Features

- **100% Client-Side & Private**: All image downsampling, color quantization, and PDF compilation run entirely in the browser using Web Workers—no images are uploaded to any server.
- **Accurate Perceptual Color Matching**:
  - Full catalog of **489 verified DMC floss shades** (`dmc-palette.json`).
  - Converts sRGB $\rightarrow$ Linear RGB $\rightarrow$ CIE XYZ $\rightarrow$ **CIELAB** color space.
  - Perceptual color distance matching using **$\Delta E_{76}$**.
- **Heavy Image Pipeline in Web Workers**:
  - **K-Means++ Clustering** in CIELAB space to find optimal color centroids.
  - **Floyd-Steinberg Error Diffusion Dithering** with adjustable strength slider (0–100%).
  - **Orphan Despeckling / Noise Filtering** to merge low-frequency stray drills with nearby shades.
- **High-Performance Interactive Canvas**:
  - Viewport-culled HTML5 Canvas rendering for smooth **60 FPS** even on large $50 \times 70\text{ cm}$ grids (50,000+ drills).
  - **Chart Mode**: Displays DMC cell colors, high-contrast symbols, cell borders, and bold $10 \times 10$ diamond art ruler guides.
  - **Realistic 3D Simulation**: Renders resin drill textures with square bevel facets or round glossy specular highlights.
  - **Split View**: Side-by-side comparison slider.
  - **Manual Brush & Eyedropper**: Click or drag to repaint individual drills or sample canvas colors.
- **Palette Inspector & Color Merging**:
  - Real-time drill frequency counts and percentage breakdown.
  - One-click color swap/merge tool to consolidate or eliminate specific shades.
- **Publication-Grade Vector PDF Exporter**:
  - **Page 1 (Cover Sheet)**: High-res project thumbnail, physical canvas dimensions, drill count, and specifications.
  - **Page 2 (DMC Inventory & Shopping List)**: Formatted table with color swatches, DMC numbers, color names, exact drill counts, +20% buffer recommendations, and packet/gram estimates.
  - **Pages 3+ (Pattern Grid)**:
    - **Single Blueprint Mode**: 1:1 physical scale continuous layout for wide-format plotters and print shops.
    - **Tiled A4 Mode**: Printable tiled sheets for standard home printers, with 2-drill shaded overlap guidelines and sheet coordinate minimap.

---

## 🛠️ Tech Stack

- **Framework:** Vue 3 (Composition API, `<script setup>`)
- **Language:** TypeScript
- **Build Tool:** Vite
- **State Management:** Pinia
- **Styling:** Tailwind CSS
- **Icons:** Lucide Icons
- **PDF Generation:** `jsPDF` + `jspdf-autotable`
- **Testing:** Vitest

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm or pnpm / yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/paulogarcia79/diamond-art-generator.git
cd diamond-art-generator

# Install dependencies
npm install
```

### Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Run Tests

```bash
npm run test
```

### Type-Check & Production Build

```bash
npm run type-check
npm run build
```

The compiled assets will be in the `dist/` directory.

---

## 📄 License

MIT License. Feel free to use, modify, and distribute for personal or commercial projects.
