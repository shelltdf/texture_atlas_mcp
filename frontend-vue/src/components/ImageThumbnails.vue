<script setup lang="ts">
import { atlasStore } from '../stores/atlasStore'
</script>

<template>
  <div class="list-wrap">
    <div class="win-panel-title">图片列表</div>
    <div class="list win-inset">
      <button
        v-for="im in atlasStore.state.images"
        :key="im.id"
        type="button"
        class="item"
        :class="{ on: atlasStore.state.selectedId === im.id }"
        @click="atlasStore.select(im.id)"
      >
        <img :src="im.thumbDataUrl" class="thumb" alt="" />
        <span class="name">{{ im.name }}</span>
      </button>
      <div v-if="atlasStore.state.images.length === 0" class="hint">拖入或点击工具栏「导入」</div>
    </div>
  </div>
</template>

<style scoped>
.list-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 120px;
}
.list {
  flex: 1;
  overflow: auto;
  background: #fff;
  padding: 4px;
}
.item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 4px 6px;
  margin-bottom: 2px;
  border: 1px solid transparent;
  background: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 11px;
}
.item:hover {
  background: #e5f3ff;
  border-color: #c0d8f0;
}
.item.on {
  background: #cce8ff;
  border-color: #6ab5e7;
}
.thumb {
  width: 40px;
  height: 40px;
  object-fit: contain;
  background: repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 8px 8px;
  border: 1px solid var(--win-border);
}
.name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hint {
  padding: 16px 8px;
  color: #888;
  font-size: 11px;
  text-align: center;
}
</style>
