<script setup lang="ts">
import { ref } from 'vue';
import { useProjectStore } from './stores/projectStore';
import ImageUploader from './components/ImageUploader.vue';
import ControlPanel from './components/ControlPanel.vue';
import InteractiveCanvas from './components/InteractiveCanvas.vue';
import PaletteInspector from './components/PaletteInspector.vue';
import ExportModal from './components/ExportModal.vue';
import {
  Gem,
  FileDown,
  Sparkles,
  ChevronLeft,
  ChevronRight
} from 'lucide-vue-next';

const store = useProjectStore();

const isExportModalOpen = ref(false);
const isLeftSidebarOpen = ref(true);
const isRightSidebarOpen = ref(true);
</script>

<template>
  <div class="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
    <!-- Top Navigation Bar -->
    <header class="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 flex items-center justify-between z-30 shrink-0">
      <!-- Brand Logo -->
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-sky-500/25">
          <Gem class="w-5 h-5" />
        </div>
        <div>
          <h1 class="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
            <span>Diamond Art Studio</span>
            <span class="text-[10px] font-semibold bg-sky-500/20 text-sky-400 border border-sky-500/30 px-1.5 py-0.2 rounded-md">
              v1.0
            </span>
          </h1>
          <p class="text-[10px] text-slate-400 hidden sm:block">
            Professional 1:1 Vector Diamond Painting Generator
          </p>
        </div>
      </div>

      <!-- Quick Canvas Status Badges -->
      <div v-if="store.hasPattern" class="hidden md:flex items-center gap-2 text-xs">
        <div class="px-2.5 py-1 bg-slate-800/80 border border-slate-700/80 rounded-lg flex items-center gap-1.5 text-slate-300">
          <span class="text-slate-500">Size:</span>
          <span class="font-medium text-white">{{ store.config.widthCm }} × {{ store.config.heightCm }} cm</span>
        </div>

        <div class="px-2.5 py-1 bg-slate-800/80 border border-slate-700/80 rounded-lg flex items-center gap-1.5 text-slate-300">
          <span class="text-slate-500">Drills:</span>
          <span class="font-mono font-medium text-sky-400">{{ store.totalDrills.toLocaleString() }}</span>
          <span class="text-slate-500">({{ store.gridWidth }}×{{ store.gridHeight }})</span>
        </div>

        <div class="px-2.5 py-1 bg-slate-800/80 border border-slate-700/80 rounded-lg flex items-center gap-1.5 text-slate-300">
          <span class="text-slate-500">Palette:</span>
          <span class="font-bold text-emerald-400">{{ store.activePalette.length }} DMC colors</span>
        </div>
      </div>

      <!-- Header Actions -->
      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="isExportModalOpen = true"
          :disabled="!store.hasPattern"
          class="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:hover:bg-sky-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-sky-500/20 transition cursor-pointer disabled:cursor-not-allowed"
        >
          <FileDown class="w-4 h-4" />
          <span>Export Vector PDF</span>
        </button>
      </div>
    </header>

    <!-- Main Workspace (3 columns: Left Settings, Center Canvas, Right Palette) -->
    <main class="flex-1 flex overflow-hidden relative">
      <!-- Left Sidebar: Upload & Controls -->
      <aside
        :class="[
          'border-r border-slate-800 bg-slate-900/95 flex flex-col shrink-0 transition-all duration-300 relative z-20',
          isLeftSidebarOpen ? 'w-80' : 'w-0 overflow-hidden border-r-0'
        ]"
      >
        <div class="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar w-80">
          <!-- Image Uploader -->
          <div>
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Sparkles class="w-3.5 h-3.5 text-sky-400" />
              <span>Source Artwork</span>
            </h2>
            <ImageUploader />
          </div>

          <!-- Configuration & Quantization Controls -->
          <ControlPanel />
        </div>
      </aside>

      <!-- Left Sidebar Toggle Tab -->
      <button
        @click="isLeftSidebarOpen = !isLeftSidebarOpen"
        class="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-r-lg text-slate-400 hover:text-white transition shadow-lg"
        :style="{ left: isLeftSidebarOpen ? '320px' : '0px' }"
        :title="isLeftSidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'"
      >
        <ChevronLeft v-if="isLeftSidebarOpen" class="w-3.5 h-3.5" />
        <ChevronRight v-else class="w-3.5 h-3.5" />
      </button>

      <!-- Center Viewport: Interactive Canvas -->
      <section class="flex-1 relative flex flex-col overflow-hidden bg-slate-950">
        <!-- Interactive Canvas Viewport -->
        <InteractiveCanvas v-if="store.hasPattern" />

        <!-- Empty State / Welcome Screen -->
        <div
          v-else
          class="h-full flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto space-y-4"
        >
          <div class="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shadow-xl">
            <Gem class="w-8 h-8" />
          </div>

          <div>
            <h2 class="text-lg font-bold text-white">Start Your Diamond Art Creation</h2>
            <p class="text-xs text-slate-400 mt-1 leading-relaxed">
              Upload your own photo or click below to load our colorful sample artwork. The engine will instantly downsample, cluster colors in CIELAB space, map to official DMC threads, and generate a printable vector blueprint.
            </p>
          </div>

          <div class="pt-2">
            <ImageUploader />
          </div>
        </div>
      </section>

      <!-- Right Sidebar Toggle Tab -->
      <button
        v-if="store.hasPattern"
        @click="isRightSidebarOpen = !isRightSidebarOpen"
        class="absolute right-0 top-1/2 -translate-y-1/2 z-20 p-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-l-lg text-slate-400 hover:text-white transition shadow-lg"
        :style="{ right: isRightSidebarOpen ? '320px' : '0px' }"
        :title="isRightSidebarOpen ? 'Collapse Palette' : 'Expand Palette'"
      >
        <ChevronRight v-if="isRightSidebarOpen" class="w-3.5 h-3.5" />
        <ChevronLeft v-else class="w-3.5 h-3.5" />
      </button>

      <!-- Right Sidebar: DMC Palette Inspector -->
      <aside
        v-if="store.hasPattern"
        :class="[
          'border-l border-slate-800 bg-slate-900/95 flex flex-col shrink-0 transition-all duration-300 relative z-20',
          isRightSidebarOpen ? 'w-80' : 'w-0 overflow-hidden border-l-0'
        ]"
      >
        <div class="w-80 h-full flex flex-col overflow-hidden">
          <PaletteInspector />
        </div>
      </aside>
    </main>

    <!-- PDF Export Modal -->
    <ExportModal :isOpen="isExportModalOpen" @close="isExportModalOpen = false" />
  </div>
</template>
