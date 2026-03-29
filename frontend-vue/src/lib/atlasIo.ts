import type { AtlasManifest, SpriteRect } from './manifest'
import { MANIFEST_VERSION } from './manifest'

export function buildManifest(
  width: number,
  height: number,
  sprites: SpriteRect[],
): AtlasManifest {
  return { version: MANIFEST_VERSION, width, height, sprites }
}

export function triggerDownloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function triggerDownloadText(text: string, filename: string): void {
  triggerDownloadBlob(new Blob([text], { type: 'application/json;charset=utf-8' }), filename)
}

export async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('无法导出 PNG'))), 'image/png')
  })
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 120) || 'sprite'
}

export async function splitAtlasToDownloads(
  img: HTMLImageElement,
  manifest: AtlasManifest,
): Promise<void> {
  if (img.naturalWidth !== manifest.width || img.naturalHeight !== manifest.height) {
    throw new Error(
      `图片尺寸 ${img.naturalWidth}x${img.naturalHeight} 与清单 ${manifest.width}x${manifest.height} 不一致`,
    )
  }
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('无法创建 Canvas 上下文')
  for (const sp of manifest.sprites) {
    c.width = sp.w
    c.height = sp.h
    ctx.clearRect(0, 0, sp.w, sp.h)
    ctx.drawImage(img, sp.x, sp.y, sp.w, sp.h, 0, 0, sp.w, sp.h)
    const blob = await canvasToPngBlob(c)
    const base = sanitizeFilename(sp.name.replace(/\.[^.]+$/, '') || sp.id)
    triggerDownloadBlob(blob, `${base}.png`)
  }
}
