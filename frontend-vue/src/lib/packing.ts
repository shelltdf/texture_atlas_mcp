export const MAX_ATLAS_EDGE = 4096
export const PACK_PADDING = 2

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

function assertWithinMax(w: number, h: number): void {
  if (w > MAX_ATLAS_EDGE || h > MAX_ATLAS_EDGE)
    throw new Error(`画布超过最大边长 ${MAX_ATLAS_EDGE}px`)
}

export function packGrid(items: PackItem[]): PackResult {
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
  const width =
    colWidths.reduce((a, w, i) => a + w + (i < cols - 1 ? PACK_PADDING : 0), 0)
  const height =
    rowHeights.reduce((a, h, i) => a + h + (i < rows - 1 ? PACK_PADDING : 0), 0)
  assertWithinMax(width, height)
  const placements: Placement[] = []
  for (let i = 0; i < n; i++) {
    const c = i % cols
    const r = Math.floor(i / cols)
    const it = items[i]
    placements.push({ id: it.id, x: xOff[c], y: yOff[r], w: it.w, h: it.h })
  }
  return { width, height, placements }
}

export function packRows(items: PackItem[]): PackResult {
  if (items.length === 0) return { width: 0, height: 0, placements: [] }
  const placements: Placement[] = []
  let rowEnd = 0
  let y = 0
  let rowH = 0
  for (const it of items) {
    const placeX = rowEnd === 0 ? 0 : rowEnd + PACK_PADDING
    if (rowEnd > 0 && placeX + it.w > MAX_ATLAS_EDGE) {
      y += rowH + PACK_PADDING
      rowEnd = 0
      rowH = 0
    }
    const x = rowEnd === 0 ? 0 : rowEnd + PACK_PADDING
    placements.push({ id: it.id, x, y, w: it.w, h: it.h })
    rowH = Math.max(rowH, it.h)
    rowEnd = x + it.w
  }
  const width = Math.max(...placements.map((p) => p.x + p.w), 0)
  const height = Math.max(...placements.map((p) => p.y + p.h), 0)
  assertWithinMax(width, height)
  return { width, height, placements }
}

interface SkySeg {
  x: number
  y: number
  w: number
}

export function packSkyline(items: PackItem[]): PackResult {
  const n = items.length
  if (n === 0) return { width: 0, height: 0, placements: [] }
  const placements: Placement[] = []
  let segs: SkySeg[] = [{ x: 0, y: 0, w: MAX_ATLAS_EDGE }]
  let totalW = 0
  let totalH = 0

  for (const it of items) {
    let best: { si: number; x: number; y: number } | null = null
    for (let si = 0; si < segs.length; si++) {
      const s = segs[si]
      if (s.w < it.w) continue
      const y = s.y
      const x = s.x
      const top = y + it.h + PACK_PADDING
      if (top > MAX_ATLAS_EDGE) continue
      if (!best || y < best.y || (y === best.y && x < best.x)) best = { si, x, y }
    }
    if (!best) throw new Error('天际线算法无法放入（单图或累积过高）')
    const { si, x, y } = best
    placements.push({ id: it.id, x, y, w: it.w, h: it.h })
    totalW = Math.max(totalW, x + it.w)
    totalH = Math.max(totalH, y + it.h)

    const s = segs[si]
    const newSegs: SkySeg[] = []
    if (x > s.x) newSegs.push({ x: s.x, y: s.y, w: x - s.x })
    const rightX = x + it.w + PACK_PADDING
    const restW = s.x + s.w - rightX
    if (restW > 0) newSegs.push({ x: rightX, y: s.y, w: restW })
    newSegs.push({ x, y: y + it.h + PACK_PADDING, w: it.w })
    segs = mergeSkyline([...segs.slice(0, si), ...segs.slice(si + 1), ...newSegs])
  }

  assertWithinMax(totalW, totalH)
  return { width: totalW, height: totalH, placements }
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

export function packWithAlgorithm(id: PackAlgorithmId, items: PackItem[]): PackResult {
  switch (id) {
    case 'grid':
      return packGrid(items)
    case 'rows':
      return packRows(items)
    case 'skyline':
      return packSkyline(items)
    default:
      return packRows(items)
  }
}
