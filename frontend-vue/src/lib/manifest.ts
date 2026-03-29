export const MANIFEST_VERSION = 1 as const

export interface SpriteRect {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
}

export interface AtlasManifest {
  version: typeof MANIFEST_VERSION
  width: number
  height: number
  sprites: SpriteRect[]
}

export function parseManifestJson(text: string): AtlasManifest {
  const data = JSON.parse(text) as unknown
  if (!data || typeof data !== 'object') throw new Error('清单格式无效')
  const o = data as Record<string, unknown>
  if (o.version !== MANIFEST_VERSION) throw new Error(`不支持的清单版本: ${String(o.version)}`)
  if (typeof o.width !== 'number' || typeof o.height !== 'number')
    throw new Error('清单缺少 width/height')
  if (!Array.isArray(o.sprites)) throw new Error('清单缺少 sprites 数组')
  const sprites: SpriteRect[] = o.sprites.map((s, i) => {
    if (!s || typeof s !== 'object') throw new Error(`sprites[${i}] 无效`)
    const r = s as Record<string, unknown>
    const id = String(r.id ?? '')
    const name = String(r.name ?? id)
    const x = Number(r.x)
    const y = Number(r.y)
    const w = Number(r.w)
    const h = Number(r.h)
    if (!id || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h))
      throw new Error(`sprites[${i}] 字段不完整`)
    return { id, name, x, y, w, h }
  })
  return {
    version: MANIFEST_VERSION,
    width: Math.floor(o.width),
    height: Math.floor(o.height),
    sprites,
  }
}
