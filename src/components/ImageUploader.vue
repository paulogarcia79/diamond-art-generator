<script setup lang="ts">
import { ref } from 'vue';
import { useProjectStore } from '../stores/projectStore';
import { UploadCloud, Image as ImageIcon, Sparkles } from 'lucide-vue-next';

const store = useProjectStore();
const fileInput = ref<HTMLInputElement | null>(null);
const isDraggingOver = ref(false);

function triggerFileInput() {
  fileInput.value?.click();
}

function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    store.setSourceImage(target.files[0]);
  }
}

function handleDrop(e: DragEvent) {
  isDraggingOver.value = false;
  if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
    store.setSourceImage(e.dataTransfer.files[0]);
  }
}

// Generate demo synthetic image (colorful sunset landscape) for quick 1-click preview
function loadSampleImage() {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 750;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 450);
  skyGrad.addColorStop(0, '#1e1b4b'); // deep indigo
  skyGrad.addColorStop(0.3, '#701a75'); // purple
  skyGrad.addColorStop(0.6, '#e11d48'); // bright rose
  skyGrad.addColorStop(0.85, '#f97316'); // orange
  skyGrad.addColorStop(1, '#fde047'); // gold
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 600, 450);

  // Glowing Sun
  const sunGrad = ctx.createRadialGradient(300, 320, 10, 300, 320, 90);
  sunGrad.addColorStop(0, '#ffffff');
  sunGrad.addColorStop(0.5, '#fef08a');
  sunGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(300, 320, 90, 0, Math.PI * 2);
  ctx.fill();

  // Distant Mountain range
  ctx.fillStyle = '#4c1d95';
  ctx.beginPath();
  ctx.moveTo(0, 400);
  ctx.lineTo(120, 320);
  ctx.lineTo(240, 380);
  ctx.lineTo(380, 290);
  ctx.lineTo(490, 370);
  ctx.lineTo(600, 340);
  ctx.lineTo(600, 450);
  ctx.lineTo(0, 450);
  ctx.closePath();
  ctx.fill();

  // Foreground rolling hills
  ctx.fillStyle = '#064e3b';
  ctx.beginPath();
  ctx.moveTo(0, 430);
  ctx.bezierCurveTo(150, 410, 300, 470, 600, 420);
  ctx.lineTo(600, 750);
  ctx.lineTo(0, 750);
  ctx.closePath();
  ctx.fill();

  // Lake reflection
  const waterGrad = ctx.createLinearGradient(0, 450, 0, 600);
  waterGrad.addColorStop(0, '#0284c7');
  waterGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = waterGrad;
  ctx.beginPath();
  ctx.ellipse(300, 520, 240, 50, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pine trees silhouette
  ctx.fillStyle = '#022c22';
  for (let x = 30; x < 570; x += 45) {
    const treeH = 50 + (x % 3) * 25;
    const treeY = 620 + (x % 5) * 15;
    ctx.beginPath();
    ctx.moveTo(x, treeY - treeH);
    ctx.lineTo(x - 18, treeY);
    ctx.lineTo(x + 18, treeY);
    ctx.closePath();
    ctx.fill();
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  store.setSourceImage(dataUrl);
}
</script>

<template>
  <div class="space-y-3">
    <div
      @click="triggerFileInput"
      @dragover.prevent="isDraggingOver = true"
      @dragleave.prevent="isDraggingOver = false"
      @drop.prevent="handleDrop"
      :class="[
        'border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group',
        isDraggingOver
          ? 'border-sky-400 bg-sky-500/10'
          : 'border-slate-700 bg-slate-800/40 hover:border-slate-500 hover:bg-slate-800/70'
      ]"
    >
      <input
        ref="fileInput"
        type="file"
        accept="image/png, image/jpeg, image/webp"
        class="hidden"
        @change="handleFileChange"
      />

      <div
        class="w-10 h-10 rounded-full bg-slate-800 group-hover:bg-sky-500/20 text-slate-400 group-hover:text-sky-400 flex items-center justify-center transition-colors shadow-inner"
      >
        <UploadCloud class="w-5 h-5" />
      </div>

      <div>
        <p class="text-xs font-semibold text-slate-200">
          Click to upload or drag & drop
        </p>
        <p class="text-[11px] text-slate-400 mt-0.5">
          Supports PNG, JPG, or WebP
        </p>
      </div>

      <div
        v-if="store.sourceImageSrc"
        class="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium"
      >
        <ImageIcon class="w-3.5 h-3.5" />
        <span>Image loaded</span>
      </div>
    </div>

    <!-- Quick Sample Demo Image Loader -->
    <button
      type="button"
      @click="loadSampleImage"
      class="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition shadow-sm"
    >
      <Sparkles class="w-3.5 h-3.5 text-amber-400" />
      <span>Load Demo Sample Artwork</span>
    </button>
  </div>
</template>
