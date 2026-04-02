<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PackResult, Placement } from '../lib/packing'
import type {
  AtlasImageEntry,
  CanvasHelperChannelMode,
  CanvasInterpolationMode,
} from '../stores/atlasStore'
import { atlasStore } from '../stores/atlasStore'
import { i18n } from '../i18n'
import AtlasHelpersSvg, {
  type AtlasHelpersSpec,
  type OverlayBlock,
} from './AtlasHelpersSvg.vue'

const { t, locale } = useI18n()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const viewportRef = ref<HTMLElement | null>(null)

const scale = ref(1)
const tx = ref(0)
const ty = ref(0)
const isPanning = ref(false)
const spaceDown = ref(false)

/** 多页时：单页预览 / 全部总览（竖向总排版） */
const overviewMode = ref(false)

/** 单页预览：鼠标悬停的图集像素坐标与颜色（总览模式关闭） */
const hoverAtlas = ref<{ x: number; y: number } | null>(null)
const hoverRgba = ref<{ r: number; g: number; b: number; a: number } | null>(null)
let hoverRedrawRaf = 0

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

/** drawImage 是否在缩放采样时使用平滑（仅当源与目标尺寸不一致时才有视觉效果；1:1 贴图时无差异） */
function resolveImageSmoothing(mode: CanvasInterpolationMode, viewScale: number): boolean {
  if (mode === 'nearest') return false
  if (mode === 'smooth') return true
  return viewScale < 1
}

/** 画布元素是否使用像素化缩放（CSS） */
function resolveCanvasCrispClass(mode: CanvasInterpolationMode, viewScale: number): boolean {
  if (mode === 'nearest') return true
  if (mode === 'smooth') return false
  return viewScale >= 1
}

/**
 * 预览画布四边留白（纹理像素），**与当前线宽无关**。
 * 若随线宽变化，内容会从 (bleed, bleed) 起画，改线宽时图集在画布上会看起来「平移」；
 * 实际打包/导出坐标不变。此处按线宽上限预留固定值，避免该错觉。
 */
const PREVIEW_ATLAS_BLEED = Math.ceil(128 / 2) + 2

interface SheetSpriteOpts {
  maxW: number
  maxH: number
  bleed: number
  viewScale: number
  interpolation: CanvasInterpolationMode
  channel: CanvasHelperChannelMode
}

/** 单精灵按通道绘制用离屏画布（复用，避免每帧分配） */
let channelScratch: HTMLCanvasElement | null = null

function ensureChannelScratch(w: number, h: number): HTMLCanvasElement {
  if (!channelScratch) channelScratch = document.createElement('canvas')
  if (channelScratch.width < w) channelScratch.width = w
  if (channelScratch.height < h) channelScratch.height = h
  return channelScratch
}

/**
 * 将精灵某一通道显示为灰度：R/G/B 保留原 alpha；A 为灰度且不透明（便于观察透明区）。
 */
function drawSpriteChannel(
  ctx: CanvasRenderingContext2D,
  entry: AtlasImageEntry,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  channel: Exclude<CanvasHelperChannelMode, 'rgba'>,
) {
  const iw = entry.width
  const ih = entry.height
  if (iw < 1 || ih < 1) return
  const scratch = ensureChannelScratch(iw, ih)
  const sctx = scratch.getContext('2d', { willReadFrequently: true })
  if (!sctx) {
    ctx.drawImage(entry.img, 0, 0, iw, ih, dx, dy, dw, dh)
    return
  }
  sctx.setTransform(1, 0, 0, 1, 0, 0)
  sctx.clearRect(0, 0, iw, ih)
  sctx.drawImage(entry.img, 0, 0)
  let imgData: ImageData
  try {
    imgData = sctx.getImageData(0, 0, iw, ih)
  } catch {
    ctx.drawImage(entry.img, 0, 0, iw, ih, dx, dy, dw, dh)
    return
  }
  const d = imgData.data
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]
    const g = d[i + 1]
    const b = d[i + 2]
    const a = d[i + 3]
    let v = 0
    if (channel === 'r') v = r
    else if (channel === 'g') v = g
    else if (channel === 'b') v = b
    else v = a
    d[i] = v
    d[i + 1] = v
    d[i + 2] = v
    d[i + 3] = channel === 'a' ? 255 : a
  }
  sctx.putImageData(imgData, 0, 0)
  ctx.drawImage(scratch, 0, 0, iw, ih, dx, dy, dw, dh)
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

/** 仅绘制精灵位图；辅助线由 AtlasHelpersSvg 矢量叠加 */
function drawSheetSpritesOnly(
  ctx: CanvasRenderingContext2D,
  pack: PackResult,
  ox: number,
  oy: number,
  map: Map<string, AtlasImageEntry>,
  opts: SheetSpriteOpts,
) {
  const { maxW, maxH, bleed, viewScale: vs, interpolation } = opts
  const logicW = Math.max(pack.width, maxW) + 1
  const logicH = Math.max(pack.height, maxH) + 1
  const ox0 = ox + bleed
  const oy0 = oy + bleed
  const totalW = logicW + 2 * bleed
  const totalH = logicH + 2 * bleed
  ctx.clearRect(ox, oy, totalW, totalH)

  const useSmooth = resolveImageSmoothing(interpolation, Math.max(1e-6, vs))
  ctx.imageSmoothingEnabled = useSmooth
  if (useSmooth) {
    ctx.imageSmoothingQuality = 'high'
  }
  const ch = opts.channel
  for (const p of pack.placements) {
    const entry = map.get(p.id)
    if (!entry) continue
    const x = ox0 + p.x
    const y = oy0 + p.y
    if (ch === 'rgba') {
      ctx.drawImage(entry.img, 0, 0, entry.width, entry.height, x, y, p.w, p.h)
    } else {
      drawSpriteChannel(ctx, entry, x, y, p.w, p.h, ch)
    }
  }
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#2d2d32'
  ctx.fillRect(0, 0, w, h)
  const text = i18n.global.t('canvas.placeholder')
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#c8c8d4'
  let fontSize = Math.round(Math.max(16, Math.min(w, h) * 0.05))
  const fontFamily = '"Segoe UI", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif'
  ctx.font = `500 ${fontSize}px ${fontFamily}`
  const pad = 40
  while (fontSize >= 12 && ctx.measureText(text).width > w - pad) {
    fontSize -= 1
    ctx.font = `500 ${fontSize}px ${fontFamily}`
  }
  ctx.imageSmoothingEnabled = true
  ctx.fillText(text, w / 2, h / 2)
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
  const bleed = PREVIEW_ATLAS_BLEED
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
      i18n.global.t('canvas.overviewRowLabel', {
        index: b.index,
        w: b.pack.width,
        h: b.pack.height,
      }),
      PAD_X,
      b.labelY + Math.round(LABEL_H * 0.72),
    )
    drawSheetSpritesOnly(ctx, b.pack, b.ox, b.oy, map, {
      maxW: atlasStore.state.maxAtlasWidth,
      maxH: atlasStore.state.maxAtlasHeight,
      bleed,
      viewScale: scale.value,
      interpolation: atlasStore.state.canvasInterpolation,
      channel: atlasStore.state.canvasHelperChannel,
    })
  }
}

function redrawSingle(el: HTMLCanvasElement, ctx: CanvasRenderingContext2D, pack: PackResult) {
  const map = new Map(atlasStore.state.images.map((e) => [e.id, e]))
  const limW = atlasStore.state.maxAtlasWidth
  const limH = atlasStore.state.maxAtlasHeight
  const bleed = PREVIEW_ATLAS_BLEED
  const logicW = Math.max(pack.width, limW) + 1
  const logicH = Math.max(pack.height, limH) + 1
  el.width = logicW + 2 * bleed
  el.height = logicH + 2 * bleed
  drawSheetSpritesOnly(ctx, pack, 0, 0, map, {
    maxW: atlasStore.state.maxAtlasWidth,
    maxH: atlasStore.state.maxAtlasHeight,
    bleed,
    viewScale: scale.value,
    interpolation: atlasStore.state.canvasInterpolation,
    channel: atlasStore.state.canvasHelperChannel,
  })
}

function redraw() {
  overviewHitCache.value = null
  const el = canvasRef.value
  if (!el) return
  const ctx = el.getContext('2d', { alpha: true, willReadFrequently: true })
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
  tx.value = Math.round((vp.clientWidth - cw * s) / 2)
  ty.value = Math.round((vp.clientHeight - ch * s) / 2)
}

function clientToCanvas(vpLocalX: number, vpLocalY: number): { cx: number; cy: number } {
  return {
    cx: (vpLocalX - tx.value) / scale.value,
    cy: (vpLocalY - ty.value) / scale.value,
  }
}

function scheduleHoverRedraw() {
  if (hoverRedrawRaf) return
  hoverRedrawRaf = requestAnimationFrame(() => {
    hoverRedrawRaf = 0
    redraw()
  })
}

/** 单页预览：更新悬停像素与颜色，并重绘高亮格（总览模式清空） */
function updateHoverFromPointer(vpLocalX: number, vpLocalY: number) {
  if (isPanning.value) return
  if (sheetCount.value === 0) return
  if (overviewMode.value) {
    if (hoverAtlas.value !== null || hoverRgba.value !== null) {
      hoverAtlas.value = null
      hoverRgba.value = null
      scheduleHoverRedraw()
    }
    return
  }
  const pack = atlasStore.getCurrentPack()
  const el = canvasRef.value
  if (!pack || !el) return
  const pt = clientToCanvas(vpLocalX, vpLocalY)
  const bleed = PREVIEW_ATLAS_BLEED
  const lx = pt.cx - bleed
  const ly = pt.cy - bleed
  const ix = Math.floor(lx)
  const iy = Math.floor(ly)
  if (ix < 0 || iy < 0 || ix >= pack.width || iy >= pack.height) {
    if (hoverAtlas.value !== null || hoverRgba.value !== null) {
      hoverAtlas.value = null
      hoverRgba.value = null
      scheduleHoverRedraw()
    }
    return
  }
  if (hoverAtlas.value?.x === ix && hoverAtlas.value?.y === iy) return

  const ctx = el.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  let d: Uint8ClampedArray
  try {
    d = ctx.getImageData(ix + bleed, iy + bleed, 1, 1).data
  } catch {
    return
  }
  hoverRgba.value = { r: d[0], g: d[1], b: d[2], a: d[3] }
  hoverAtlas.value = { x: ix, y: iy }
  scheduleHoverRedraw()
}

function onViewportPointerLeave() {
  if (hoverAtlas.value !== null || hoverRgba.value !== null) {
    hoverAtlas.value = null
    hoverRgba.value = null
    scheduleHoverRedraw()
  }
}

function hitTestSingle(pt: { cx: number; cy: number }): string | null {
  const pack = atlasStore.getCurrentPack()
  if (!pack) return null
  const bleed = PREVIEW_ATLAS_BLEED
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
  tx.value = Math.round(mx - wx * newScale)
  ty.value = Math.round(my - wy * newScale)
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

function onViewportCombinedPointerMove(e: PointerEvent) {
  onPointerMove(e)
  const vp = viewportRef.value
  if (!vp) return
  const rect = vp.getBoundingClientRect()
  updateHoverFromPointer(e.clientX - rect.left, e.clientY - rect.top)
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

function onToggleHelperOrigin(e: Event) {
  atlasStore.setCanvasHelperShowOrigin(readCheckbox(e))
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

function onInterpolationChange(ev: Event) {
  const v = (ev.target as HTMLSelectElement).value as CanvasInterpolationMode
  atlasStore.setCanvasInterpolation(v)
}

function onChannelChange(ev: Event) {
  const v = (ev.target as HTMLSelectElement).value as CanvasHelperChannelMode
  atlasStore.setCanvasHelperChannel(v)
}

const sheetCount = computed(() => atlasStore.state.packSheets.length)

const channelLegendText = computed(() => {
  const m = atlasStore.state.canvasHelperChannel
  if (m === 'rgba') return ''
  const keys = {
    r: 'canvas.legChannel_r',
    g: 'canvas.legChannel_g',
    b: 'canvas.legChannel_b',
    a: 'canvas.legChannel_a',
  } as const
  return t(keys[m])
})

const canvasUseCrisp = computed(() =>
  resolveCanvasCrispClass(atlasStore.state.canvasInterpolation, scale.value),
)

/** 无图集可画时占位 640×360：勿用像素化缩放，否则 fillText 会糊 */
const canvasShowsPlaceholder = computed(() => {
  const sheets = atlasStore.state.packSheets
  if (!sheets.length) return true
  const pack = atlasStore.getCurrentPack()
  return !pack || pack.placements.length === 0
})

/**
 * 视口缩放时整幅位图的插值（CSS），与 cv-crisp 一致。
 * 占位态强制 auto，避免提示文字被最近邻放大发糊。
 */
const canvasPixelScaleStyle = computed(() => {
  if (canvasShowsPlaceholder.value) {
    return { imageRendering: 'auto' as const }
  }
  return {
    imageRendering: canvasUseCrisp.value ? ('pixelated' as const) : ('auto' as const),
  }
})

/** 与画布同步：整层缩放时辅助线 SVG 与位图使用相同采样，避免一块糊一块锐 */
const helpersSvgScaleStyle = computed(() => ({
  imageRendering: canvasUseCrisp.value ? ('pixelated' as const) : ('auto' as const),
}))

/** 与画布同尺寸的 SVG 辅助线规格（矢量叠加，放大仍清晰） */
const atlasHelpersSpec = computed((): AtlasHelpersSpec | null => {
  const sheets = atlasStore.state.packSheets
  if (!sheets.length) return null
  const limW = atlasStore.state.maxAtlasWidth
  const limH = atlasStore.state.maxAtlasHeight
  const bleed = PREVIEW_ATLAS_BLEED
  const st = atlasStore.state

  if (sheets.length > 1 && overviewMode.value) {
    const maxDim = sheets.reduce(
      (acc, s) => Math.max(acc, s.width, s.height, limW, limH),
      400,
    )
    const mul = clamp(maxDim / 400, 1.25, 6.5)
    const layout = layoutOverview(sheets, mul, limW, limH, bleed)
    const blocks: OverlayBlock[] = layout.blocks.map((b) => ({
      ox: b.ox,
      oy: b.oy,
      bleed,
      logicW: Math.max(b.pack.width, limW) + 1,
      logicH: Math.max(b.pack.height, limH) + 1,
      pack: b.pack,
    }))
    return {
      width: layout.cw,
      height: layout.ch,
      blocks,
      maxW: limW,
      maxH: limH,
      showGrid: st.canvasHelperShowGrid,
      showMaxBounds: st.canvasHelperShowMaxBounds,
      showOutputBounds: st.canvasHelperShowOutputBounds,
      showSpriteBounds: st.canvasHelperShowSpriteBounds,
      showOrigin: st.canvasHelperShowOrigin,
      helperStrokePx: st.canvasHelperStrokePx,
      helperGridStep: st.canvasHelperGridStep,
      selectedId: st.selectedId,
      hoverPixel: null,
      viewScale: scale.value,
    }
  }

  const pack = atlasStore.getCurrentPack()
  if (!pack?.placements.length) return null
  const logicW = Math.max(pack.width, limW) + 1
  const logicH = Math.max(pack.height, limH) + 1
  return {
    width: logicW + 2 * bleed,
    height: logicH + 2 * bleed,
    blocks: [
      {
        ox: 0,
        oy: 0,
        bleed,
        logicW,
        logicH,
        pack,
      },
    ],
    maxW: limW,
    maxH: limH,
    showGrid: st.canvasHelperShowGrid,
    showMaxBounds: st.canvasHelperShowMaxBounds,
    showOutputBounds: st.canvasHelperShowOutputBounds,
    showSpriteBounds: st.canvasHelperShowSpriteBounds,
    showOrigin: st.canvasHelperShowOrigin,
    helperStrokePx: st.canvasHelperStrokePx,
    helperGridStep: st.canvasHelperGridStep,
    selectedId: st.selectedId,
    hoverPixel: overviewMode.value ? null : hoverAtlas.value,
    viewScale: scale.value,
  }
})

const canvasSubtitle = computed(() => {
  const n = sheetCount.value
  if (n === 0) return t('canvas.noPreview')
  if (n > 1 && overviewMode.value) {
    const limW = atlasStore.state.maxAtlasWidth
    const limH = atlasStore.state.maxAtlasHeight
    const maxDim = atlasStore.state.packSheets.reduce(
      (acc, s) => Math.max(acc, s.width, s.height, limW, limH),
      400,
    )
    const mul = clamp(maxDim / 400, 1.25, 6.5)
    const bleed = PREVIEW_ATLAS_BLEED
    const { cw, ch } = layoutOverview(atlasStore.state.packSheets, mul, limW, limH, bleed)
    return t('canvas.overviewSummary', { cw, ch, n, last: n - 1 })
  }
  const sheets = atlasStore.state.packSheets
  const i = Math.min(Math.max(0, atlasStore.state.activeSheetIndex), n - 1)
  const p = sheets[i]
  return t('canvas.sheetStatsOnly', {
    w: p.width,
    h: p.height,
    mw: atlasStore.state.maxAtlasWidth,
    mh: atlasStore.state.maxAtlasHeight,
  })
})

/** 多页单页预览时，置于上一页/下一页之间的页码（0 起） */
const pageNavLabel = computed(() => {
  const n = sheetCount.value
  if (n <= 1) return ''
  const i = Math.min(Math.max(0, atlasStore.state.activeSheetIndex), n - 1)
  return t('canvas.pageNavLabel', { i, n })
})

const pixelHudVisible = computed(
  () =>
    sheetCount.value > 0 &&
    !overviewMode.value &&
    hoverAtlas.value !== null &&
    hoverRgba.value !== null,
)

const pixelHudLine = computed(() => {
  const h = hoverAtlas.value
  const c = hoverRgba.value
  if (!h || !c) return ''
  const a = c.a / 255
  return t('canvas.pixelHud', {
    x: h.x,
    y: h.y,
    r: c.r,
    g: c.g,
    b: c.b,
    a: a.toFixed(3),
    format: 'RGBA8',
  })
})

/** HUD 左侧：仅 RGB 的实色块（不含透明度） */
const pixelHudRgbSwatchStyle = computed(() => {
  const c = hoverRgba.value
  if (!c) return {}
  return { backgroundColor: `rgb(${c.r}, ${c.g}, ${c.b})` }
})

/** HUD：与 RGB 块等大，灰度表示 Alpha（黑=0，白=255） */
const pixelHudAlphaSwatchStyle = computed(() => {
  const c = hoverRgba.value
  if (!c) return {}
  const g = c.a
  return { backgroundColor: `rgb(${g}, ${g}, ${g})` }
})

/** 与滚轮一致：每次 ×1.12 / ÷1.12 */
const ZOOM_STEP = 1.12

/** 以视口中心为锚缩放，避免只改 scale 时画面跳变 */
function zoomAtViewportCenter(nextScale: number) {
  const vp = viewportRef.value
  if (!vp) return
  const s = clamp(nextScale, 0.05, 16)
  const cx = vp.clientWidth / 2
  const cy = vp.clientHeight / 2
  const wx = (cx - tx.value) / scale.value
  const wy = (cy - ty.value) / scale.value
  tx.value = Math.round(cx - wx * s)
  ty.value = Math.round(cy - wy * s)
  scale.value = s
}

function onZoomIn() {
  zoomAtViewportCenter(scale.value * ZOOM_STEP)
}

function onZoomOut() {
  zoomAtViewportCenter(scale.value / ZOOM_STEP)
}

/** 纹理像素与屏幕 1:1 */
function onZoomOneToOne() {
  zoomAtViewportCenter(1)
}

function onZoomFit() {
  fitToViewport()
}

/** 左下角缩放读数：百分比，必要时保留一位小数 */
const zoomPercentText = computed(() => {
  const p = scale.value * 100
  const rounded = Math.round(p * 10) / 10
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) return `${Math.round(rounded)}%`
  return `${rounded.toFixed(1)}%`
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

watch(scale, () => {
  redraw()
})

watch(overviewMode, (ov) => {
  if (ov) {
    hoverAtlas.value = null
    hoverRgba.value = null
  }
})

watch(
  () => atlasStore.state.packSheets,
  () => {
    hoverAtlas.value = null
    hoverRgba.value = null
  },
)

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
    atlasStore.state.maxAtlasWidth,
    atlasStore.state.maxAtlasHeight,
    atlasStore.state.canvasInterpolation,
    atlasStore.state.canvasHelperChannel,
  ],
  () => {
    redraw()
  },
)

watch(locale, () => {
  redraw()
  nextTick(() => fitToViewport())
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

/**
 * 棋盘格：2×2 **纹理像素** 为一格，与画布/图集像素 1:1（随 pan-layer 缩放即「内部像素比例」）。
 * 仅铺在「单张上限」紫框 **内侧**（与 AtlasHelpersSvg 紫框描边内侧一致），不铺满整张画布留白区。
 */
const CHECKER_TEXTURE_PX = 2

/** 与 SVG 紫框（max bounds）内侧对齐的棋盘区域 */
interface CheckerMaxRegion {
  left: number
  top: number
  width: number
  height: number
}

const checkerMaxRegions = computed((): CheckerMaxRegion[] => {
  const sheets = atlasStore.state.packSheets
  if (!sheets.length) return []
  const limW = atlasStore.state.maxAtlasWidth
  const limH = atlasStore.state.maxAtlasHeight
  const bleed = PREVIEW_ATLAS_BLEED
  const s = Math.max(1, atlasStore.state.canvasHelperStrokePx)
  const iw = Math.max(1, limW - 2 * s)
  const ih = Math.max(1, limH - 2 * s)
  const innerLeft = bleed + s
  const innerTop = bleed + s

  if (sheets.length > 1 && overviewMode.value) {
    const maxDim = sheets.reduce(
      (acc, x) => Math.max(acc, x.width, x.height, limW, limH),
      400,
    )
    const mul = clamp(maxDim / 400, 1.25, 6.5)
    const layout = layoutOverview(sheets, mul, limW, limH, bleed)
    return layout.blocks.map((b) => ({
      left: b.ox + innerLeft,
      top: b.oy + innerTop,
      width: iw,
      height: ih,
    }))
  }

  const pack = atlasStore.getCurrentPack()
  if (!pack?.placements.length) return []

  return [{ left: innerLeft, top: innerTop, width: iw, height: ih }]
})

function checkerRegionStyle(r: CheckerMaxRegion): Record<string, string> {
  const bleed = PREVIEW_ATLAS_BLEED
  const c = CHECKER_TEXTURE_PX
  return {
    position: 'absolute',
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    boxSizing: 'border-box',
    pointerEvents: 'none',
    zIndex: '0',
    backgroundImage:
      'repeating-conic-gradient(#bdbdbd 0% 25%, #d0d0d0 0% 50%)',
    backgroundSize: `${c}px ${c}px`,
    backgroundPosition: `-${bleed + r.left}px -${bleed + r.top}px`,
    backgroundRepeat: 'repeat',
  }
}

const panLayerStyle = computed(() => ({
  transform: `translate(${tx.value}px, ${ty.value}px) scale(${scale.value})`,
  transformOrigin: '0 0',
}))

</script>

<template>
  <div class="canvas-shell win-inset">
    <div class="canvas-title-bar win-panel-title">
      <div class="title-text-block">
        <span class="title-strong">{{ t('canvas.title') }}</span>
        <span class="title-sub">{{ canvasSubtitle }}</span>
      </div>
      <div class="title-actions" v-if="sheetCount > 0">
        <template v-if="sheetCount > 1">
          <button
            type="button"
            class="title-btn"
            :class="{ active: overviewMode }"
            :title="t('canvas.overviewToggleTitle')"
            @click="toggleOverview"
          >
            {{ overviewMode ? t('canvas.singlePage') : t('canvas.overview') }}
          </button>
          <template v-if="!overviewMode">
            <button type="button" class="title-btn icon" :title="t('canvas.prevPage')" @click="prevPage">
              ◀
            </button>
            <span class="title-page-nav" aria-live="polite">{{ pageNavLabel }}</span>
            <button type="button" class="title-btn icon" :title="t('canvas.nextPage')" @click="nextPage">
              ▶
            </button>
          </template>
        </template>
      </div>
    </div>
    <div v-if="sheetCount > 0" class="canvas-tools">
      <span class="tools-group-label">{{ t('canvas.helpers') }}</span>
      <label class="tool-item">
        <input
          type="checkbox"
          :checked="atlasStore.state.canvasHelperShowGrid"
          @change="onToggleHelperGrid"
        />
        {{ t('canvas.grid') }}
      </label>
      <label class="tool-item">
        <input
          type="checkbox"
          :checked="atlasStore.state.canvasHelperShowMaxBounds"
          @change="onToggleHelperMaxBounds"
        />
        {{ t('canvas.maxBounds') }}
      </label>
      <label class="tool-item">
        <input
          type="checkbox"
          :checked="atlasStore.state.canvasHelperShowOutputBounds"
          @change="onToggleHelperOutputBounds"
        />
        {{ t('canvas.outputBounds') }}
      </label>
      <label class="tool-item">
        <input
          type="checkbox"
          :checked="atlasStore.state.canvasHelperShowSpriteBounds"
          @change="onToggleHelperSpriteBounds"
        />
        {{ t('canvas.spriteBounds') }}
      </label>
      <label class="tool-item">
        <input
          type="checkbox"
          :checked="atlasStore.state.canvasHelperShowOrigin"
          @change="onToggleHelperOrigin"
        />
        {{ t('canvas.origin') }}
      </label>
      <label class="tool-item">
        {{ t('canvas.strokePx') }}
        <input
          type="number"
          class="tool-num"
          min="1"
          max="128"
          step="1"
          :title="t('canvas.strokeTitle')"
          :value="atlasStore.state.canvasHelperStrokePx"
          @change="onStrokePxChange"
        />
      </label>
      <label class="tool-item">
        {{ t('canvas.gridStep') }}
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
      <label class="tool-item tool-interpolation">
        <span class="tool-label-text">{{ t('canvas.interpolation') }}</span>
        <select
          class="tool-select win-select"
          :value="atlasStore.state.canvasInterpolation"
          :title="t('canvas.interpolationTitle')"
          @change="onInterpolationChange"
        >
          <option value="auto">{{ t('canvas.interpolationAuto') }}</option>
          <option value="nearest">{{ t('canvas.interpolationNearest') }}</option>
          <option value="smooth">{{ t('canvas.interpolationSmooth') }}</option>
        </select>
      </label>
      <label class="tool-item tool-channel">
        <span class="tool-label-text">{{ t('canvas.channel') }}</span>
        <select
          class="tool-select win-select"
          :value="atlasStore.state.canvasHelperChannel"
          :title="t('canvas.channelTitle')"
          @change="onChannelChange"
        >
          <option value="rgba">{{ t('canvas.channelRgba') }}</option>
          <option value="r">{{ t('canvas.channelR') }}</option>
          <option value="g">{{ t('canvas.channelG') }}</option>
          <option value="b">{{ t('canvas.channelB') }}</option>
          <option value="a">{{ t('canvas.channelA') }}</option>
        </select>
      </label>
    </div>
    <div
      ref="viewportRef"
      class="viewport"
      :class="{ panning: isPanning, 'space-pan': spaceDown }"
      @wheel="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onViewportCombinedPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @pointerleave="onViewportPointerLeave"
      @contextmenu.prevent
    >
      <div class="pan-layer" :style="panLayerStyle">
        <div
          v-for="(cr, ci) in checkerMaxRegions"
          :key="'chk-' + ci"
          class="checker-max-inner"
          :style="checkerRegionStyle(cr)"
          aria-hidden="true"
        />
        <canvas
          ref="canvasRef"
          class="cv"
          :class="{ 'cv-crisp': canvasUseCrisp && !canvasShowsPlaceholder }"
          :style="canvasPixelScaleStyle"
          @pointerdown="onCanvasPointerDown"
        />
        <AtlasHelpersSvg
          v-if="atlasHelpersSpec"
          :spec="atlasHelpersSpec"
          :style="helpersSvgScaleStyle"
        />
      </div>
      <div
        v-if="pixelHudVisible"
        class="pixel-hud"
        aria-live="polite"
        :aria-label="pixelHudLine"
      >
        <div class="pixel-hud-inner">
          <div class="pixel-hud-swatches" role="img" :aria-label="t('canvas.pixelHudSwatchesAria')">
            <span
              class="pixel-hud-swatch pixel-hud-swatch-rgb"
              :style="pixelHudRgbSwatchStyle"
              :title="t('canvas.pixelHudRgbTitle')"
            />
            <span
              class="pixel-hud-swatch pixel-hud-swatch-alpha"
              :style="pixelHudAlphaSwatchStyle"
              :title="t('canvas.pixelHudAlphaTitle')"
            />
          </div>
          <div class="pixel-hud-text">{{ pixelHudLine }}</div>
        </div>
      </div>
      <div v-if="sheetCount > 0" class="zoom-hud" role="toolbar" :aria-label="t('canvas.zoomToolbar')">
        <button type="button" class="zoom-btn" :title="t('canvas.zoomOutTitle')" @click="onZoomOut">
          −
        </button>
        <span class="zoom-readout" :title="t('canvas.zoomReadoutTitle')">{{ zoomPercentText }}</span>
        <button type="button" class="zoom-btn" :title="t('canvas.zoomInTitle')" @click="onZoomIn">
          +
        </button>
        <button type="button" class="zoom-btn zoom-btn-wide" :title="t('canvas.zoom100Title')" @click="onZoomOneToOne">
          1:1
        </button>
        <button type="button" class="zoom-btn zoom-btn-wide" :title="t('canvas.zoomFitTitle')" @click="onZoomFit">
          ⊡
        </button>
      </div>
    </div>
    <div v-if="sheetCount > 0" class="legend-bar">
      <span v-if="atlasStore.state.canvasHelperShowGrid" class="leg">
        <span class="sw s-grid" aria-hidden="true" />{{ t('canvas.legGrid') }}
      </span>
      <span v-if="atlasStore.state.canvasHelperShowMaxBounds" class="leg">
        <span class="sw s-max" aria-hidden="true" />{{ t('canvas.legMax') }}
      </span>
      <span v-if="atlasStore.state.canvasHelperShowOutputBounds" class="leg">
        <span class="sw s-out" aria-hidden="true" />{{ t('canvas.legOut') }}
      </span>
      <span v-if="atlasStore.state.canvasHelperShowSpriteBounds" class="leg">
        <span class="sw s-sprite" aria-hidden="true" />{{ t('canvas.legSprite') }}
      </span>
      <span class="leg leg-sel">
        <span class="sw s-sel" aria-hidden="true" />{{ t('canvas.legSel') }}
      </span>
      <span v-if="atlasStore.state.canvasHelperShowOrigin" class="leg">
        <span class="sw s-origin" aria-hidden="true" />{{ t('canvas.legOrigin') }}
      </span>
      <span v-if="atlasStore.state.canvasHelperChannel !== 'rgba'" class="leg leg-channel">
        <span class="sw s-channel" aria-hidden="true" />{{ channelLegendText }}
      </span>
      <span
        v-if="
          !atlasStore.state.canvasHelperShowGrid &&
          !atlasStore.state.canvasHelperShowMaxBounds &&
          !atlasStore.state.canvasHelperShowOutputBounds &&
          !atlasStore.state.canvasHelperShowSpriteBounds &&
          !atlasStore.state.canvasHelperShowOrigin &&
          atlasStore.state.canvasHelperChannel === 'rgba'
        "
        class="leg-off"
        >{{ t('canvas.legOff') }}</span
      >
    </div>
    <div class="hint-short">{{ t('canvas.hintShort') }}</div>
  </div>
</template>

<style scoped>
.canvas-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--win-main-canvas-bg);
  color: var(--win-text);
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
.title-page-nav {
  min-width: 2.75em;
  padding: 0 2px;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--win-text);
  line-height: 20px;
  user-select: none;
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
.tool-interpolation {
  flex-wrap: wrap;
  max-width: 100%;
}
.tool-channel {
  flex-wrap: wrap;
  max-width: 100%;
}
.tool-label-text {
  flex-shrink: 0;
}
.tool-select {
  min-width: 7.5rem;
  max-width: 100%;
  height: 20px;
  font: inherit;
  font-size: 11px;
  padding: 0 4px;
  border: 1px solid #707070;
  background: var(--win-inset-bg);
  color: var(--win-text);
}
.zoom-hud {
  position: absolute;
  left: 8px;
  bottom: 8px;
  z-index: 3;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  padding: 4px 6px;
  font-size: 11px;
  color: #111;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid #888;
  border-radius: 2px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  pointer-events: auto;
  user-select: none;
}
.zoom-readout {
  min-width: 3.25rem;
  padding: 0 4px;
  text-align: center;
  font-family: Consolas, 'Cascadia Mono', 'Segoe UI Mono', monospace;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.zoom-btn {
  font: inherit;
  font-size: 12px;
  line-height: 1;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border: 1px solid #707070;
  border-radius: 2px;
  background: linear-gradient(180deg, #fff 0%, #e8e8e8 100%);
  cursor: pointer;
  color: #111;
}
.zoom-btn:hover {
  background: linear-gradient(180deg, #f6fbff 0%, #d4e8fc 100%);
  border-color: #6ab5e7;
}
.zoom-btn-wide {
  min-width: 32px;
  font-size: 11px;
  font-weight: 600;
}
.pixel-hud {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 2;
  max-width: min(100%, 480px);
  padding: 6px 8px;
  font-size: 11px;
  font-family: Consolas, 'Cascadia Mono', 'Segoe UI Mono', monospace;
  color: #111;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid #888;
  border-radius: 2px;
  pointer-events: none;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  line-height: 1.35;
  word-break: break-all;
}
.pixel-hud-inner {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pixel-hud-swatches {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.pixel-hud-swatch {
  display: block;
  width: 14px;
  height: 14px;
  box-sizing: border-box;
  border: 1px solid #333;
  flex-shrink: 0;
}
.pixel-hud-text {
  min-width: 0;
  flex: 1;
}
.viewport {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-height: 0;
  /* 与画布外未覆盖区域；棋盘格在 .pan-layer 上与画布同变换，随平移/缩放同步 */
  background: var(--win-main-canvas-bg);
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
  /* 与视口一致底色；棋盘格仅 .checker-max-inner 铺在紫框内 */
  background: var(--win-main-canvas-bg);
  /* 不使用 will-change: transform，减轻合成层整层纹理放大时的发糊 */
}
.checker-max-inner {
  overflow: hidden;
}
/* 不再给整块画布加边框：否则会包住 bleed 留白，视觉上比紫色「单张上限」更大；边界以辅助线为准 */
/* 层级：棋盘 0 < 位图 1 < AtlasHelpersSvg 辅助线 2 */
.cv {
  position: relative;
  z-index: 1;
  display: block;
  image-rendering: auto;
  vertical-align: top;
  cursor: default;
}
.cv.cv-crisp {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
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
.s-origin {
  background: linear-gradient(135deg, #ec4899 55%, #fbcfe8 55%);
  border-color: #9d174d;
}
.s-channel {
  background: linear-gradient(90deg, #e11 0 34%, #1b1 34% 67%, #11e 67% 100%);
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
