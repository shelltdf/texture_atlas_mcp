<script setup lang="ts">
import { computed } from 'vue'
import type { PackResult, Placement } from '../lib/packing'

export interface OverlayBlock {
  ox: number
  oy: number
  bleed: number
  logicW: number
  logicH: number
  pack: PackResult
}

export interface AtlasHelpersSpec {
  width: number
  height: number
  blocks: OverlayBlock[]
  maxW: number
  maxH: number
  showGrid: boolean
  showMaxBounds: boolean
  showOutputBounds: boolean
  showSpriteBounds: boolean
  showOrigin: boolean
  helperStrokePx: number
  helperGridStep: number
  selectedId: string | null
  hoverPixel: { x: number; y: number } | null
  viewScale: number
}

const props = defineProps<{
  spec: AtlasHelpersSpec
}>()

const screenPx = computed(() => 1 / Math.max(1e-6, props.spec.viewScale))

const outerLw = computed(() => Math.max(1, props.spec.helperStrokePx))
const outerInset = computed(() => outerLw.value * 0.5)
const maxLw = computed(() => Math.max(1, props.spec.helperStrokePx))
const maxInset = computed(() => maxLw.value * 0.5)
const spriteLw = computed(() => Math.max(1, Math.round(props.spec.helperStrokePx * 0.9)))

const outputDash = computed(() => {
  const px = props.spec.helperStrokePx
  return `${Math.max(4, Math.round(px * 3))} ${Math.max(3, Math.round(px * 2))}`
})

const maxDash = computed(() => {
  const px = props.spec.helperStrokePx
  return `${Math.max(4, Math.round(px * 2.5))} ${Math.max(3, Math.round(px * 2))} ${Math.max(8, Math.round(px * 5))} ${Math.max(3, Math.round(px * 2))}`
})

function gridLinesFor(blk: OverlayBlock): { x1: number; y1: number; x2: number; y2: number }[] {
  const s = props.spec.helperGridStep
  if (s < 4) return []
  const b = blk.bleed
  const { logicW: lw, logicH: lh } = blk
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = []
  for (let gx = 0; gx <= lw; gx += s) {
    const x = b + gx
    lines.push({ x1: x, y1: b, x2: x, y2: b + lh })
  }
  for (let gy = 0; gy <= lh; gy += s) {
    const y = b + gy
    lines.push({ x1: b, y1: y, x2: b + lw, y2: y })
  }
  return lines
}

const gridStrokeW = computed(() => Math.max(0.5, props.spec.helperStrokePx * 0.5))

function placementById(pack: PackResult, id: string | null): Placement | null {
  if (!id) return null
  return pack.placements.find((pl) => pl.id === id) ?? null
}

function selectionRect(
  blk: OverlayBlock,
): { x: number; y: number; width: number; height: number } | null {
  const p = placementById(blk.pack, props.spec.selectedId)
  if (!p) return null
  const x = blk.bleed + p.x
  const y = blk.bleed + p.y
  const sp = screenPx.value
  return {
    x: x - sp,
    y: y - sp,
    width: p.w + sp * 2,
    height: p.h + sp * 2,
  }
}

function spriteInnerRects(pl: Placement) {
  const sw = spriteLw.value
  const inset = sw * 0.5
  return {
    x1: pl.x + inset,
    y1: pl.y + inset,
    w1: Math.max(0, pl.w - sw),
    h1: Math.max(0, pl.h - sw),
    x2: pl.x + inset * 0.5,
    y2: pl.y + inset * 0.5,
    w2: Math.max(0, pl.w - inset),
    h2: Math.max(0, pl.h - inset),
  }
}

function originArm(pack: PackResult): number {
  return Math.min(14, pack.width, pack.height)
}
</script>

<template>
  <svg
    class="atlas-helpers-svg"
    :width="spec.width"
    :height="spec.height"
    :viewBox="`0 0 ${spec.width} ${spec.height}`"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <g v-for="(blk, bi) in spec.blocks" :key="bi" :transform="`translate(${blk.ox}, ${blk.oy})`">
      <!-- 网格 -->
      <g v-if="spec.showGrid && spec.helperGridStep >= 4" shape-rendering="crispEdges">
        <line
          v-for="(gl, gi) in gridLinesFor(blk)"
          :key="'gl' + gi"
          :x1="gl.x1"
          :y1="gl.y1"
          :x2="gl.x2"
          :y2="gl.y2"
          stroke="rgba(70, 75, 95, 0.42)"
          :stroke-width="gridStrokeW"
          stroke-dasharray="3 5"
          fill="none"
        />
      </g>

      <!-- 图块描边 -->
      <g v-if="spec.showSpriteBounds">
        <template v-for="pl in blk.pack.placements" :key="pl.id">
          <rect
            :x="blk.bleed + spriteInnerRects(pl).x1"
            :y="blk.bleed + spriteInnerRects(pl).y1"
            :width="spriteInnerRects(pl).w1"
            :height="spriteInnerRects(pl).h1"
            fill="none"
            stroke="rgba(0, 0, 0, 0.65)"
            :stroke-width="spriteLw"
          />
          <rect
            :x="blk.bleed + spriteInnerRects(pl).x2"
            :y="blk.bleed + spriteInnerRects(pl).y2"
            :width="spriteInnerRects(pl).w2"
            :height="spriteInnerRects(pl).h2"
            fill="none"
            stroke="rgba(0, 230, 255, 0.95)"
            :stroke-width="spriteLw"
          />
        </template>
      </g>

      <rect
        v-if="spec.showOutputBounds"
        :x="blk.bleed + outerInset"
        :y="blk.bleed + outerInset"
        :width="blk.pack.width - outerLw"
        :height="blk.pack.height - outerLw"
        fill="none"
        stroke="#ff9f1a"
        :stroke-width="outerLw"
        :stroke-dasharray="outputDash"
      />

      <rect
        v-if="spec.showMaxBounds"
        :x="blk.bleed + maxInset"
        :y="blk.bleed + maxInset"
        :width="Math.max(1, spec.maxW - maxLw)"
        :height="Math.max(1, spec.maxH - maxLw)"
        fill="none"
        stroke="rgba(168, 85, 247, 0.92)"
        :stroke-width="maxLw"
        :stroke-dasharray="maxDash"
      />

      <rect
        v-if="selectionRect(blk)"
        :x="selectionRect(blk)!.x"
        :y="selectionRect(blk)!.y"
        :width="selectionRect(blk)!.width"
        :height="selectionRect(blk)!.height"
        fill="none"
        stroke="rgba(255, 215, 0, 0.98)"
        stroke-width="1"
        vector-effect="non-scaling-stroke"
      />

      <rect
        v-if="
          spec.hoverPixel &&
          spec.hoverPixel.x >= 0 &&
          spec.hoverPixel.y >= 0 &&
          spec.hoverPixel.x < blk.pack.width &&
          spec.hoverPixel.y < blk.pack.height
        "
        :x="blk.bleed + spec.hoverPixel.x"
        :y="blk.bleed + spec.hoverPixel.y"
        width="1"
        height="1"
        fill="none"
        stroke="rgba(255, 220, 60, 0.98)"
        stroke-width="1"
        vector-effect="non-scaling-stroke"
      />

      <g v-if="spec.showOrigin && blk.pack.width >= 1 && blk.pack.height >= 1">
        <rect
          :x="blk.bleed"
          :y="blk.bleed"
          width="1"
          height="1"
          fill="rgba(236, 72, 153, 0.22)"
          stroke="rgba(236, 72, 153, 0.95)"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
        />
        <path
          :d="`M ${blk.bleed} ${blk.bleed} L ${blk.bleed + originArm(blk.pack)} ${blk.bleed} M ${blk.bleed} ${blk.bleed} L ${blk.bleed} ${blk.bleed + originArm(blk.pack)}`"
          fill="none"
          stroke="rgba(236, 72, 153, 0.88)"
          :stroke-width="Math.max(1, screenPx * 1.25)"
          stroke-linecap="square"
        />
        <text
          :x="blk.bleed + originArm(blk.pack) + 3"
          :y="blk.bleed + 12"
          fill="rgba(236, 72, 153, 0.95)"
          font-size="11"
          font-family="Segoe UI, system-ui, sans-serif"
        >
          O
        </text>
      </g>
    </g>
  </svg>
</template>

<style scoped>
.atlas-helpers-svg {
  position: absolute;
  left: 0;
  top: 0;
  display: block;
  pointer-events: none;
  overflow: visible;
}
</style>
