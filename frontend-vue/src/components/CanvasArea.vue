<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { PackResult } from '../lib/packing'
import type { AtlasImageEntry } from '../stores/atlasStore'
import { atlasStore } from '../stores/atlasStore'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const viewportRef = ref<HTMLElement | null>(null)

const scale = ref(1)
const tx = ref(0)
const ty = ref(0)
const isPanning = ref(false)
const spaceDown = ref(false)

/** 多页时：单页预览 / 全部总览（竖向总排版） */
const overviewMode = ref(false)

let panPointerId: number | null = null
let panStart = { cx: 0, cy: 0, tx: 0, ty: 0 }

const PAD_X = 12
const LABEL_H = 20
const GAP_Y = 22

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}

function layoutOverview(sheets: PackResult[]): {
  cw: number
  ch: number
  blocks: { pack: PackResult; ox: number; oy: number; labelY: number; index: number }[]
} {
  let y = PAD_X
  const blocks: { pack: PackResult; ox: number; oy: number; labelY: number; index: number }[] = []
  let maxRight = PAD_X
  for (let i = 0; i < sheets.length; i++) {
    const pack = sheets[i]
    if (i > 0) y += GAP_Y
    const labelY = y
    y += LABEL_H + 8
    const ox = PAD_X
    const oy = y
    blocks.push({ pack, ox, oy, labelY, index: i })
    y += pack.height
    maxRight = Math.max(maxRight, ox + pack.width)
  }
  return { cw: maxRight + PAD_X, ch: y + PAD_X, blocks }
}

function drawSheetContent(
  ctx: CanvasRenderingContext2D,
  pack: PackResult,
  ox: number,
  oy: number,
  map: Map<string, AtlasImageEntry>,
) {
  ctx.fillStyle = '#1a1a1e'
  ctx.fillRect(ox, oy, pack.width, pack.height)
  for (const p of pack.placements) {
    const entry = map.get(p.id)
    if (!entry) continue
    const x = ox + p.x
    const y = oy + p.y
    ctx.drawImage(entry.img, 0, 0, entry.width, entry.height, x, y, p.w, p.h)
    ctx.save()
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)'
    ctx.strokeRect(x + 1.5, y + 1.5, p.w - 2, p.h - 2)
    ctx.strokeStyle = 'rgba(0, 230, 255, 0.92)'
    ctx.strokeRect(x + 0.5, y + 0.5, p.w - 1, p.h - 1)
    ctx.restore()
  }
  ctx.save()
  ctx.setLineDash([6, 4])
  ctx.strokeStyle = '#ff9f1a'
  ctx.lineWidth = 2
  ctx.strokeRect(ox + 1, oy + 1, pack.width - 2, pack.height - 2)
  ctx.restore()
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#2d2d32'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#8a8a8e'
  ctx.font = '14px Segoe UI, sans-serif'
  ctx.fillText('导入图片并点击「运行打包」预览图集', 24, h / 2)
}

function redrawOverview(el: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const sheets = atlasStore.state.packSheets
  const map = new Map(atlasStore.state.images.map((e) => [e.id, e]))
  const { cw, ch, blocks } = layoutOverview(sheets)
  el.width = cw
  el.height = ch
  ctx.fillStyle = '#9e9ea3'
  ctx.fillRect(0, 0, cw, ch)
  for (const b of blocks) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
    ctx.fillRect(0, b.labelY - 2, cw, LABEL_H + 4)
    ctx.fillStyle = '#222'
    ctx.font = '600 12px Segoe UI, sans-serif'
    ctx.fillText(
      `页码 ${b.index}  ·  输出边界 ${b.pack.width}×${b.pack.height} px`,
      PAD_X,
      b.labelY + 14,
    )
    drawSheetContent(ctx, b.pack, b.ox, b.oy, map)
  }
}

function redrawSingle(el: HTMLCanvasElement, ctx: CanvasRenderingContext2D, pack: PackResult) {
  const map = new Map(atlasStore.state.images.map((e) => [e.id, e]))
  el.width = pack.width
  el.height = pack.height
  drawSheetContent(ctx, pack, 0, 0, map)
}

function redraw() {
  const el = canvasRef.value
  if (!el) return
  const ctx = el.getContext('2d')
  if (!ctx) return
  const sheets = atlasStore.state.packSheets
  if (!sheets.length) {
    overviewMode.value = false
    el.width = 640
    el.height = 360
    drawPlaceholder(ctx, el.width, el.height)
    return
  }
  if (sheets.length > 1 && overviewMode.value) {
    redrawOverview(el, ctx)
    return
  }
  const pack = atlasStore.getCurrentPack()
  if (!pack || pack.placements.length === 0) {
    el.width = 640
    el.height = 360
    drawPlaceholder(ctx, el.width, el.height)
    return
  }
  redrawSingle(el, ctx, pack)
}

function fitToViewport() {
  const vp = viewportRef.value
  const cv = canvasRef.value
  if (!vp || !cv) return
  const pad = 16
  const rw = Math.max(1, vp.clientWidth - pad * 2)
  const rh = Math.max(1, vp.clientHeight - pad * 2)
  const cw = cv.width
  const ch = cv.height
  if (cw < 1 || ch < 1) return
  let s = Math.min(rw / cw, rh / ch)
  s = clamp(s, 0.05, 16)
  scale.value = s
  tx.value = (vp.clientWidth - cw * s) / 2
  ty.value = (vp.clientHeight - ch * s) / 2
}

function onWheel(e: WheelEvent) {
  const vp = viewportRef.value
  if (!vp) return
  e.preventDefault()
  const rect = vp.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
  const newScale = clamp(scale.value * factor, 0.05, 16)
  const wx = (mx - tx.value) / scale.value
  const wy = (my - ty.value) / scale.value
  tx.value = mx - wx * newScale
  ty.value = my - wy * newScale
  scale.value = newScale
}

function isTypingTarget(t: EventTarget | null) {
  if (!t || !(t instanceof HTMLElement)) return false
  const tag = t.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return t.isContentEditable
}

function onKeyDown(e: KeyboardEvent) {
  if (e.code === 'Space' && !isTypingTarget(e.target)) {
    e.preventDefault()
    spaceDown.value = true
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space') spaceDown.value = false
}

function wantsPan(e: PointerEvent) {
  return e.button === 1 || (e.button === 0 && spaceDown.value)
}

function onPointerDown(e: PointerEvent) {
  if (!wantsPan(e)) return
  const vp = viewportRef.value
  if (!vp || !vp.contains(e.target as Node)) return
  e.preventDefault()
  panPointerId = e.pointerId
  isPanning.value = true
  panStart = { cx: e.clientX, cy: e.clientY, tx: tx.value, ty: ty.value }
  vp.setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (panPointerId !== e.pointerId) return
  tx.value = panStart.tx + (e.clientX - panStart.cx)
  ty.value = panStart.ty + (e.clientY - panStart.cy)
}

function endPan(e: PointerEvent) {
  if (panPointerId !== e.pointerId) return
  const vp = viewportRef.value
  if (vp && panPointerId != null) {
    try {
      vp.releasePointerCapture(panPointerId)
    } catch {
      /* ignore */
    }
  }
  panPointerId = null
  isPanning.value = false
}

function onPointerUp(e: PointerEvent) {
  endPan(e)
}

function onPointerCancel(e: PointerEvent) {
  endPan(e)
}

function onWindowBlur() {
  spaceDown.value = false
}

const sheetCount = computed(() => atlasStore.state.packSheets.length)

const canvasSubtitle = computed(() => {
  const n = sheetCount.value
  if (n === 0) return '无预览'
  if (n > 1 && overviewMode.value) {
    const { cw, ch } = layoutOverview(atlasStore.state.packSheets)
    return `全部总览 · 总排版 ${cw}×${ch} px · 共 ${n} 页（页码 0～${n - 1}）`
  }
  const sheets = atlasStore.state.packSheets
  const i = Math.min(Math.max(0, atlasStore.state.activeSheetIndex), n - 1)
  const p = sheets[i]
  return `页码 ${i}/${n} · 输出边界 ${p.width}×${p.height} px`
})

function toggleOverview() {
  if (sheetCount.value <= 1) return
  overviewMode.value = !overviewMode.value
  nextTick(() => {
    redraw()
    nextTick(() => fitToViewport())
  })
}

function prevPage() {
  const n = sheetCount.value
  if (n <= 1) return
  const i = atlasStore.state.activeSheetIndex
  atlasStore.setActiveSheetIndex((i - 1 + n) % n)
}

function nextPage() {
  const n = sheetCount.value
  if (n <= 1) return
  const i = atlasStore.state.activeSheetIndex
  atlasStore.setActiveSheetIndex((i + 1) % n)
}

watch(sheetCount, (n) => {
  if (n <= 1) overviewMode.value = false
})

onMounted(() => {
  redraw()
  nextTick(() => fitToViewport())
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onWindowBlur)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', onWindowBlur)
})

watch(
  () => [
    atlasStore.state.packSheets,
    atlasStore.state.activeSheetIndex,
    atlasStore.state.images.length,
    overviewMode.value,
  ],
  () => {
    redraw()
    nextTick(() => fitToViewport())
  },
)

const panLayerStyle = computed(() => ({
  transform: `translate(${tx.value}px, ${ty.value}px) scale(${scale.value})`,
  transformOrigin: '0 0',
}))
</script>

<template>
  <div class="canvas-shell win-inset">
    <div class="canvas-title-bar win-panel-title">
      <div class="title-text-block">
        <span class="title-strong">画布</span>
        <span class="title-sub">{{ canvasSubtitle }}</span>
      </div>
      <div class="title-actions" v-if="sheetCount > 0">
        <template v-if="sheetCount > 1">
          <button
            type="button"
            class="title-btn"
            :class="{ active: overviewMode }"
            title="竖向排列所有页，便于核对每页输出边界与总尺寸"
            @click="toggleOverview"
          >
            {{ overviewMode ? '单页' : '全部总览' }}
          </button>
          <template v-if="!overviewMode">
            <button type="button" class="title-btn icon" title="上一页" @click="prevPage">◀</button>
            <button type="button" class="title-btn icon" title="下一页" @click="nextPage">▶</button>
          </template>
        </template>
      </div>
    </div>
    <div
      ref="viewportRef"
      class="viewport"
      :class="{ panning: isPanning, 'space-pan': spaceDown }"
      @wheel="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @contextmenu.prevent
    >
      <div class="pan-layer" :style="panLayerStyle">
        <canvas ref="canvasRef" class="cv" />
      </div>
    </div>
    <div class="hint-bar" aria-hidden="true">
      橙色虚线：单页输出边界 · 青色线：各图块边界 · 滚轮缩放 / 中键或空格+左键平移
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
.canvas-title-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 12px;
  min-height: 26px;
}
.title-text-block {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  flex: 1;
}
.title-strong {
  font-weight: 700;
  flex-shrink: 0;
}
.title-sub {
  font-size: 11px;
  font-weight: 500;
  color: #333;
  word-break: break-all;
}
.title-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.title-btn {
  font: inherit;
  font-size: 11px;
  height: 20px;
  padding: 0 8px;
  border: 1px solid #707070;
  background: linear-gradient(180deg, #fff 0%, #e4e4e4 100%);
  cursor: pointer;
  border-radius: 2px;
}
.title-btn:hover {
  background: linear-gradient(180deg, #f6fbff 0%, #d4e8fc 100%);
  border-color: #6ab5e7;
}
.title-btn.active {
  background: linear-gradient(180deg, #cce8ff 0%, #9fd2f7 100%);
  border-color: #0078d4;
  font-weight: 600;
}
.title-btn.icon {
  min-width: 26px;
  padding: 0 4px;
}
.viewport {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-height: 0;
  background: repeating-conic-gradient(#bdbdbd 0% 25%, #d0d0d0 0% 50%) 0 0 / 16px 16px;
  touch-action: none;
}
.viewport.space-pan:not(.panning) {
  cursor: grab;
}
.viewport.panning {
  cursor: grabbing;
}
.pan-layer {
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform;
}
.cv {
  display: block;
  image-rendering: pixelated;
  box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.25);
  border: 1px solid var(--win-border-dark);
  vertical-align: top;
}
.hint-bar {
  flex-shrink: 0;
  padding: 2px 8px 4px;
  font-size: 10px;
  color: #555;
  background: linear-gradient(180deg, #d8d8d8 0%, #c8c8c8 100%);
  border-top: 1px solid #a0a0a0;
}
</style>
