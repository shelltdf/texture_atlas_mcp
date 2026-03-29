<script setup lang="ts">
import { ref } from 'vue'
import { atlasStore } from '../stores/atlasStore'

const fileImport = ref<HTMLInputElement | null>(null)
function pick() {
  fileImport.value?.click()
}
function onFiles(ev: Event) {
  const input = ev.target as HTMLInputElement
  if (input.files?.length) atlasStore.addFiles(input.files)
  input.value = ''
}

function clearAll() {
  if (atlasStore.state.images.length === 0) return
  if (!confirm('确定要清理全部图片吗？此操作不可撤销。')) return
  atlasStore.clearAll()
}
</script>

<template>
  <div class="tool-bar">
    <input ref="fileImport" type="file" class="hidden" accept="image/*" multiple @change="onFiles" />
    <button type="button" class="tb-btn" title="导入图片" @click="pick">
      <span class="ico">📂</span> 导入
    </button>
    <span class="sep" />
    <button type="button" class="tb-btn" title="运行打包" @click="atlasStore.runPack()">
      <span class="ico">⚙</span> 打包
    </button>
    <button type="button" class="tb-btn" title="导出 JSON + PNG" @click="atlasStore.exportPublish()">
      <span class="ico">💾</span> 导出
    </button>
    <span class="sep" />
    <button type="button" class="tb-btn" title="删除当前选中" @click="atlasStore.removeSelected()">删除</button>
    <button type="button" class="tb-btn danger" title="清空全部图片" @click="clearAll">清理全部</button>
  </div>
</template>

<style scoped>
.hidden {
  display: none;
}
.tool-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 28px;
  padding: 2px 6px;
  background: linear-gradient(180deg, #fefefe 0%, var(--win-toolbar) 100%);
  border-bottom: 1px solid var(--win-border);
}
.tb-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  font: inherit;
  font-size: 11px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 2px;
  cursor: pointer;
}
.tb-btn:hover {
  border-color: #aecff0;
  background: rgba(255, 255, 255, 0.7);
}
.tb-btn:active {
  background: #d0e6fc;
}
.tb-btn.danger:hover {
  border-color: #e8a0a0;
  background: #ffe8e8;
}
.ico {
  font-size: 12px;
  line-height: 1;
}
.sep {
  width: 1px;
  height: 18px;
  background: var(--win-border);
  margin: 0 4px;
}
</style>
