<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { PackResult, Placement } from '../lib/packing'
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

/** 与 redrawOverview 一致，供点击命中（含 bleed，坐标需扣边距） */
const overviewHitCache = ref<{
  blocks: {
    pack: PackResult
    ox: number
    oy: number
    index: number
    bleed: number
    logicW: number
    logicH: number
  }[]
  cw: number
  ch: number
} | null>(null)

let panPointerId: number | null = null
let panStart = { cx: 0, cy: 0, tx: 0, ty: 0 }

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}

/** 纹理像素：线宽一半 + 选中框外扩，避免被 canvas 位图边缘裁切 */
function computeCanvasBleed(helperStrokePx: number): number {
  const px = Math.max(1, helperStrokePx)
  const selPad = Math.max(1, Math.round(px * 0.35))
  return Math.ceil(px / 2) + selPad + 4
}

function drawHelperGrid(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  w: number,
  h: number,
  step: number,
  lineW: number,
) {
  if (step < 4) return
  ctx.save()
  ctx.strokeStyle = 'rgba(70, 75, 95, 0.42)'
  ctx.lineWidth = Math.max(0.5, lineW)
  ctx.setLineDash([3, 5])
  for (let gx = 0; gx <= w; gx += step) {
    const x = ox + gx
    ctx.beginPath()
    ctx.moveTo(x, oy)
    ctx.lineTo(x, oy + h)
    ctx.stroke()
  }
  for (let gy = 0; gy <= h; gy += step) {
    const y = oy + gy
    ctx.beginPath()
    ctx.moveTo(ox, y)
    ctx.lineTo(ox + w, y)
    ctx.stroke()
  }
  ctx.restore()
}

interface SheetDrawOpts {
  selectedId: string | null
  maxW: number
  maxH: number
  showGrid: boolean
  showMaxBounds: boolean
  showOutputBounds: boolean
  showSpriteBounds: boolean
  /** 辅助线线宽（纹理像素），≥1 */
  helperStrokePx: number
  helperGridStep: number
  /** 四周边距（纹理像素），内容从 (ox+bleed, oy+bleed) 起画 */
  bleed: number
}

function layoutOverview(
  sheets: PackResult[],
  mul: number,
  limitW: number,
  limitH: number,
  bleed: number,
): {
  cw: number
  ch: number
  blocks: { pack: PackResult; ox: number; oy: number; labelY: number; index: number }[]
} {
  const PAD_X = Math.round(14 * mul)
  const LABEL_H = Math.round(26 * mul)
  const GAP_Y = Math.round(26 * mul)
  let y = PAD_X
  const blocks: { pack: PackResult; ox: number; oy: number; labelY: number; index: number }[] = []
  let maxRight = PAD_X
  for (let i = 0; i < sheets.length; i++) {
    const pack = sheets[i]
    const logicW = Math.max(pack.width, limitW) + 1
    const logicH = Math.max(pack.height, limitH) + 1
    const cellW = logicW + 2 * bleed
    const cellH = logicH + 2 * bleed
    if (i > 0) y += GAP_Y
    const labelY = y
    y += LABEL_H + Math.round(10 * mul)
    const ox = PAD_X
    const oy = y
    blocks.push({ pack, ox, oy, labelY, index: i })
    y += cellH
    maxRight = Math.max(maxRight, ox + cellW)
  }
  return { cw: maxRight + PAD_X, ch: y + PAD_X, blocks }
}

function drawSheetContent(
  ctx: CanvasRenderingContext2D,
  pack: PackResult,
  ox: number,
  oy: number,
  map: Map<string, AtlasImageEntry>,
  opts: SheetDrawOpts,
) {
  const {
    selectedId,
    maxW,
    maxH,
    showGrid,
    showMaxBounds,
    showOutputBounds,
    showSpriteBounds,
    helperStrokePx,
    helperGridStep,
    bleed,
  } = opts
  const px = Math.max(1, helperStrokePx)
  const outerLw = px
  const spriteLw = Math.max(1, Math.round(px * 0.9))
  const dash: [number, number] = [Math.max(4, Math.round(px * 3)), Math.max(3, Math.round(px * 2))]

  const logicW = Math.max(pack.width, maxW) + 1
  const logicH = Math.max(pack.height, maxH) + 1
  const ox0 = ox + bleed
  const oy0 = oy + bleed
  const totalW = logicW + 2 * bleed
  const totalH = logicH + 2 * bleed
  ctx.clearRect(ox, oy, totalW, totalH)

  if (showGrid) {
    drawHelperGrid(
      ctx,
      ox0,
      oy0,
      logicW,
      logicH,
      helperGridStep,
      Math.max(0.5, px * 0.5),
    )
  }

  for (const p of pack.placements) {
    const entry = map.get(p.id)
    if (!entry) continue
    const x = ox0 + p.x
    const y = oy0 + p.y
    ctx.drawImage(entry.img, 0, 0, entry.width, entry.height, x, y, p.w, p.h)
    if (!showSpriteBounds) continue
    ctx.save()
    ctx.lineWidth = spriteLw
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)'
    const inset = spriteLw * 0.5
    const iw = Math.max(0, p.w - spriteLw)
    const ih = Math.max(0, p.h - spriteLw)
    ctx.strokeRect(x + inset, y + inset, iw, ih)
    ctx.strokeStyle = 'rgba(0, 230, 255, 0.95)'
    const iw2 = Math.max(0, p.w - inset)
    const ih2 = Math.max(0, p.h - inset)
    ctx.strokeRect(x + inset * 0.5, y + inset * 0.5, iw2, ih2)
    ctx.restore()
  }

  if (showOutputBounds) {
    ctx.save()
    ctx.setLineDash(dash)
    ctx.strokeStyle = '#ff9f1a'
    ctx.lineWidth = outerLw
    const inset = outerLw * 0.5
    ctx.strokeRect(
      ox0 + inset,
      oy0 + inset,
      pack.width - outerLw,
      pack.height - outerLw,
    )
    ctx.restore()
  }

  if (showMaxBounds) {
    const maxLw = px
    const maxInset = maxLw * 0.5
    const rw = Math.max(1, maxW - maxLw)
    const rh = Math.max(1, maxH - maxLw)
    ctx.save()
    ctx.setLineDash([
      Math.max(4, Math.round(px * 2.5)),
      Math.max(3, Math.round(px * 2)),
      Math.max(8, Math.round(px * 5)),
      Math.max(3, Math.round(px * 2)),
    ])
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.92)'
    ctx.lineWidth = maxLw
    ctx.strokeRect(ox0 + maxInset, oy0 + maxInset, rw, rh)
    ctx.restore()
  }

  /* 选中框：不属于辅助线，关闭辅助线时仍绘制 */
  if (selectedId) {
    const p = pack.placements.find((pl) => pl.id === selectedId)
    if (p) {
      const x = ox0 + p.x
      const y = oy0 + p.y
      ctx.save()
      ctx.setLineDash([])
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.98)'
      ctx.lineWidth = Math.max(1, px)
      const pad = Math.max(1, Math.round(px * 0.35))
      ctx.strokeRect(x - pad, y - pad, p.w + pad * 2, p.h + pad * 2)
      ctx.restore()
    }
  }
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
  const limW = atlasStore.state.maxAtlasWidth
  const limH = atlasStore.state.maxAtlasHeight
  const maxDim = sheets.reduce(
    (acc, s) => Math.max(acc, s.width, s.height, limW, limH),
    400,
  )
  const mul = clamp(maxDim / 400, 1.25, 6.5)
  const bleed = computeCanvasBleed(atlasStore.state.canvasHelperStrokePx)
  const layout = layoutOverview(sheets, mul, limW, limH, bleed)
  overviewHitCache.value = {
    blocks: layout.blocks.map((b) => {
      const logicW = Math.max(b.pack.width, limW) + 1
      const logicH = Math.max(b.pack.height, limH) + 1
      return {
        pack: b.pack,
        ox: b.ox,
        oy: b.oy,
        index: b.index,
        bleed,
        logicW,
        logicH,
      }
    }),
    cw: layout.cw,
    ch: layout.ch,
  }

  const { cw, ch, blocks } = layout
  el.width = cw
  el.height = ch
  ctx.fillStyle = '#9e9ea3'
  ctx.fillRect(0, 0, cw, ch)

  const PAD_X = Math.round(14 * mul)
  const LABEL_H = Math.round(26 * mul)

  for (const b of blocks) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.fillRect(0, b.labelY - 2, cw, LABEL_H + 6)
    ctx.fillStyle = '#111'
    const fs = Math.round(13 * mul)
    ctx.font = `600 ${fs}px Segoe UI, sans-serif`
    ctx.fillText(
      `页码 ${b.index}  ·  输出边界 ${b.pack.width}×${b.pack.height} px`,
      PAD_X,
      b.labelY + Math.round(LABEL_H * 0.72),
    )
    drawSheetContent(ctx, b.pack, b.ox, b.oy, map, {
      selectedId: atlasStore.state.selectedId,
      maxW: atlasStore.state.maxAtlasWidth,
      maxH: atlasStore.state.maxAtlasHeight,
      showGrid: atlasStore.state.canvasHelperShowGrid,
      showMaxBounds: atlasStore.state.canvasHelperShowMaxBounds,
      showOutputBounds: atlasStore.state.canvasHelperShowOutputBounds,
      showSpriteBounds: atlasStore.state.canvasHelperShowSpriteBounds,
      helperStrokePx: atlasStore.state.canvasHelperStrokePx,
      helperGridStep: atlasStore.state.canvasHelperGridStep,
      bleed,
    })
  }
}

function redrawSingle(el: HTMLCanvasElement, ctx: CanvasRenderingContext2D, pack: PackResult) {
  const map = new Map(atlasStore.state.images.map((e) => [e.id, e]))
  const limW = atlasStore.state.maxAtlasWidth
  const limH = atlasStore.state.maxAtlasHeight
  const bleed = computeCanvasBleed(atlasStore.state.canvasHelperStrokePx)
  const logicW = Math.max(pack.width, limW) + 1
  const logicH = Math.max(pack.height, limH) + 1
  el.width = logicW + 2 * bleed
  el.height = logicH + 2 * bleed
  drawSheetContent(ctx, pack, 0, 0, map, {
    selectedId: atlasStore.state.selectedId,
    maxW: atlasStore.state.maxAtlasWidth,
    maxH: atlasStore.state.maxAtlasHeight,
    showGrid: atlasStore.state.canvasHelperShowGrid,
    showMaxBounds: atlasStore.state.canvasHelperShowMaxBounds,
    showOutputBounds: atlasStore.state.canvasHelperShowOutputBounds,
    showSpriteBounds: atlasStore.state.canvasHelperShowSpriteBounds,
    helperStrokePx: atlasStore.state.canvasHelperStrokePx,
    helperGridStep: atlasStore.state.canvasHelperGridStep,
    bleed,
  })
}

function redraw() {
  overviewHitCache.value = null
  const el = canvasRef.value
  if (!el) return
  const ctx = el.getContext('2d', { alpha: true })
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

function clientToCanvas(vpLocalX: number, vpLocalY: number): { cx: number; cy: number } {
  return {
    cx: (vpLocalX - tx.value) / scale.value,
    cy: (vpLocalY - ty.value) / scale.value,
  }
}

function hitTestSingle(pt: { cx: number; cy: number }): string | null {
  const pack = atlasStore.getCurrentPack()
  if (!pack) return null
  const bleed = computeCanvasBleed(atlasStore.state.canvasHelperStrokePx)
  return hitPlacements(pack.placements, pt.cx - bleed, pt.cy - bleed)
}

function hitPlacements(placements: Placement[], lx: number, ly: number): string | null {
  for (let i = placements.length - 1; i >= 0; i--) {
    const pl = placements[i]
    if (lx >= pl.x && lx < pl.x + pl.w && ly >= pl.y && ly < pl.y + pl.h) return pl.id
  }
  return null
}

function hitTestOverview(pt: { cx: number; cy: number }): string | null {
  const cache = overviewHitCache.value
  if (!cache) return null
  for (const b of cache.blocks) {
    const bw = b.logicW + 2 * b.bleed
    const bh = b.logicH + 2 * b.bleed
    if (pt.cx >= b.ox && pt.cx < b.ox + bw && pt.cy >= b.oy && pt.cy < b.oy + bh) {
      const lx = pt.cx - b.ox - b.bleed
      const ly = pt.cy - b.oy - b.bleed
      return hitPlacements(b.pack.placements, lx, ly)
    }
  }
  return null
}

function hitTestCanvas(vpLocalX: number, vpLocalY: number): string | null {
  const pt = clientToCanvas(vpLocalX, vpLocalY)
  if (sheetCount.value > 1 && overviewMode.value) return hitTestOverview(pt)
  return hitTestSingle(pt)
}

function onCanvasPointerDown(e: PointerEvent) {
  if (e.button === 1) return
  if (e.button === 0 && spaceDown.value) return
  if (e.button !== 0) return
  e.stopPropagation()
  const vp = viewportRef.value
  if (!vp) return
  const rect = vp.getBoundingClientRect()
  const wx = e.clientX - rect.left
  const wy = e.clientY - rect.top
  const id = hitTestCanvas(wx, wy)
  atlasStore.select(id)
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

function applyCenterPanForImage(imageId: string) {
  const pack = atlasStore.getCurrentPack()
  const p = pack?.placements.find((x) => x.id === imageId)
  const vp = viewportRef.value
  if (!p || !vp) return
  const vpW = vp.clientWidth
  const vpH = vp.clientHeight
  const bleed = computeCanvasBleed(atlasStore.state.canvasHelperStrokePx)
  const cx = bleed + p.x + p.w / 2
  const cy = bleed + p.y + p.h / 2
  const margin = 28
  let s = scale.value
  if (p.w * s > vpW - margin || p.h * s > vpH - margin) {
    const sFit = Math.min((vpW - margin) / p.w, (vpH - margin) / p.h, 16)
    s = clamp(Math.max(s, sFit), 0.05, 16)
    scale.value = s
  }
  /* 视口（画布区）中心对准图块中心：tx + cx*s = vpW/2；不因「整张贴图留在视口内」而偏移 */
  tx.value = vpW / 2 - cx * s
  ty.value = vpH / 2 - cy * s
}

function runCanvasRecenterFromStore() {
  const id = atlasStore.state.canvasRecenterImageId
  if (!id) return
  const sheets = atlasStore.state.packSheets
  const si = sheets.findIndex((s) => s.placements.some((p) => p.id === id))
  if (si < 0) {
    atlasStore.clearCanvasRecenterRequest()
    return
  }
  if (sheets.length > 1) {
    overviewMode.value = false
    atlasStore.setActiveSheetIndex(si)
  }
  void nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applyCenterPanForImage(id)
        atlasStore.clearCanvasRecenterRequest()
      })
    })
  })
}

function readCheckbox(e: Event): boolean {
  return (e.target as HTMLInputElement).checked
}

function onToggleHelperGrid(e: Event) {
  atlasStore.setCanvasHelperShowGrid(readCheckbox(e))
}
function onToggleHelperMaxBounds(e: Event) {
  atlasStore.setCanvasHelperShowMaxBounds(readCheckbox(e))
}
function onToggleHelperOutputBounds(e: Event) {
  atlasStore.setCanvasHelperShowOutputBounds(readCheckbox(e))
}
function onToggleHelperSpriteBounds(e: Event) {
  atlasStore.setCanvasHelperShowSpriteBounds(readCheckbox(e))
}

function onStrokePxChange(e: Event) {
  const el = e.target as HTMLInputElement
  atlasStore.setCanvasHelperStrokePx(parseInt(el.value, 10))
  el.value = String(atlasStore.state.canvasHelperStrokePx)
}

function onGridStepChange(e: Event) {
  const el = e.target as HTMLInputElement
  atlasStore.setCanvasHelperGridStep(parseInt(el.value, 10))
  el.value = String(atlasStore.state.canvasHelperGridStep)
}

const sheetCount = computed(() => atlasStore.state.packSheets.length)

const canvasSubtitle = computed(() => {
  const n = sheetCount.value
  if (n === 0) return '无预览'
  if (n > 1 && overviewMode.value) {
    const limW = atlasStore.state.maxAtlasWidth
    const limH = atlasStore.state.maxAtlasHeight
    const maxDim = atlasStore.state.packSheets.reduce(
      (acc, s) => Math.max(acc, s.width, s.height, limW, limH),
      400,
    )
    const mul = clamp(maxDim / 400, 1.25, 6.5)
    const bleed = computeCanvasBleed(atlasStore.state.canvasHelperStrokePx)
    const { cw, ch } = layoutOverview(atlasStore.state.packSheets, mul, limW, limH, bleed)
    return `全部总览 · 总排版 ${cw}×${ch} px · 共 ${n} 页（页码 0～${n - 1}）`
  }
  const sheets = atlasStore.state.packSheets
  const i = Math.min(Math.max(0, atlasStore.state.activeSheetIndex), n - 1)
  const p = sheets[i]
  return `页码 ${i}/${n} · 输出 ${p.width}×${p.height} · 单张上限 ${atlasStore.state.maxAtlasWidth}×${atlasStore.state.maxAtlasHeight}`
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

watch(
  () => [
    atlasStore.state.selectedId,
    atlasStore.state.maxAtlasWidth,
    atlasStore.state.maxAtlasHeight,
    atlasStore.state.canvasHelperShowGrid,
    atlasStore.state.canvasHelperShowMaxBounds,
    atlasStore.state.canvasHelperShowOutputBounds,
    atlasStore.state.canvasHelperShowSpriteBounds,
    atlasStore.state.canvasHelperStrokePx,
    atlasStore.state.canvasHelperGridStep,
  ],
  () => {
    redraw()
  },
)

watch(
  () => atlasStore.state.canvasRecenterTick,
  () => {
    if (!atlasStore.state.canvasRecenterImageId) return
    runCanvasRecenterFromStore()
  },
)

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
    <div v-if="sheetCount > 0" class="canvas-tools">
      <span class="tools-group-label">辅助线</span>
      <label class="tool-item">
        <input
          type="checkbox"
          :checked="atlasStore.state.canvasHelperShowGrid"
          @change="onToggleHelperGrid"
        />
        网格
      </label>
      <label class="tool-item">
        <input
          type="checkbox"
          :checked="atlasStore.state.canvasHelperShowMaxBounds"
          @change="onToggleHelperMaxBounds"
        />
        单张上限
      </label>
      <label class="tool-item">
        <input
          type="checkbox"
          :checked="atlasStore.state.canvasHelperShowOutputBounds"
          @change="onToggleHelperOutputBounds"
        />
        输出边界
      </label>
      <label class="tool-item">
        <input
          type="checkbox"
          :checked="atlasStore.state.canvasHelperShowSpriteBounds"
          @change="onToggleHelperSpriteBounds"
        />
        图块描边
      </label>
      <label class="tool-item">
        线宽 (px)
        <input
          type="number"
          class="tool-num"
          min="1"
          max="128"
          step="1"
          title="纹理像素；默认随单张上限 max(W,H)/256（至少 1），改 W/H 会重算"
          :value="atlasStore.state.canvasHelperStrokePx"
          @change="onStrokePxChange"
        />
      </label>
      <label class="tool-item">
        网格步长 (px)
        <input
          type="number"
          class="tool-num"
          min="8"
          max="512"
          step="8"
          :value="atlasStore.state.canvasHelperGridStep"
          @change="onGridStepChange"
        />
      </label>
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
        <canvas
          ref="canvasRef"
          class="cv"
          @pointerdown="onCanvasPointerDown"
        />
      </div>
    </div>
    <div v-if="sheetCount > 0" class="legend-bar">
      <span v-if="atlasStore.state.canvasHelperShowGrid" class="leg">
        <span class="sw s-grid" aria-hidden="true" />灰虚线：辅助网格
      </span>
      <span v-if="atlasStore.state.canvasHelperShowMaxBounds" class="leg">
        <span class="sw s-max" aria-hidden="true" />紫长虚线：单张上限 W×H
      </span>
      <span v-if="atlasStore.state.canvasHelperShowOutputBounds" class="leg">
        <span class="sw s-out" aria-hidden="true" />橙虚线：当前页实际输出
      </span>
      <span v-if="atlasStore.state.canvasHelperShowSpriteBounds" class="leg">
        <span class="sw s-sprite" aria-hidden="true" />青线：图块边界
      </span>
      <span class="leg leg-sel">
        <span class="sw s-sel" aria-hidden="true" />金线：选中对象（非辅助线）
      </span>
      <span
        v-if="
          !atlasStore.state.canvasHelperShowGrid &&
          !atlasStore.state.canvasHelperShowMaxBounds &&
          !atlasStore.state.canvasHelperShowOutputBounds &&
          !atlasStore.state.canvasHelperShowSpriteBounds
        "
        class="leg-off"
        >未开启任何辅助线；透明区为未占用像素</span
      >
    </div>
    <div class="hint-short">单击选中 · 列表双击将图块置于画布区中心 · 中键 / 空格+左键平移 · 滚轮缩放</div>
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
.canvas-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  padding: 4px 8px 6px;
  background: linear-gradient(180deg, #e4e4e4 0%, #d6d6d6 100%);
  border-bottom: 1px solid #a8a8a8;
  font-size: 11px;
}
.tools-group-label {
  font-weight: 600;
  color: #333;
  margin-right: -4px;
}
.tool-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}
.tool-num {
  width: 56px;
  height: 20px;
  font: inherit;
  font-size: 11px;
  padding: 0 4px;
  border: 1px solid #707070;
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
  image-rendering: auto;
  box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.25);
  border: 1px solid var(--win-border-dark);
  vertical-align: top;
  cursor: default;
}
.legend-bar {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  padding: 5px 8px 6px;
  font-size: 10px;
  color: #333;
  background: linear-gradient(180deg, #ececec 0%, #dadada 100%);
  border-top: 1px solid #a0a0a0;
}
.leg {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.leg-off {
  color: #555;
}
.sw {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 1px solid #444;
  flex-shrink: 0;
  box-sizing: border-box;
}
.s-grid {
  background: repeating-linear-gradient(
    -45deg,
    #9a9aaa,
    #9a9aaa 2px,
    #c8c8d4 2px 4px
  );
}
.s-max {
  background: #a855f7;
}
.s-out {
  background: #ff9f1a;
}
.s-sprite {
  background: linear-gradient(135deg, #00e5ff 45%, #1a1a1e 45%);
}
.s-sel {
  background: #ffd700;
}
.hint-short {
  flex-shrink: 0;
  padding: 2px 8px 4px;
  font-size: 10px;
  color: #555;
  background: #cfcfcf;
  border-top: 1px solid #b0b0b0;
}
</style>
