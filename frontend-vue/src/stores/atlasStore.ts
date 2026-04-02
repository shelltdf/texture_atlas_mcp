import { computed, reactive } from 'vue'
import {
  type PackAlgorithmId,
  type PackResult,
  clampAtlasDimension,
  clampAtlasMargin,
  clampBounds,
  clampPackGap,
  DEFAULT_MAX_ATLAS_EDGE,
  packWithAlgorithmSheets,
} from '../lib/packing'
import {
  buildManifest,
  canvasToPngBlob,
  sanitizeFilename,
  splitAtlasToDownloads,
  triggerDownloadText,
  triggerDownloadBlob,
} from '../lib/atlasIo'
import { parseManifestJson } from '../lib/manifest'

/** 导出图集时可选产物组合 */
export type AtlasExportMode = 'png+json' | 'png-only' | 'json-only'

/** 图集预览：精灵缩放插值（drawImage + 画布元素 CSS） */
export type CanvasInterpolationMode = 'auto' | 'nearest' | 'smooth'

/** 画布预览：单独查看某一颜色通道（灰度）；rgba 为正常合成 */
export type CanvasHelperChannelMode = 'rgba' | 'r' | 'g' | 'b' | 'a'

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
  /** 打包：图片之间的间隙（像素） */
  packGap: 0,
  /** 打包：图集四边空边（内边距，像素） */
  atlasMargin: 0,
  /** 画布：各类辅助线独立开关（选中金框不属辅助线，始终可按选中状态绘制） */
  canvasHelperShowGrid: true,
  canvasHelperShowMaxBounds: true,
  canvasHelperShowOutputBounds: true,
  canvasHelperShowSpriteBounds: true,
  /** 画布：显示纹理原点 (0,0) 与第一个像素格 */
  canvasHelperShowOrigin: true,
  /** 画布：辅助线线宽（纹理像素），最小 1（与选中框无关；选中框为屏幕空间宽度） */
  canvasHelperStrokePx: 1,
  /** 画布：辅助网格步长（纹理像素） */
  canvasHelperGridStep: 64,
  /** 画布：图集精灵插值 — auto：缩小时平滑、放大≥1 最近邻；nearest/smooth：强制 */
  canvasInterpolation: 'nearest' as CanvasInterpolationMode,
  /** 画布：辅助 — 仅预览用，按通道显示（不改变导出图集） */
  canvasHelperChannel: 'rgba' as CanvasHelperChannelMode,
  packSheets: [] as PackResult[],
  activeSheetIndex: 0,
  packError: '' as string,
  statusMessage: '就绪',
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

/** 多页图集中，包含该精灵矩形的那一页索引；找不到返回 null */
function findSheetIndexForSpriteId(spriteId: string): number | null {
  for (let i = 0; i < state.packSheets.length; i++) {
    const pack = state.packSheets[i]
    if (pack.placements.some((p) => p.id === spriteId)) return i
  }
  return null
}

function clearPacks() {
  state.packSheets = []
  state.activeSheetIndex = 0
}

function setStatus(msg: string) {
  state.statusMessage = msg
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
  if (id && state.packSheets.length > 0) {
    const si = findSheetIndexForSpriteId(id)
    if (si !== null) state.activeSheetIndex = si
  }
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

/** 新建：清空列表与打包结果，回到初始就绪状态 */
function newProject() {
  for (const e of state.images) URL.revokeObjectURL(e.objectUrl)
  state.images = []
  state.selectedId = null
  state.packError = ''
  clearPacks()
  setStatus('就绪')
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
    const sheets = packWithAlgorithmSheets(state.algorithm, items, b, {
      gap: state.packGap,
      atlasMargin: state.atlasMargin,
    })
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

async function exportPublish(mode: AtlasExportMode = 'png+json') {
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
      if (mode !== 'png-only') {
        triggerDownloadText(json, `atlas${suffix}.json`)
      }
      if (mode !== 'json-only') {
        const blob = await canvasToPngBlob(canvas)
        triggerDownloadBlob(blob, `atlas${suffix}.png`)
      }
      if (i < sheets.length - 1) {
        await new Promise((r) => setTimeout(r, 280))
      }
    }
    if (mode === 'png+json') {
      setStatus(
        sheets.length > 1
          ? `已下载 ${sheets.length} 组 atlas-00.json / png 起（页码从 0）`
          : '已下载 atlas.json 与 atlas.png',
      )
    } else if (mode === 'png-only') {
      setStatus(sheets.length > 1 ? `已下载 ${sheets.length} 张 atlas-00.png 起` : '已下载 atlas.png')
    } else {
      setStatus(sheets.length > 1 ? `已下载 ${sheets.length} 份 atlas-00.json 起` : '已下载 atlas.json')
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    setStatus(msg)
  }
}

/** 将本应用清单 + PNG 图集拆成子图并加入左侧列表（不触发下载） */
async function importAtlasIntoList(jsonFile: File, pngFile: File) {
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
    if (img.naturalWidth !== manifest.width || img.naturalHeight !== manifest.height) {
      throw new Error(
        `图片尺寸 ${img.naturalWidth}×${img.naturalHeight} 与清单 ${manifest.width}×${manifest.height} 不一致`,
      )
    }
    const c = document.createElement('canvas')
    const ctx = c.getContext('2d')
    if (!ctx) throw new Error('无法创建 Canvas 上下文')
    let n = 0
    for (const sp of manifest.sprites) {
      c.width = sp.w
      c.height = sp.h
      ctx.clearRect(0, 0, sp.w, sp.h)
      ctx.drawImage(img, sp.x, sp.y, sp.w, sp.h, 0, 0, sp.w, sp.h)
      const blob = await canvasToPngBlob(c)
      const base = sanitizeFilename(sp.name.replace(/\.[^.]+$/, '') || sp.id)
      const file = new File([blob], `${base}.png`, { type: 'image/png' })
      const e = await fileToEntry(file)
      state.images.push(e)
      n++
    }
    clearPacks()
    setStatus(`已从图集导入 ${n} 张子图到列表`)
  } finally {
    URL.revokeObjectURL(url)
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
  findSheetIndexForSpriteId,
  addFiles,
  select,
  removeImage,
  clearAll,
  newProject,
  runPack,
  exportPublish,
  importAtlasIntoList,
  reverseFromFiles,
  setAlgorithm(id: PackAlgorithmId) {
    state.algorithm = id
  },
  setMaxAtlasWidth(raw: number) {
    const next = clampAtlasDimension(raw)
    if (next === state.maxAtlasWidth) return
    state.maxAtlasWidth = next
  },
  setMaxAtlasHeight(raw: number) {
    const next = clampAtlasDimension(raw)
    if (next === state.maxAtlasHeight) return
    state.maxAtlasHeight = next
  },
  setPackGap(raw: number) {
    state.packGap = clampPackGap(raw)
  },
  setAtlasMargin(raw: number) {
    state.atlasMargin = clampAtlasMargin(raw)
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
  setCanvasHelperShowOrigin(v: boolean) {
    state.canvasHelperShowOrigin = v
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
  setCanvasInterpolation(mode: CanvasInterpolationMode) {
    state.canvasInterpolation = mode
  },
  setCanvasHelperChannel(mode: CanvasHelperChannelMode) {
    state.canvasHelperChannel = mode
  },
  setActiveSheetIndex(i: number) {
    const n = state.packSheets.length
    if (n === 0) return
    state.activeSheetIndex = Math.min(Math.max(0, Math.floor(i)), n - 1)
  },
}
