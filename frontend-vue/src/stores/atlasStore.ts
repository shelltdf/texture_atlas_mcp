import { computed, reactive } from 'vue'
import {
  type PackAlgorithmId,
  type PackResult,
  clampAtlasDimension,
  clampBounds,
  DEFAULT_MAX_ATLAS_EDGE,
  packWithAlgorithmSheets,
} from '../lib/packing'
import {
  buildManifest,
  canvasToPngBlob,
  splitAtlasToDownloads,
  triggerDownloadText,
  triggerDownloadBlob,
} from '../lib/atlasIo'
import { parseManifestJson } from '../lib/manifest'

export interface AtlasImageEntry {
  id: string
  name: string
  width: number
  height: number
  objectUrl: string
  thumbDataUrl: string
  img: HTMLImageElement
}

function makeThumb(img: HTMLImageElement, max = 56): string {
  const c = document.createElement('canvas')
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  const scale = Math.min(max / iw, max / ih, 1)
  c.width = Math.max(1, Math.round(iw * scale))
  c.height = Math.max(1, Math.round(ih * scale))
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/png')
}

async function fileToEntry(file: File): Promise<AtlasImageEntry> {
  const objectUrl = URL.createObjectURL(file)
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error(`无法加载: ${file.name}`))
    img.src = objectUrl
  })
  const thumbDataUrl = makeThumb(img)
  return {
    id: crypto.randomUUID(),
    name: file.name,
    width: img.naturalWidth,
    height: img.naturalHeight,
    objectUrl,
    thumbDataUrl,
    img,
  }
}

const state = reactive({
  images: [] as AtlasImageEntry[],
  selectedId: null as string | null,
  algorithm: 'rows' as PackAlgorithmId,
  /** 单张图集允许的最大宽、高（独立），用户可改 */
  maxAtlasWidth: DEFAULT_MAX_ATLAS_EDGE,
  maxAtlasHeight: DEFAULT_MAX_ATLAS_EDGE,
  /** 画布：各类辅助线独立开关（选中金框不属辅助线，始终可按选中状态绘制） */
  canvasHelperShowGrid: true,
  canvasHelperShowMaxBounds: true,
  canvasHelperShowOutputBounds: true,
  canvasHelperShowSpriteBounds: true,
  /** 画布：辅助线线宽（纹理像素），最小 1；随单张上限 max(W,H) 变更时自动设为 round(max/256) 与 1 取大 */
  canvasHelperStrokePx: Math.max(1, Math.round(DEFAULT_MAX_ATLAS_EDGE / 256)),
  /** 画布：辅助网格步长（纹理像素） */
  canvasHelperGridStep: 64,
  packSheets: [] as PackResult[],
  activeSheetIndex: 0,
  packError: '' as string,
  statusMessage: '就绪',
  /** 双击列表：画布将尝试居中到该图（由 CanvasArea 消费） */
  canvasRecenterTick: 0,
  canvasRecenterImageId: null as string | null,
})

const idToEntry = computed(() => {
  const m = new Map<string, AtlasImageEntry>()
  for (const e of state.images) m.set(e.id, e)
  return m
})

function getCurrentPack(): PackResult | null {
  const sh = state.packSheets
  if (!sh.length) return null
  const i = Math.min(Math.max(0, state.activeSheetIndex), sh.length - 1)
  return sh[i] ?? null
}

function clearPacks() {
  state.packSheets = []
  state.activeSheetIndex = 0
}

function setStatus(msg: string) {
  state.statusMessage = msg
}

/** 与单张最大宽/高联动：辅助线线宽（px）= max(W,H)/256，至少 1 */
function syncCanvasHelperStrokeFromMaxBounds() {
  const mx = Math.max(state.maxAtlasWidth, state.maxAtlasHeight)
  state.canvasHelperStrokePx = Math.max(1, Math.round(mx / 256))
}

function addFiles(files: FileList | File[]) {
  const arr = Array.from(files).filter((f) => f.type.startsWith('image/'))
  if (arr.length === 0) {
    setStatus('未选择有效图片')
    return
  }
  void (async () => {
    for (const f of arr) {
      try {
        const e = await fileToEntry(f)
        state.images.push(e)
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err))
      }
    }
    setStatus(`已导入 ${state.images.length} 张图片`)
  })()
}

function select(id: string | null) {
  state.selectedId = id
}

function removeSelected() {
  if (!state.selectedId) return
  removeImage(state.selectedId)
}

function removeImage(id: string) {
  const i = state.images.findIndex((x) => x.id === id)
  if (i < 0) return
  const [removed] = state.images.splice(i, 1)
  URL.revokeObjectURL(removed.objectUrl)
  if (state.selectedId === id) state.selectedId = null
  clearPacks()
  setStatus('已删除图片')
}

function clearAll() {
  for (const e of state.images) URL.revokeObjectURL(e.objectUrl)
  state.images = []
  state.selectedId = null
  clearPacks()
  setStatus('已清空列表')
}

function runPack() {
  state.packError = ''
  clearPacks()
  if (state.images.length === 0) {
    state.packError = '请先导入图片'
    setStatus(state.packError)
    return
  }
  try {
    const items = state.images.map((e) => ({ id: e.id, w: e.width, h: e.height }))
    const w0 = state.maxAtlasWidth
    const h0 = state.maxAtlasHeight
    const b = clampBounds(w0, h0)
    state.maxAtlasWidth = b.maxW
    state.maxAtlasHeight = b.maxH
    if (b.maxW !== w0 || b.maxH !== h0) {
      syncCanvasHelperStrokeFromMaxBounds()
    }
    const sheets = packWithAlgorithmSheets(state.algorithm, items, b)
    state.packSheets = sheets
    state.activeSheetIndex = 0
    const cur = getCurrentPack()
    const dim = cur ? `${cur.width}×${cur.height}` : '—'
    setStatus(
      `打包完成：共 ${sheets.length} 张图集，当前页码 ${state.activeSheetIndex} · ${dim}（${state.algorithm}，单张上限 ${b.maxW}×${b.maxH}）`,
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    state.packError = msg
    setStatus(msg)
  }
}

function renderSheetCanvas(pack: PackResult): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = pack.width
  c.height = pack.height
  const ctx = c.getContext('2d', { alpha: true })
  if (!ctx) throw new Error('Canvas 不可用')
  ctx.clearRect(0, 0, c.width, c.height)
  for (const p of pack.placements) {
    const entry = idToEntry.value.get(p.id)
    if (!entry) continue
    ctx.drawImage(entry.img, 0, 0, entry.width, entry.height, p.x, p.y, p.w, p.h)
  }
  return c
}

async function exportPublish() {
  try {
    const sheets = state.packSheets
    if (!sheets.length) throw new Error('请先成功运行打包')
    const pad2 = (n: number) => String(n).padStart(2, '0')
    for (let i = 0; i < sheets.length; i++) {
      const pack = sheets[i]
      const canvas = renderSheetCanvas(pack)
      const sprites = pack.placements.map((p) => {
        const e = idToEntry.value.get(p.id)
        return {
          id: p.id,
          name: e?.name ?? p.id,
          x: p.x,
          y: p.y,
          w: p.w,
          h: p.h,
        }
      })
      const manifest = buildManifest(pack.width, pack.height, sprites)
      const json = JSON.stringify(manifest, null, 2)
      const suffix = sheets.length > 1 ? `-${pad2(i)}` : ''
      triggerDownloadText(json, `atlas${suffix}.json`)
      const blob = await canvasToPngBlob(canvas)
      triggerDownloadBlob(blob, `atlas${suffix}.png`)
      if (i < sheets.length - 1) {
        await new Promise((r) => setTimeout(r, 280))
      }
    }
    setStatus(
      sheets.length > 1
        ? `已下载 ${sheets.length} 组 atlas-00.json / png 起（页码从 0）`
        : '已下载 atlas.json 与 atlas.png',
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    setStatus(msg)
  }
}

async function reverseFromFiles(jsonFile: File, pngFile: File) {
  const text = await jsonFile.text()
  const manifest = parseManifestJson(text)
  const url = URL.createObjectURL(pngFile)
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('无法加载图集 PNG'))
    img.src = url
  })
  try {
    await splitAtlasToDownloads(img, manifest)
    setStatus(`已按清单拆分 ${manifest.sprites.length} 张`)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export const atlasStore = {
  state,
  getCurrentPack,
  addFiles,
  select,
  removeSelected,
  removeImage,
  clearAll,
  runPack,
  exportPublish,
  reverseFromFiles,
  setAlgorithm(id: PackAlgorithmId) {
    state.algorithm = id
  },
  setMaxAtlasWidth(raw: number) {
    const next = clampAtlasDimension(raw)
    if (next === state.maxAtlasWidth) return
    state.maxAtlasWidth = next
    syncCanvasHelperStrokeFromMaxBounds()
  },
  setMaxAtlasHeight(raw: number) {
    const next = clampAtlasDimension(raw)
    if (next === state.maxAtlasHeight) return
    state.maxAtlasHeight = next
    syncCanvasHelperStrokeFromMaxBounds()
  },
  setCanvasHelperShowGrid(v: boolean) {
    state.canvasHelperShowGrid = v
  },
  setCanvasHelperShowMaxBounds(v: boolean) {
    state.canvasHelperShowMaxBounds = v
  },
  setCanvasHelperShowOutputBounds(v: boolean) {
    state.canvasHelperShowOutputBounds = v
  },
  setCanvasHelperShowSpriteBounds(v: boolean) {
    state.canvasHelperShowSpriteBounds = v
  },
  setCanvasHelperStrokePx(raw: number) {
    const v = Math.round(Number(raw))
    if (!Number.isFinite(v)) return
    state.canvasHelperStrokePx = Math.min(128, Math.max(1, v))
  },
  setCanvasHelperGridStep(raw: number) {
    const v = Math.floor(Number(raw))
    if (!Number.isFinite(v)) return
    state.canvasHelperGridStep = Math.min(512, Math.max(8, v))
  },
  setActiveSheetIndex(i: number) {
    const n = state.packSheets.length
    if (n === 0) return
    state.activeSheetIndex = Math.min(Math.max(0, Math.floor(i)), n - 1)
  },
  requestCanvasRecenterOnImage(id: string) {
    state.canvasRecenterImageId = id
    state.canvasRecenterTick++
  },
  clearCanvasRecenterRequest() {
    state.canvasRecenterImageId = null
  },
}
