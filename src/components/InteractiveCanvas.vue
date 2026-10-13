<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { useProjectStore } from '../stores/projectStore';
import { drawDiamondArtCanvas } from '../composables/useCanvasRenderer';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Hand,
  Paintbrush,
  Pipette,
  Eye,
  Sparkles,
  Columns
} from 'lucide-vue-next';

const store = useProjectStore();

const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

const BASE_CELL_SIZE = 20; // 20px base cell
const panX = ref(50);
const panY = ref(50);
const zoom = ref(1);

const isDragging = ref(false);
const dragStartX = ref(0);
const dragStartY = ref(0);
const hoveredCell = ref<{ x: number; y: number } | null>(null);

// Hovered cell info
const hoveredCellInfo = computed(() => {
  if (!hoveredCell.value) return null;
  const { x, y } = hoveredCell.value;
  if (x < 0 || x >= store.gridWidth || y < 0 || y >= store.gridHeight) return null;
  const code = store.grid[y]?.[x];
  if (!code) return null;
  const item = store.paletteMap.get(code);
  return {
    x: x + 1,
    y: y + 1,
    code,
    name: item?.name || `DMC ${code}`,
    symbol: item?.symbol || '?',
    hex: item?.hex || '#ffffff'
  };
});

function requestRender() {
  if (!canvasRef.value) return;
  drawDiamondArtCanvas({
    canvas: canvasRef.value,
    grid: store.grid,
    activePalette: store.activePalette,
    gridWidth: store.gridWidth,
    gridHeight: store.gridHeight,
    drillShape: store.config.drillShape,
    viewMode: store.viewMode,
    splitRatio: store.splitRatio,
    panX: panX.value,
    panY: panY.value,
    zoom: zoom.value,
    cellSize: BASE_CELL_SIZE,
    hoveredCell: hoveredCell.value
  });
}

function resizeCanvas() {
  if (!containerRef.value || !canvasRef.value) return;
  const rect = containerRef.value.getBoundingClientRect();
  canvasRef.value.width = rect.width;
  canvasRef.value.height = rect.height;
  requestRender();
}

function fitToScreen() {
  if (!containerRef.value || store.gridWidth === 0 || store.gridHeight === 0) return;
  const rect = containerRef.value.getBoundingClientRect();
  const boardW = store.gridWidth * BASE_CELL_SIZE;
  const boardH = store.gridHeight * BASE_CELL_SIZE;

  const margin = 40;
  const scaleX = (rect.width - margin * 2) / boardW;
  const scaleY = (rect.height - margin * 2) / boardH;
  const fitZoom = Math.min(scaleX, scaleY, 2.5);

  zoom.value = Math.max(0.05, fitZoom);
  panX.value = (rect.width - boardW * zoom.value) / 2;
  panY.value = (rect.height - boardH * zoom.value) / 2;
  requestRender();
}

function zoomAt(targetZoom: number, clientCenterX?: number, clientCenterY?: number) {
  if (!containerRef.value) return;
  const newZoom = Math.min(10, Math.max(0.05, targetZoom));
  const rect = containerRef.value.getBoundingClientRect();

  const cx = clientCenterX !== undefined ? clientCenterX - rect.left : rect.width / 2;
  const cy = clientCenterY !== undefined ? clientCenterY - rect.top : rect.height / 2;

  // Zoom centered at cursor
  const scaleRatio = newZoom / zoom.value;
  panX.value = cx - (cx - panX.value) * scaleRatio;
  panY.value = cy - (cy - panY.value) * scaleRatio;
  zoom.value = newZoom;
  requestRender();
}

function getGridCoords(e: MouseEvent): { x: number; y: number } | null {
  if (!containerRef.value) return null;
  const rect = containerRef.value.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;

  const boardX = (screenX - panX.value) / zoom.value;
  const boardY = (screenY - panY.value) / zoom.value;

  const cellX = Math.floor(boardX / BASE_CELL_SIZE);
  const cellY = Math.floor(boardY / BASE_CELL_SIZE);

  return { x: cellX, y: cellY };
}

function handleWheel(e: WheelEvent) {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.15 : 0.85;
  zoomAt(zoom.value * factor, e.clientX, e.clientY);
}

function handleMouseDown(e: MouseEvent) {
  if (e.button === 1 || store.toolMode === 'pan' || e.shiftKey) {
    // Pan mode
    isDragging.value = true;
    dragStartX.value = e.clientX - panX.value;
    dragStartY.value = e.clientY - panY.value;
  } else if (e.button === 0) {
    const coords = getGridCoords(e);
    if (!coords) return;

    if (store.toolMode === 'brush') {
      isDragging.value = true;
      if (store.selectedDmcCode) {
        store.setCellColor(coords.x, coords.y, store.selectedDmcCode);
        requestRender();
      }
    } else if (store.toolMode === 'picker') {
      const code = store.grid[coords.y]?.[coords.x];
      if (code) {
        store.selectedDmcCode = code;
        store.toolMode = 'brush';
      }
    }
  }
}

function handleMouseMove(e: MouseEvent) {
  const coords = getGridCoords(e);
  hoveredCell.value = coords;

  if (isDragging.value) {
    if (store.toolMode === 'pan' || e.buttons === 4 || e.shiftKey) {
      panX.value = e.clientX - dragStartX.value;
      panY.value = e.clientY - dragStartY.value;
      requestRender();
    } else if (store.toolMode === 'brush' && coords) {
      if (store.selectedDmcCode) {
        store.setCellColor(coords.x, coords.y, store.selectedDmcCode);
        requestRender();
      }
    }
  } else {
    requestRender();
  }
}

function handleMouseUp() {
  isDragging.value = false;
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  resizeCanvas();
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(containerRef.value);
  }
  fitToScreen();
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});

watch(
  () => [store.grid, store.viewMode, store.splitRatio, store.config.drillShape],
  () => {
    requestRender();
  },
  { deep: true }
);

watch(
  () => store.gridWidth,
  () => {
    fitToScreen();
  }
);
</script>

<template>
  <div
    ref="containerRef"
    class="relative w-full h-full select-none overflow-hidden bg-slate-950 flex flex-col items-center justify-center"
    @wheel="handleWheel"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="hoveredCell = null; isDragging = false; requestRender()"
  >
    <!-- Canvas Element -->
    <canvas
      ref="canvasRef"
      class="w-full h-full block"
      :class="{
        'cursor-grab active:cursor-grabbing': store.toolMode === 'pan',
        'cursor-crosshair': store.toolMode === 'brush' || store.toolMode === 'picker'
      }"
    />

    <!-- Top floating toolbar: View Modes -->
    <div
      v-if="store.hasPattern"
      class="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-1 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl text-xs font-medium text-slate-300"
    >
      <button
        @click="store.viewMode = 'symbols'"
        :class="[
          'px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all',
          store.viewMode === 'symbols'
            ? 'bg-sky-500 text-white shadow-sm'
            : 'hover:bg-slate-800 text-slate-300'
        ]"
        title="Chart Mode with symbols and ruler lines"
      >
        <Eye class="w-3.5 h-3.5" />
        <span>Chart Symbols</span>
      </button>

      <button
        @click="store.viewMode = 'simulated'"
        :class="[
          'px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all',
          store.viewMode === 'simulated'
            ? 'bg-sky-500 text-white shadow-sm'
            : 'hover:bg-slate-800 text-slate-300'
        ]"
        title="Realistic 3D simulated resin drills"
      >
        <Sparkles class="w-3.5 h-3.5" />
        <span>Realistic 3D</span>
      </button>

      <button
        @click="store.viewMode = 'split'"
        :class="[
          'px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all',
          store.viewMode === 'split'
            ? 'bg-sky-500 text-white shadow-sm'
            : 'hover:bg-slate-800 text-slate-300'
        ]"
        title="Side-by-side split comparison"
      >
        <Columns class="w-3.5 h-3.5" />
        <span>Split View</span>
      </button>

      <!-- Split Slider if in split mode -->
      <div v-if="store.viewMode === 'split'" class="flex items-center gap-2 pl-2 pr-1 border-l border-slate-700">
        <span class="text-[10px] text-slate-400">Split:</span>
        <input
          type="range"
          min="0.1"
          max="0.9"
          step="0.02"
          v-model.number="store.splitRatio"
          class="w-20 accent-sky-500 cursor-pointer"
        />
      </div>
    </div>

    <!-- Bottom-Left floating toolbar: Editing Tools -->
    <div
      v-if="store.hasPattern"
      class="absolute bottom-6 left-6 z-20 flex items-center gap-1 p-1 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl"
    >
      <button
        @click="store.toolMode = 'pan'"
        :class="[
          'p-2 rounded-lg transition-all',
          store.toolMode === 'pan'
            ? 'bg-sky-500 text-white shadow-sm'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        ]"
        title="Pan Tool (Hand)"
      >
        <Hand class="w-4 h-4" />
      </button>

      <button
        @click="store.toolMode = 'brush'"
        :class="[
          'p-2 rounded-lg transition-all',
          store.toolMode === 'brush'
            ? 'bg-sky-500 text-white shadow-sm'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        ]"
        title="Brush Tool (Paint single drills)"
      >
        <Paintbrush class="w-4 h-4" />
      </button>

      <button
        @click="store.toolMode = 'picker'"
        :class="[
          'p-2 rounded-lg transition-all',
          store.toolMode === 'picker'
            ? 'bg-sky-500 text-white shadow-sm'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        ]"
        title="Eyedropper Tool (Pick DMC color from canvas)"
      >
        <Pipette class="w-4 h-4" />
      </button>

      <!-- Active selected color indicator -->
      <div
        v-if="store.selectedDmcCode"
        class="flex items-center gap-1.5 pl-2 pr-1 border-l border-slate-700 text-xs font-semibold"
      >
        <span
          class="w-4 h-4 rounded-full border border-slate-600 shadow-sm inline-block"
          :style="{ backgroundColor: store.paletteMap.get(store.selectedDmcCode)?.hex || '#fff' }"
        />
        <span class="text-slate-300">#{{ store.selectedDmcCode }}</span>
      </div>
    </div>

    <!-- Bottom-Right floating toolbar: Zoom Controls -->
    <div
      v-if="store.hasPattern"
      class="absolute bottom-6 right-6 z-20 flex items-center gap-1 p-1 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl text-slate-300"
    >
      <button
        @click="zoomAt(zoom * 1.25)"
        class="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-all"
        title="Zoom In"
      >
        <ZoomIn class="w-4 h-4" />
      </button>

      <button
        @click="zoomAt(zoom * 0.8)"
        class="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-all"
        title="Zoom Out"
      >
        <ZoomOut class="w-4 h-4" />
      </button>

      <button
        @click="fitToScreen"
        class="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-all"
        title="Fit to Window"
      >
        <Maximize2 class="w-4 h-4" />
      </button>

      <button
        @click="zoomAt(1)"
        class="p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-all"
        title="Reset 100%"
      >
        <RotateCcw class="w-4 h-4" />
      </button>

      <span class="px-2 text-xs font-mono text-slate-400 border-l border-slate-700">
        {{ Math.round(zoom * 100) }}%
      </span>
    </div>

    <!-- Hover Inspector Badge (Top-left or cursor) -->
    <div
      v-if="hoveredCellInfo"
      class="absolute top-4 left-4 z-20 px-3 py-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-xl text-xs flex items-center gap-3 pointer-events-none"
    >
      <div
        class="w-5 h-5 rounded flex items-center justify-center font-bold text-[10px] shadow border border-slate-600"
        :style="{
          backgroundColor: hoveredCellInfo.hex,
          color: store.paletteMap.get(hoveredCellInfo.code)?.contrastColor || '#000'
        }"
      >
        {{ hoveredCellInfo.symbol }}
      </div>
      <div class="flex flex-col">
        <div class="font-semibold text-slate-200 flex items-center gap-1.5">
          <span>DMC {{ hoveredCellInfo.code }}</span>
          <span class="text-slate-400 font-normal">({{ hoveredCellInfo.name }})</span>
        </div>
        <div class="text-[10px] text-slate-400 font-mono">
          Pos: [X: {{ hoveredCellInfo.x }}, Y: {{ hoveredCellInfo.y }}]
        </div>
      </div>
    </div>
  </div>
</template>
