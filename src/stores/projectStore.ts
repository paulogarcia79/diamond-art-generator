import { defineStore } from 'pinia';
import type {
  ActivePaletteItem,
  DmcColor,
  ProjectConfig,
  QuantizeWorkerInput,
  QuantizeWorkerOutput,
  ToolMode,
  ViewMode
} from '../types/diamond';
import dmcPaletteRaw from '../assets/dmc-palette.json';
import { downsampleImage } from '../utils/imageResizer';

const dmcPalette = dmcPaletteRaw as DmcColor[];

export const useProjectStore = defineStore('project', {
  state: () => ({
    sourceImageSrc: null as string | null,
    sourceImageElement: null as HTMLImageElement | null,
    config: {
      widthCm: 40,
      heightCm: 50,
      drillShape: 'square',
      maxColors: 35,
      ditheringStrength: 0.5,
      minColorThreshold: 10
    } as ProjectConfig,

    isProcessing: false,
    progress: 0,
    statusMessage: '',
    error: null as string | null,

    grid: [] as string[][],
    activePalette: [] as ActivePaletteItem[],
    gridWidth: 0,
    gridHeight: 0,

    viewMode: 'symbols' as ViewMode,
    toolMode: 'pan' as ToolMode,
    selectedDmcCode: null as string | null,
    splitRatio: 0.5,

    worker: null as Worker | null
  }),

  getters: {
    drillSizeMm(state): number {
      return state.config.drillShape === 'square' ? 2.5 : 2.8;
    },
    targetGridWidth(state): number {
      const drillMm = state.config.drillShape === 'square' ? 2.5 : 2.8;
      return Math.floor((state.config.widthCm * 10) / drillMm);
    },
    targetGridHeight(state): number {
      const drillMm = state.config.drillShape === 'square' ? 2.5 : 2.8;
      return Math.floor((state.config.heightCm * 10) / drillMm);
    },
    totalDrills(state): number {
      return state.gridWidth * state.gridHeight;
    },
    paletteMap(state): Map<string, ActivePaletteItem> {
      return new Map(state.activePalette.map(item => [item.code, item]));
    },
    hasPattern(state): boolean {
      return state.grid.length > 0 && state.activePalette.length > 0;
    }
  },

  actions: {
    async setSourceImage(fileOrUrl: File | string) {
      this.isProcessing = true;
      this.statusMessage = 'Loading image...';
      this.error = null;

      try {
        let src = '';
        if (typeof fileOrUrl === 'string') {
          src = fileOrUrl;
        } else {
          src = URL.createObjectURL(fileOrUrl);
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load image.'));
          img.src = src;
        });

        this.sourceImageSrc = src;
        this.sourceImageElement = img;
        this.isProcessing = false;
        this.statusMessage = '';

        // Automatically trigger initial generation
        await this.generatePattern();
      } catch (err: any) {
        this.isProcessing = false;
        this.error = err?.message || 'Error loading image';
      }
    },

    updateConfig(partial: Partial<ProjectConfig>) {
      this.config = { ...this.config, ...partial };
    },

    async generatePattern() {
      if (!this.sourceImageElement) return;

      this.isProcessing = true;
      this.progress = 5;
      this.statusMessage = 'Downsampling image to target grid...';
      this.error = null;

      const targetW = this.targetGridWidth;
      const targetH = this.targetGridHeight;

      try {
        // Downsample on main thread using fast box-averaging canvas extraction
        const downsampled = downsampleImage(this.sourceImageElement, targetW, targetH);

        // Terminate existing worker if running
        if (this.worker) {
          this.worker.terminate();
          this.worker = null;
        }

        // Initialize Web Worker using Vite standard worker import
        const worker = new Worker(
          new URL('../workers/quantizer.worker.ts', import.meta.url),
          { type: 'module' }
        );
        this.worker = worker;

        await new Promise<void>((resolve, reject) => {
          worker.onmessage = (e) => {
            const data = e.data;
            if (data.type === 'PROGRESS') {
              this.progress = data.progress;
              this.statusMessage = data.stage;
            } else if (data.type === 'SUCCESS') {
              const res = data.result as QuantizeWorkerOutput;
              this.grid = res.grid;
              this.activePalette = res.activePalette;
              this.gridWidth = res.gridWidth;
              this.gridHeight = res.gridHeight;
              if (this.activePalette.length > 0 && !this.selectedDmcCode) {
                this.selectedDmcCode = this.activePalette[0].code;
              }
              this.isProcessing = false;
              this.progress = 100;
              this.statusMessage = 'Complete';
              resolve();
            } else if (data.type === 'ERROR') {
              this.isProcessing = false;
              this.error = data.error;
              reject(new Error(data.error));
            }
          };

          worker.onerror = (err) => {
            this.isProcessing = false;
            this.error = err.message || 'Worker error';
            reject(err);
          };

          const payload: QuantizeWorkerInput = {
            imageDataBuffer: downsampled.data,
            imageWidth: targetW,
            imageHeight: targetH,
            config: { ...this.config },
            dmcPalette
          };

          worker.postMessage(payload, [downsampled.data.buffer]);
        });
      } catch (err: any) {
        this.isProcessing = false;
        this.error = err?.message || 'Pattern generation failed';
      }
    },

    setCellColor(x: number, y: number, dmcCode: string) {
      if (y < 0 || y >= this.gridHeight || x < 0 || x >= this.gridWidth) return;
      const oldCode = this.grid[y][x];
      if (oldCode === dmcCode) return;

      this.grid[y][x] = dmcCode;

      // Update active palette counts
      const oldItem = this.activePalette.find(i => i.code === oldCode);
      if (oldItem && oldItem.count > 0) {
        oldItem.count--;
      }

      let newItem = this.activePalette.find(i => i.code === dmcCode);
      if (newItem) {
        newItem.count++;
      } else {
        // Find in full catalog
        const dmc = dmcPalette.find(c => c.code === dmcCode);
        if (dmc) {
          const unusedSymbols = ['★', '◆', '▲', '●', '✦', '♥', 'X', 'Z'];
          const symbol = unusedSymbols[this.activePalette.length % unusedSymbols.length];
          const contrast = (0.2126 * dmc.r + 0.7152 * dmc.g + 0.0722 * dmc.b) > 140 ? '#000000' : '#FFFFFF';
          this.activePalette.push({
            ...dmc,
            symbol,
            count: 1,
            contrastColor: contrast
          });
        }
      }

      // Clean up 0 count items if any
      this.recalculatePaletteCounts();
    },

    replaceColor(oldCode: string, newCode: string) {
      if (oldCode === newCode) return;

      for (let y = 0; y < this.gridHeight; y++) {
        for (let x = 0; x < this.gridWidth; x++) {
          if (this.grid[y][x] === oldCode) {
            this.grid[y][x] = newCode;
          }
        }
      }

      this.recalculatePaletteCounts();
    },

    recalculatePaletteCounts() {
      const counts = new Map<string, number>();
      for (let y = 0; y < this.gridHeight; y++) {
        for (let x = 0; x < this.gridWidth; x++) {
          const code = this.grid[y][x];
          counts.set(code, (counts.get(code) || 0) + 1);
        }
      }

      this.activePalette = this.activePalette
        .map(item => ({
          ...item,
          count: counts.get(item.code) || 0
        }))
        .filter(item => item.count > 0);

      if (this.selectedDmcCode && !this.activePalette.some(i => i.code === this.selectedDmcCode)) {
        this.selectedDmcCode = this.activePalette[0]?.code || null;
      }
    }
  }
});
