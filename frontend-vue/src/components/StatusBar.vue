<script setup lang="ts">
import { atlasStore } from '../stores/atlasStore'
</script>

<template>
  <div class="status-bar">
    <span class="cell main">{{ atlasStore.state.statusMessage }}</span>
    <span class="cell">图片: {{ atlasStore.state.images.length }}</span>
    <span class="cell" v-if="atlasStore.state.lastPack">
      画布: {{ atlasStore.state.lastPack.width }}×{{ atlasStore.state.lastPack.height }}
    </span>
    <span class="cell" v-else>画布: —</span>
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
