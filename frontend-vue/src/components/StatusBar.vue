<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PackAlgorithmId } from '../lib/packing'
import { atlasStore } from '../stores/atlasStore'

const { t } = useI18n()

const sheetInfo = computed(() => {
  const sh = atlasStore.state.packSheets
  const n = sh.length
  if (!n) return null
  const pageIdx = Math.min(Math.max(0, atlasStore.state.activeSheetIndex), n - 1)
  const p = sh[pageIdx]
  return { pageIdx, total: n, w: p.width, h: p.height }
})

const algoLabel = computed(() => {
  const a = atlasStore.state.algorithm as PackAlgorithmId
  if (a === 'rows') return t('atlasPanel.algoRows')
  if (a === 'grid') return t('atlasPanel.algoGrid')
  return t('atlasPanel.algoSkyline')
})
</script>

<template>
  <div class="status-bar">
    <span class="cell main">{{ atlasStore.state.statusMessage }}</span>
    <span class="cell">{{ t('status.images') }}: {{ atlasStore.state.images.length }}</span>
    <span class="cell" v-if="sheetInfo">
      {{ t('status.canvas') }}: {{ sheetInfo.w }}×{{ sheetInfo.h }}（{{ t('status.page') }} {{ sheetInfo.pageIdx }} /
      {{ sheetInfo.total }}）
    </span>
    <span class="cell" v-else>{{ t('status.canvas') }}: {{ t('status.canvasEmpty') }}</span>
    <span class="cell"
      >{{ t('status.limit') }}: {{ atlasStore.state.maxAtlasWidth }}×{{ atlasStore.state.maxAtlasHeight }}</span
    >
    <span class="cell">{{ t('status.algo') }}: {{ algoLabel }}</span>
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
  color: var(--win-text);
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
