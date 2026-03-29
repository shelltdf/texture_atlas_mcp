import { computed, reactive } from 'vue'
import {
  type PackAlgorithmId,
  type PackResult,
  packWithAlgorithm,
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
  const s = max
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  const scale = Math.min(s / iw, s / ih, 1)
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
  lastPack: null as PackResult | null,
  packError: '' as string,
  statusMessage: '就绪',
})

const idToEntry = computed(() => {
  const m = new Map<string, AtlasImageEntry>()
  for (const e of state.images) m.set(e.id, e)
  return m
})

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
}

function removeSelected() {
  if (!state.selectedId) return
  const i = state.images.findIndex((x) => x.id === state.selectedId)
  if (i >= 0) {
    const [removed] = state.images.splice(i, 1)
    URL.revokeObjectURL(removed.objectUrl)
  }
  state.selectedId = null
  state.lastPack = null
  setStatus('已删除选中项')
}

function clearAll() {
  for (const e of state.images) URL.revokeObjectURL(e.objectUrl)
  state.images = []
  state.selectedId = null
  state.lastPack = null
  setStatus('已清空列表')
}

function runPack() {
  state.packError = ''
  state.lastPack = null
  if (state.images.length === 0) {
    state.packError = '请先导入图片'
    setStatus(state.packError)
    return
  }
  try {
    const items = state.images.map((e) => ({ id: e.id, w: e.width, h: e.height }))
    const result = packWithAlgorithm(state.algorithm, items)
    state.lastPack = result
    setStatus(`打包完成 ${result.width}×${result.height}（${state.algorithm}）`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    state.packError = msg
    setStatus(msg)
  }
}

function renderAtlasCanvas(): HTMLCanvasElement {
  const pack = state.lastPack
  if (!pack || pack.placements.length === 0) throw new Error('请先成功运行打包')
  const c = document.createElement('canvas')
  c.width = pack.width
  c.height = pack.height
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')
  ctx.fillStyle = '#1a1a1e'
  ctx.fillRect(0, 0, c.width, c.height)
  for (const p of pack.placements) {
    const entry = idToEntry.value.get(p.id)
    if (!entry) continue
    ctx.drawImage(entry.img, 0, 0, entry.width, entry.height, p.x, p.y, p.w, p.h)
  }
  return c
}

async function exportPublish() {
  try {
    const canvas = renderAtlasCanvas()
    const pack = state.lastPack!
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
    triggerDownloadText(json, 'atlas.json')
    const blob = await canvasToPngBlob(canvas)
    triggerDownloadBlob(blob, 'atlas.png')
    setStatus('已下载 atlas.json 与 atlas.png')
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
  addFiles,
  select,
  removeSelected,
  clearAll,
  runPack,
  exportPublish,
  reverseFromFiles,
  setAlgorithm(id: PackAlgorithmId) {
    state.algorithm = id
  },
}
