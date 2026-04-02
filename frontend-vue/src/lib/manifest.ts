export const MANIFEST_VERSION = 1 as const

export interface SpriteRect {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
}

/** 单页清单（与单张 PNG 对应）；逆向/裁切仍按页使用 */
export interface AtlasManifest {
  version: typeof MANIFEST_VERSION
  width: number
  height: number
  sprites: SpriteRect[]
}

/** v1 总清单：一个 JSON 包含全部页面（多页时唯一权威结构） */
export interface ManifestSheet {
  /** 页码，从 0 起，与导出 PNG 序号 atlas-00.png 一致 */
  index: number
  width: number
  height: number
  sprites: SpriteRect[]
}

export interface AtlasManifestDocument {
  version: typeof MANIFEST_VERSION
  sheets: ManifestSheet[]
}

function parseSpriteArray(raw: unknown, label: string): SpriteRect[] {
  if (!Array.isArray(raw)) throw new Error(`${label} 缺少 sprites 数组`)
  return raw.map((s, i) => {
    if (!s || typeof s !== 'object') throw new Error(`${label} sprites[${i}] 无效`)
    const r = s as Record<string, unknown>
    const id = String(r.id ?? '')
    const name = String(r.name ?? id)
    const x = Number(r.x)
    const y = Number(r.y)
    const w = Number(r.w)
    const h = Number(r.h)
    if (!id || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h))
      throw new Error(`${label} sprites[${i}] 字段不完整`)
    return { id, name, x, y, w, h }
  })
}

/**
 * 解析 v1 清单：支持
 * - **多页**：`{ version: 1, sheets: [ { index, width, height, sprites }, ... ] }`
 * - **单页（旧）**：`{ version: 1, width, height, sprites }` → 归一为单元素 `sheets`
 */
export function parseManifestJson(text: string): AtlasManifestDocument {
  let data: unknown
  try {
    data = JSON.parse(text) as unknown
  } catch {
    throw new Error('清单不是合法 JSON')
  }
  if (!data || typeof data !== 'object') throw new Error('清单格式无效')
  const o = data as Record<string, unknown>
  if (o.version !== MANIFEST_VERSION) throw new Error(`不支持的清单版本: ${String(o.version)}`)

  if (Array.isArray(o.sheets) && o.sheets.length > 0) {
    const sheets: ManifestSheet[] = o.sheets.map((sh, si) => {
      if (!sh || typeof sh !== 'object') throw new Error(`sheets[${si}] 无效`)
      const s = sh as Record<string, unknown>
      const idx = s.index !== undefined ? Number(s.index) : si
      if (!Number.isFinite(idx)) throw new Error(`sheets[${si}].index 无效`)
      if (typeof s.width !== 'number' || typeof s.height !== 'number')
        throw new Error(`sheets[${si}] 缺少 width/height`)
      const sprites = parseSpriteArray(s.sprites, `sheets[${si}]`)
      return {
        index: Math.floor(idx),
        width: Math.floor(s.width),
        height: Math.floor(s.height),
        sprites,
      }
    })
    sheets.sort((a, b) => a.index - b.index)
    return { version: MANIFEST_VERSION, sheets }
  }

  if (typeof o.width === 'number' && typeof o.height === 'number') {
    const sprites = parseSpriteArray(o.sprites, '清单')
    return {
      version: MANIFEST_VERSION,
      sheets: [
        {
          index: 0,
          width: Math.floor(o.width),
          height: Math.floor(o.height),
          sprites,
        },
      ],
    }
  }

  throw new Error('清单缺少 sheets 或 width/height/sprites')
}

/** 从总清单取一页，供裁切/逆向使用 */
export function sheetToAtlasManifest(sh: ManifestSheet): AtlasManifest {
  return {
    version: MANIFEST_VERSION,
    width: sh.width,
    height: sh.height,
    sprites: sh.sprites,
  }
}
