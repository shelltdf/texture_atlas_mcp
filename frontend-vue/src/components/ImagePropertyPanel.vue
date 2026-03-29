<script setup lang="ts">
import { computed } from 'vue'
import { atlasStore } from '../stores/atlasStore'

const selected = computed(() => {
  const id = atlasStore.state.selectedId
  if (!id) return null
  return atlasStore.state.images.find((x) => x.id === id) ?? null
})
</script>

<template>
  <div class="props win-inset">
    <div class="win-panel-title">图片属性</div>
    <div class="body" v-if="selected">
      <div class="row"><span class="k">名称</span><span class="v">{{ selected.name }}</span></div>
      <div class="row"><span class="k">宽度</span><span class="v">{{ selected.width }} px</span></div>
      <div class="row"><span class="k">高度</span><span class="v">{{ selected.height }} px</span></div>
      <div class="row"><span class="k">ID</span><span class="v mono">{{ selected.id }}</span></div>
    </div>
    <div class="empty" v-else>未选中图片</div>
  </div>
</template>

<style scoped>
.props {
  display: flex;
  flex-direction: column;
  min-height: 100px;
  background: #fafafa;
}
.body {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.row {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 6px;
  font-size: 11px;
}
.k {
  color: #555;
}
.v {
  word-break: break-all;
}
.mono {
  font-family: Consolas, monospace;
  font-size: 10px;
}
.empty {
  padding: 12px;
  color: #777;
  font-size: 11px;
}
</style>
