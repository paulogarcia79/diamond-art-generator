<script setup lang="ts">
import { useProjectStore } from '../stores/projectStore';
import { Sliders, RefreshCw, Layers, Sparkles } from 'lucide-vue-next';

const store = useProjectStore();

const presets = [
  { label: '30 × 40 cm', w: 30, h: 40 },
  { label: '40 × 50 cm', w: 40, h: 50 },
  { label: '50 × 70 cm', w: 50, h: 70 },
  { label: '60 × 80 cm', w: 60, h: 80 }
];

function applyPreset(w: number, h: number) {
  store.updateConfig({ widthCm: w, heightCm: h });
}

function handleGenerate() {
  store.generatePattern();
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex items-center justify-between pb-2 border-b border-slate-800">
      <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        <Sliders class="w-3.5 h-3.5 text-sky-400" />
        <span>Canvas & Drill Settings</span>
      </h3>
    </div>

    <!-- Presets -->
    <div>
      <label class="block text-xs font-semibold text-slate-300 mb-1.5">Dimension Presets</label>
      <div class="grid grid-cols-2 gap-1.5">
        <button
          v-for="p in presets"
          :key="p.label"
          type="button"
          @click="applyPreset(p.w, p.h)"
          :class="[
            'py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition',
            store.config.widthCm === p.w && store.config.heightCm === p.h
              ? 'border-sky-500 bg-sky-500/10 text-sky-300'
              : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
          ]"
        >
          {{ p.label }}
        </button>
      </div>
    </div>

    <!-- Custom Dimensions -->
    <div class="grid grid-cols-2 gap-2">
      <div>
        <label class="block text-[11px] font-medium text-slate-400 mb-1">Width (cm)</label>
        <input
          type="number"
          min="10"
          max="150"
          v-model.number="store.config.widthCm"
          class="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
        />
      </div>
      <div>
        <label class="block text-[11px] font-medium text-slate-400 mb-1">Height (cm)</label>
        <input
          type="number"
          min="10"
          max="150"
          v-model.number="store.config.heightCm"
          class="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
        />
      </div>
    </div>

    <!-- Drill Shape Selection -->
    <div>
      <label class="block text-xs font-semibold text-slate-300 mb-1.5">Drill Shape</label>
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          @click="store.config.drillShape = 'square'"
          :class="[
            'p-2 rounded-xl border text-center flex flex-col items-center gap-1 transition',
            store.config.drillShape === 'square'
              ? 'border-sky-500 bg-sky-500/15 text-white'
              : 'border-slate-800 bg-slate-800/50 text-slate-400 hover:border-slate-700'
          ]"
        >
          <div class="w-4 h-4 rounded-sm border border-current mt-0.5 bg-current/20" />
          <span class="text-xs font-semibold">Square</span>
          <span class="text-[10px] text-slate-400">2.5 mm (4/cm)</span>
        </button>

        <button
          type="button"
          @click="store.config.drillShape = 'round'"
          :class="[
            'p-2 rounded-xl border text-center flex flex-col items-center gap-1 transition',
            store.config.drillShape === 'round'
              ? 'border-sky-500 bg-sky-500/15 text-white'
              : 'border-slate-800 bg-slate-800/50 text-slate-400 hover:border-slate-700'
          ]"
        >
          <div class="w-4 h-4 rounded-full border border-current mt-0.5 bg-current/20" />
          <span class="text-xs font-semibold">Round</span>
          <span class="text-[10px] text-slate-400">2.8 mm (3.57/cm)</span>
        </button>
      </div>
    </div>

    <!-- Calculated Grid Metrics -->
    <div class="p-2.5 bg-slate-800/50 rounded-xl border border-slate-800 text-[11px] space-y-1 text-slate-300">
      <div class="flex justify-between">
        <span class="text-slate-400">Target Grid:</span>
        <span class="font-mono font-medium">{{ store.targetGridWidth }} × {{ store.targetGridHeight }} drills</span>
      </div>
      <div class="flex justify-between">
        <span class="text-slate-400">Total Diamonds:</span>
        <span class="font-mono font-bold text-sky-400">{{ (store.targetGridWidth * store.targetGridHeight).toLocaleString() }}</span>
      </div>
    </div>

    <!-- Color Quantization Controls -->
    <div class="space-y-3.5 pt-2 border-t border-slate-800">
      <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        <Sparkles class="w-3.5 h-3.5 text-sky-400" />
        <span>Color & Quality Tuning</span>
      </h3>

      <!-- Max Colors -->
      <div>
        <div class="flex justify-between text-xs mb-1">
          <span class="text-slate-300 font-medium">Max DMC Colors:</span>
          <span class="text-sky-400 font-mono font-bold">{{ store.config.maxColors }}</span>
        </div>
        <input
          type="range"
          min="10"
          max="90"
          step="1"
          v-model.number="store.config.maxColors"
          class="w-full accent-sky-500 cursor-pointer"
        />
        <div class="flex justify-between text-[10px] text-slate-500">
          <span>10 (Simpler)</span>
          <span>90 (Ultra-detailed)</span>
        </div>
      </div>

      <!-- Dithering Strength -->
      <div>
        <div class="flex justify-between text-xs mb-1">
          <span class="text-slate-300 font-medium">Floyd-Steinberg Dithering:</span>
          <span class="text-sky-400 font-mono font-bold">{{ Math.round(store.config.ditheringStrength * 100) }}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          v-model.number="store.config.ditheringStrength"
          class="w-full accent-sky-500 cursor-pointer"
        />
        <div class="flex justify-between text-[10px] text-slate-500">
          <span>0% (Posterized)</span>
          <span>100% (Full gradient)</span>
        </div>
      </div>

      <!-- Despeckle Threshold -->
      <div>
        <div class="flex justify-between text-xs mb-1">
          <span class="text-slate-300 font-medium">Despeckle / Orphan Filter:</span>
          <span class="text-sky-400 font-mono font-bold">&lt; {{ store.config.minColorThreshold }} drills</span>
        </div>
        <input
          type="range"
          min="0"
          max="50"
          step="2"
          v-model.number="store.config.minColorThreshold"
          class="w-full accent-sky-500 cursor-pointer"
        />
        <p class="text-[10px] text-slate-400 mt-0.5">
          Eliminates stray 1-to-{{ store.config.minColorThreshold }} drill speckles by merging with nearby shades.
        </p>
      </div>
    </div>

    <!-- Action Button -->
    <div class="pt-2">
      <button
        type="button"
        @click="handleGenerate"
        :disabled="store.isProcessing || !store.sourceImageElement"
        class="w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition cursor-pointer disabled:cursor-not-allowed"
      >
        <RefreshCw v-if="store.isProcessing" class="w-4 h-4 animate-spin" />
        <Layers v-else class="w-4 h-4" />
        <span>{{ store.isProcessing ? 'Processing Pattern...' : 'Generate Diamond Art' }}</span>
      </button>

      <!-- Worker Progress Bar -->
      <div v-if="store.isProcessing" class="mt-2 space-y-1">
        <div class="flex justify-between text-[11px] text-slate-400">
          <span>{{ store.statusMessage }}</span>
          <span>{{ store.progress }}%</span>
        </div>
        <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            class="h-full bg-sky-500 rounded-full transition-all duration-200"
            :style="{ width: `${store.progress}%` }"
          />
        </div>
      </div>
    </div>
  </div>
</template>
