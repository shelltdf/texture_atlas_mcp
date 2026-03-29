<script setup lang="ts">
import { computed } from 'vue'
import { atlasStore } from '../stores/atlasStore'

const sheetInfo = computed(() => {
  const sh = atlasStore.state.packSheets
  const n = sh.length
  if (!n) return null
  const pageIdx = Math.min(Math.max(0, atlasStore.state.activeSheetIndex), n - 1)
  const p = sh[pageIdx]
  return { pageIdx, total: n, w: p.width, h: p.height }
})
</script>

<template>
  <div class="status-bar">
    <span class="cell main">{{ atlasStore.state.statusMessage }}</span>
    <span class="cell">图片: {{ atlasStore.state.images.length }}</span>
    <span class="cell" v-if="sheetInfo">
      画布: {{ sheetInfo.w }}×{{ sheetInfo.h }}（页码 {{ sheetInfo.pageIdx }} / {{ sheetInfo.total }}）
    </span>
    <span class="cell" v-else>画布: —</span>
    <span class="cell">上限: {{ atlasStore.state.maxAtlasEdge }}px</span>
    <span class="cell">算法: {{ atlasStore.state.algorithm }}</span>
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: stretch;
  height: 22px;
  background: var(--win-status);
  border-top: 1px solid var(--win-border-light);
  box-shadow: inset 0 1px 0 var(--win-border-dark);
  font-size: 11px;
}
.cell {
  padding: 3px 8px;
  border-right: 1px solid var(--win-border);
  white-space: nowrap;
}
.cell.main {
  flex: 1;
  border-right: 1px solid var(--win-border);
}
</style>
