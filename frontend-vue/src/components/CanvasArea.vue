<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { atlasStore } from '../stores/atlasStore'

const canvasRef = ref<HTMLCanvasElement | null>(null)

function drawPlaceholder(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#2d2d32'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#8a8a8e'
  ctx.font = '14px Segoe UI, sans-serif'
  ctx.fillText('导入图片并点击「运行打包」预览图集', 24, h / 2)
}

function redraw() {
  const el = canvasRef.value
  if (!el) return
  const ctx = el.getContext('2d')
  if (!ctx) return
  const pack = atlasStore.state.lastPack
  if (!pack || pack.placements.length === 0) {
    el.width = 640
    el.height = 360
    drawPlaceholder(ctx, el.width, el.height)
    return
  }
  el.width = pack.width
  el.height = pack.height
  ctx.fillStyle = '#1a1a1e'
  ctx.fillRect(0, 0, el.width, el.height)
  const map = new Map(atlasStore.state.images.map((e) => [e.id, e]))
  for (const p of pack.placements) {
    const entry = map.get(p.id)
    if (!entry) continue
    ctx.drawImage(entry.img, 0, 0, entry.width, entry.height, p.x, p.y, p.w, p.h)
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.35)'
    ctx.lineWidth = 1
    ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1)
  }
}

onMounted(redraw)
watch(
  () => [atlasStore.state.lastPack, atlasStore.state.images.length],
  redraw,
  { deep: true },
)
</script>

<template>
  <div class="canvas-shell win-inset">
    <div class="win-panel-title">画布</div>
    <div class="viewport">
      <canvas ref="canvasRef" class="cv" />
    </div>
  </div>
</template>

<style scoped>
.canvas-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: #c8c8c8;
}
.viewport {
  flex: 1;
  overflow: auto;
  padding: 12px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background: repeating-conic-gradient(#bdbdbd 0% 25%, #d0d0d0 0% 50%) 0 0 / 16px 16px;
}
.cv {
  image-rendering: pixelated;
  box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.25);
  border: 1px solid var(--win-border-dark);
  max-width: 100%;
  height: auto;
}
</style>
