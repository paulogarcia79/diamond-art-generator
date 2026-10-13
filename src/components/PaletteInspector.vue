<script setup lang="ts">
import { ref, computed } from 'vue';
import { useProjectStore } from '../stores/projectStore';
import type { ActivePaletteItem } from '../types/diamond';
import { Palette, Search, ArrowRightLeft, Paintbrush, Check, X } from 'lucide-vue-next';

const store = useProjectStore();

const searchQuery = ref('');
const sortBy = ref<'count' | 'code'>('count');

// Merge modal state
const isMergeModalOpen = ref(false);
const colorToReplace = ref<ActivePaletteItem | null>(null);
const targetColorCode = ref<string>('');

const filteredPalette = computed(() => {
  let list = [...store.activePalette];

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(item =>
      item.code.toLowerCase().includes(q) || item.name.toLowerCase().includes(q)
    );
  }

  if (sortBy.value === 'count') {
    list.sort((a, b) => b.count - a.count);
  } else {
    list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }

  return list;
});

function selectForBrush(code: string) {
  store.selectedDmcCode = code;
  store.toolMode = 'brush';
}

function openMergeDialog(item: ActivePaletteItem) {
  colorToReplace.value = item;
  // Default target color: the first other active color
  const other = store.activePalette.find(i => i.code !== item.code);
  targetColorCode.value = other ? other.code : '';
  isMergeModalOpen.value = true;
}

function confirmMerge() {
  if (colorToReplace.value && targetColorCode.value) {
    store.replaceColor(colorToReplace.value.code, targetColorCode.value);
    isMergeModalOpen.value = false;
    colorToReplace.value = null;
  }
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="p-4 border-b border-slate-800 space-y-3 shrink-0">
      <div class="flex items-center justify-between">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Palette class="w-3.5 h-3.5 text-sky-400" />
          <span>Active DMC Palette</span>
        </h3>
        <span class="text-xs font-mono font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
          {{ store.activePalette.length }} shades
        </span>
      </div>

      <!-- Search & Sort Filter -->
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <Search class="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Search code or name..."
            class="w-full pl-8 pr-2.5 py-1.5 bg-slate-800/80 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <select
          v-model="sortBy"
          class="bg-slate-800/80 border border-slate-700/80 rounded-lg text-xs text-slate-300 px-2 py-1.5 focus:outline-none focus:border-sky-500 cursor-pointer"
        >
          <option value="count">Count ↓</option>
          <option value="code">DMC #</option>
        </select>
      </div>
    </div>

    <!-- Color List Container -->
    <div class="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
      <div
        v-if="filteredPalette.length === 0"
        class="text-center py-8 text-xs text-slate-500"
      >
        No DMC shades match "{{ searchQuery }}"
      </div>

      <div
        v-for="item in filteredPalette"
        :key="item.code"
        :class="[
          'p-2 rounded-xl border transition-all flex items-center justify-between group',
          store.selectedDmcCode === item.code
            ? 'border-sky-500 bg-sky-500/15 shadow-sm'
            : 'border-slate-800/70 bg-slate-800/30 hover:border-slate-700 hover:bg-slate-800/60'
        ]"
      >
        <!-- Left: Swatch & Symbol & Name -->
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <!-- Swatch with symbol -->
          <div
            class="w-7 h-7 rounded-lg shadow-sm border border-black/20 flex items-center justify-center font-bold text-xs shrink-0"
            :style="{ backgroundColor: item.hex, color: item.contrastColor }"
          >
            {{ item.symbol }}
          </div>

          <!-- Color Details -->
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-white">#{{ item.code }}</span>
              <span class="text-[11px] text-slate-400 truncate">{{ item.name }}</span>
            </div>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="text-[10px] text-slate-300 font-mono">
                {{ item.count.toLocaleString() }} drills
              </span>
              <span class="text-[10px] text-slate-500">
                ({{ ((item.count / (store.totalDrills || 1)) * 100).toFixed(1) }}%)
              </span>
            </div>
          </div>
        </div>

        <!-- Right: Actions -->
        <div class="flex items-center gap-1 shrink-0 ml-2">
          <!-- Brush select button -->
          <button
            type="button"
            @click="selectForBrush(item.code)"
            :class="[
              'p-1.5 rounded-lg text-xs transition',
              store.selectedDmcCode === item.code
                ? 'bg-sky-500 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            ]"
            title="Set as manual brush color"
          >
            <Check v-if="store.selectedDmcCode === item.code" class="w-3.5 h-3.5" />
            <Paintbrush v-else class="w-3.5 h-3.5" />
          </button>

          <!-- Merge / Replace button -->
          <button
            type="button"
            @click="openMergeDialog(item)"
            class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
            title="Replace / Merge with another color"
          >
            <ArrowRightLeft class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Merge / Replace Modal -->
    <div
      v-if="isMergeModalOpen && colorToReplace"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
    >
      <div class="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl relative text-slate-100 flex flex-col gap-4">
        <div class="flex items-center justify-between pb-2 border-b border-slate-800">
          <h4 class="text-sm font-bold text-white flex items-center gap-2">
            <ArrowRightLeft class="w-4 h-4 text-sky-400" />
            <span>Replace / Merge Color</span>
          </h4>
          <button @click="isMergeModalOpen = false" class="text-slate-400 hover:text-white">
            <X class="w-4 h-4" />
          </button>
        </div>

        <p class="text-xs text-slate-300">
          Replace all <strong class="text-sky-300">#{{ colorToReplace.code }} ({{ colorToReplace.name }})</strong> drills across the entire canvas with another active color:
        </p>

        <!-- Destination Color Select -->
        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1.5">Target Replacement Color</label>
          <select
            v-model="targetColorCode"
            class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
          >
            <option
              v-for="target in store.activePalette.filter(i => i.code !== colorToReplace?.code)"
              :key="target.code"
              :value="target.code"
            >
              #{{ target.code }} - {{ target.name }} ({{ target.count }} drills)
            </option>
          </select>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            @click="isMergeModalOpen = false"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="confirmMerge"
            class="px-4 py-1.5 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white"
          >
            Merge Colors
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
