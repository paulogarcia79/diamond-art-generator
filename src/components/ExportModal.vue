<script setup lang="ts">
import { ref, computed } from 'vue';
import { useProjectStore } from '../stores/projectStore';
import { exportDiamondArtPdf } from '../composables/usePdfExporter';
import { X, FileDown, CheckCircle2, AlertCircle, Loader2 } from 'lucide-vue-next';

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const store = useProjectStore();

const projectTitle = ref('My Diamond Art Creation');
const exportMode = ref<'single' | 'tiled'>('tiled');
const isGenerating = ref(false);
const progress = ref(0);
const progressStatus = ref('');
const error = ref<string | null>(null);

const drillMm = computed(() => (store.config.drillShape === 'square' ? 2.5 : 2.8));

const estimatedPages = computed(() => {
  if (exportMode.value === 'single') {
    return 3; // Cover + Inventory + Blueprint
  } else {
    const tileCols = Math.max(1, Math.floor(180 / drillMm.value));
    const tileRows = Math.max(1, Math.floor(250 / drillMm.value));
    const overlap = 2;
    const numTilesX = Math.ceil(store.gridWidth / (tileCols - overlap));
    const numTilesY = Math.ceil(store.gridHeight / (tileRows - overlap));
    return 2 + numTilesX * numTilesY; // Cover + Inventory + Tiles
  }
});

async function handleExport() {
  if (isGenerating.value) return;

  isGenerating.value = true;
  progress.value = 0;
  progressStatus.value = 'Starting export...';
  error.value = null;

  try {
    // Generate simulated thumbnail for cover
    let thumbnailDataUrl: string | undefined = undefined;
    if (store.sourceImageElement) {
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 300;
      thumbCanvas.height = Math.round(300 * (store.gridHeight / store.gridWidth));
      const tCtx = thumbCanvas.getContext('2d');
      if (tCtx) {
        tCtx.drawImage(store.sourceImageElement, 0, 0, thumbCanvas.width, thumbCanvas.height);
        thumbnailDataUrl = thumbCanvas.toDataURL('image/png');
      }
    }

    const pdfBlob = await exportDiamondArtPdf({
      title: projectTitle.value,
      config: store.config,
      grid: store.grid,
      activePalette: store.activePalette,
      gridWidth: store.gridWidth,
      gridHeight: store.gridHeight,
      exportMode: exportMode.value,
      thumbnailDataUrl,
      onProgress: (pct, status) => {
        progress.value = pct;
        progressStatus.value = status;
      }
    });

    // Trigger download
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    const sanitizedTitle = projectTitle.value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    a.download = `${sanitizedTitle}-${exportMode.value}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    isGenerating.value = false;
    emit('close');
  } catch (err: any) {
    isGenerating.value = false;
    error.value = err?.message || 'Failed to export PDF';
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
  >
    <div
      class="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-slate-100 flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200"
    >
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <FileDown class="w-5 h-5 text-sky-400" />
            <span>Export Printable Vector PDF</span>
          </h2>
          <p class="text-xs text-slate-400 mt-0.5">
            Produces razor-sharp 100% vector diamond painting patterns & inventory.
          </p>
        </div>
        <button
          @click="emit('close')"
          :disabled="isGenerating"
          class="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Settings -->
      <div class="space-y-4">
        <!-- Title input -->
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Document Project Title</label>
          <input
            type="text"
            v-model="projectTitle"
            class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500"
            placeholder="Pattern title..."
          />
        </div>

        <!-- Mode Selection -->
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-2">Print Layout Format</label>
          <div class="grid grid-cols-2 gap-3">
            <button
              type="button"
              @click="exportMode = 'tiled'"
              :class="[
                'p-3 rounded-xl border text-left flex flex-col gap-1 transition-all',
                exportMode === 'tiled'
                  ? 'border-sky-500 bg-sky-500/10 text-white shadow-sm'
                  : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-600'
              ]"
            >
              <div class="text-xs font-bold flex items-center justify-between">
                <span>Tiled A4 Sheets</span>
                <CheckCircle2 v-if="exportMode === 'tiled'" class="w-3.5 h-3.5 text-sky-400" />
              </div>
              <p class="text-[11px] text-slate-400 leading-snug">
                For home printers. Multi-page grid with 2-drill overlap guides and sheet minimap.
              </p>
            </button>

            <button
              type="button"
              @click="exportMode = 'single'"
              :class="[
                'p-3 rounded-xl border text-left flex flex-col gap-1 transition-all',
                exportMode === 'single'
                  ? 'border-sky-500 bg-sky-500/10 text-white shadow-sm'
                  : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-600'
              ]"
            >
              <div class="text-xs font-bold flex items-center justify-between">
                <span>Single Giant Blueprint</span>
                <CheckCircle2 v-if="exportMode === 'single'" class="w-3.5 h-3.5 text-sky-400" />
              </div>
              <p class="text-[11px] text-slate-400 leading-snug">
                For wide-format plotters & professional print shops. Continuous 1:1 single sheet.
              </p>
            </button>
          </div>
        </div>

        <!-- Specifications summary -->
        <div class="p-3 bg-slate-800/50 rounded-xl border border-slate-700/60 text-xs space-y-1.5 text-slate-300">
          <div class="flex justify-between">
            <span class="text-slate-400">Physical Size:</span>
            <span class="font-semibold">{{ store.config.widthCm }} × {{ store.config.heightCm }} cm</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Drill Resolution:</span>
            <span class="font-semibold">{{ store.gridWidth }} × {{ store.gridHeight }} drills ({{ store.totalDrills.toLocaleString() }} total)</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Drill Shape & Scale:</span>
            <span class="font-semibold">{{ store.config.drillShape }} ({{ drillMm }} mm true scale)</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">DMC Palette Shades:</span>
            <span class="font-semibold">{{ store.activePalette.length }} colors</span>
          </div>
          <div class="flex justify-between border-t border-slate-700/80 pt-1 text-sky-400">
            <span>Estimated Total PDF Pages:</span>
            <span class="font-bold">{{ estimatedPages }} pages</span>
          </div>
        </div>

        <!-- Progress bar when generating -->
        <div v-if="isGenerating" class="space-y-1.5">
          <div class="flex justify-between text-xs font-medium text-slate-300">
            <span>{{ progressStatus }}</span>
            <span>{{ progress }}%</span>
          </div>
          <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              class="h-full bg-sky-500 rounded-full transition-all duration-300"
              :style="{ width: `${progress}%` }"
            />
          </div>
        </div>

        <!-- Error notice -->
        <div v-if="error" class="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
          <AlertCircle class="w-4 h-4 shrink-0" />
          <span>{{ error }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
        <button
          type="button"
          @click="emit('close')"
          :disabled="isGenerating"
          class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          Cancel
        </button>
        <button
          type="button"
          @click="handleExport"
          :disabled="isGenerating"
          class="px-5 py-2.5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white flex items-center gap-2 shadow-lg shadow-sky-500/20 disabled:opacity-50 transition"
        >
          <Loader2 v-if="isGenerating" class="w-4 h-4 animate-spin" />
          <FileDown v-else class="w-4 h-4" />
          <span>{{ isGenerating ? 'Compiling PDF...' : 'Download Vector PDF' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
