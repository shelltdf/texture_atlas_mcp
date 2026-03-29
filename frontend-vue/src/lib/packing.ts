export const PACK_PADDING = 2

/** 默认单张图集最大宽、高 */
export const DEFAULT_MAX_ATLAS_EDGE = 4096
export const MIN_USER_MAX_ATLAS_EDGE = 64
export const MAX_USER_MAX_ATLAS_EDGE = 16384

export type PackAlgorithmId = 'grid' | 'rows' | 'skyline'

export interface PackItem {
  id: string
  w: number
  h: number
}

export interface Placement {
  id: string
  x: number
  y: number
  w: number
  h: number
}

export interface PackResult {
  width: number
  height: number
  placements: Placement[]
}

/** 单张图集允许的最大宽高（独立设置） */
export interface AtlasMaxBounds {
  maxW: number
  maxH: number
}

export function clampAtlasDimension(raw: number): number {
  if (!Number.isFinite(raw)) return DEFAULT_MAX_ATLAS_EDGE
  return Math.min(MAX_USER_MAX_ATLAS_EDGE, Math.max(MIN_USER_MAX_ATLAS_EDGE, Math.floor(raw)))
}

export function clampBounds(w: number, h: number): AtlasMaxBounds {
  return { maxW: clampAtlasDimension(w), maxH: clampAtlasDimension(h) }
}

/** 单张画布布局（不校验边长，供多页切分使用） */
function computePackGrid(items: PackItem[]): PackResult {
  const n = items.length
  if (n === 0) return { width: 0, height: 0, placements: [] }
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)))
  const rows = Math.ceil(n / cols)
  const colWidths = new Array(cols).fill(0)
  const rowHeights = new Array(rows).fill(0)
  for (let i = 0; i < n; i++) {
    const c = i % cols
    const r = Math.floor(i / cols)
    const it = items[i]
    colWidths[c] = Math.max(colWidths[c], it.w)
    rowHeights[r] = Math.max(rowHeights[r], it.h)
  }
  const xOff = new Array(cols).fill(0)
  const yOff = new Array(rows).fill(0)
  for (let c = 1; c < cols; c++) xOff[c] = xOff[c - 1] + colWidths[c - 1] + PACK_PADDING
  for (let r = 1; r < rows; r++) yOff[r] = yOff[r - 1] + rowHeights[r - 1] + PACK_PADDING
  const width = colWidths.reduce((a, w, i) => a + w + (i < cols - 1 ? PACK_PADDING : 0), 0)
  const height = rowHeights.reduce((a, h, i) => a + h + (i < rows - 1 ? PACK_PADDING : 0), 0)
  const placements: Placement[] = []
  for (let i = 0; i < n; i++) {
    const c = i % cols
    const r = Math.floor(i / cols)
    const it = items[i]
    placements.push({ id: it.id, x: xOff[c], y: yOff[r], w: it.w, h: it.h })
  }
  return { width, height, placements }
}

function largestGridPrefix(remaining: PackItem[], maxW: number, maxH: number): number {
  if (remaining.length === 0) return 0
  let lo = 1
  let hi = remaining.length
  let ans = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const r = computePackGrid(remaining.slice(0, mid))
    if (r.width <= maxW && r.height <= maxH) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return ans
}

export function packGridSheets(items: PackItem[], bounds: AtlasMaxBounds): PackResult[] {
  const { maxW, maxH } = bounds
  const sheets: PackResult[] = []
  let rest = items
  while (rest.length > 0) {
    const k = largestGridPrefix(rest, maxW, maxH)
    if (k === 0) {
      throw new Error(
        `首张图（或当前剩余序列）在网格算法下无法装入 ${maxW}×${maxH}，请增大单张最大宽/高`,
      )
    }
    sheets.push(computePackGrid(rest.slice(0, k)))
    rest = rest.slice(k)
  }
  return sheets
}

export function packRowsOneSheet(
  items: PackItem[],
  maxW: number,
  maxH: number,
): { sheet: PackResult; consumed: number } {
  const placements: Placement[] = []
  let rowEnd = 0
  let y = 0
  let rowH = 0
  let consumed = 0

  for (const it of items) {
    if (it.w > maxW || it.h > maxH) {
      throw new Error(`存在图片超过单张最大范围 ${maxW}×${maxH}px（请增大限制或缩小素材）`)
    }
    let x = rowEnd === 0 ? 0 : rowEnd + PACK_PADDING
    if (rowEnd > 0 && x + it.w > maxW) {
      const newY = y + rowH + PACK_PADDING
      if (newY + it.h > maxH) {
        break
      }
      y = newY
      rowH = 0
      rowEnd = 0
      x = 0
    }
    const nh = Math.max(rowH, it.h)
    if (y + nh > maxH) {
      break
    }
    placements.push({ id: it.id, x, y, w: it.w, h: it.h })
    rowH = nh
    rowEnd = x + it.w
    consumed++
  }

  const width = placements.length === 0 ? 0 : Math.max(...placements.map((p) => p.x + p.w))
  const height = placements.length === 0 ? 0 : Math.max(...placements.map((p) => p.y + p.h))
  return { sheet: { width, height, placements }, consumed }
}

export function packRowsSheets(items: PackItem[], bounds: AtlasMaxBounds): PackResult[] {
  const { maxW, maxH } = bounds
  const sheets: PackResult[] = []
  let rest = items
  while (rest.length > 0) {
    const { sheet, consumed } = packRowsOneSheet(rest, maxW, maxH)
    if (consumed === 0) {
      throw new Error(`行打包无法继续（请增大单张最大范围 ${maxW}×${maxH}px）`)
    }
    sheets.push(sheet)
    rest = rest.slice(consumed)
  }
  return sheets
}

interface SkySeg {
  x: number
  y: number
  w: number
}

function mergeSkyline(raw: SkySeg[]): SkySeg[] {
  raw.sort((a, b) => a.x - b.x)
  const out: SkySeg[] = []
  for (const seg of raw) {
    if (seg.w <= 0) continue
    const prev = out[out.length - 1]
    if (prev && prev.y === seg.y && prev.x + prev.w === seg.x) prev.w += seg.w
    else out.push({ ...seg })
  }
  return out
}

export function packSkylineOneSheet(
  items: PackItem[],
  maxW: number,
  maxH: number,
): { sheet: PackResult; consumed: number } {
  const placements: Placement[] = []
  let segs: SkySeg[] = [{ x: 0, y: 0, w: maxW }]
  let totalW = 0
  let totalH = 0
  let consumed = 0

  for (const it of items) {
    if (it.w > maxW || it.h > maxH) {
      throw new Error(`存在图片超过单张最大范围 ${maxW}×${maxH}px（请增大限制或缩小素材）`)
    }
    let best: { si: number; x: number; y: number } | null = null
    for (let si = 0; si < segs.length; si++) {
      const s = segs[si]
      if (s.w < it.w) continue
      const yy = s.y
      const xx = s.x
      const top = yy + it.h + PACK_PADDING
      if (top > maxH) continue
      if (!best || yy < best.y || (yy === best.y && xx < best.x)) best = { si, x: xx, y: yy }
    }
    if (!best) break

    const { si, x, y } = best
    placements.push({ id: it.id, x, y, w: it.w, h: it.h })
    totalW = Math.max(totalW, x + it.w)
    totalH = Math.max(totalH, y + it.h)
    consumed++

    const s = segs[si]
    const newSegs: SkySeg[] = []
    if (x > s.x) newSegs.push({ x: s.x, y: s.y, w: x - s.x })
    const rightX = x + it.w + PACK_PADDING
    const restW = s.x + s.w - rightX
    if (restW > 0) newSegs.push({ x: rightX, y: s.y, w: restW })
    newSegs.push({ x, y: y + it.h + PACK_PADDING, w: it.w })
    segs = mergeSkyline([...segs.slice(0, si), ...segs.slice(si + 1), ...newSegs])
  }

  return { sheet: { width: totalW, height: totalH, placements }, consumed }
}

export function packSkylineSheets(items: PackItem[], bounds: AtlasMaxBounds): PackResult[] {
  const { maxW, maxH } = bounds
  const sheets: PackResult[] = []
  let rest = items
  while (rest.length > 0) {
    const { sheet, consumed } = packSkylineOneSheet(rest, maxW, maxH)
    if (consumed === 0) {
      throw new Error('天际线在当前单张尺寸下无法继续放置（请增大单张最大宽/高或换算法）')
    }
    sheets.push(sheet)
    rest = rest.slice(consumed)
  }
  return sheets
}

export function packWithAlgorithmSheets(
  id: PackAlgorithmId,
  items: PackItem[],
  bounds: AtlasMaxBounds,
): PackResult[] {
  const b = clampBounds(bounds.maxW, bounds.maxH)
  if (items.length === 0) return []
  switch (id) {
    case 'grid':
      return packGridSheets(items, b)
    case 'rows':
      return packRowsSheets(items, b)
    case 'skyline':
      return packSkylineSheets(items, b)
    default:
      return packRowsSheets(items, b)
  }
}

/** @deprecated 使用 clampAtlasDimension */
export const clampMaxEdge = clampAtlasDimension
