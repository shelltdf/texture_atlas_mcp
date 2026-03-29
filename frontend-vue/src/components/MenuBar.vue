<script setup lang="ts">
import { ref } from 'vue'
import { atlasStore } from '../stores/atlasStore'

const fileImport = ref<HTMLInputElement | null>(null)
const fileJson = ref<HTMLInputElement | null>(null)
const filePng = ref<HTMLInputElement | null>(null)
const pendingReverse = ref<{ json: File | null }>({ json: null })

function openImport() {
  fileImport.value?.click()
}
function onImportChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  if (input.files?.length) atlasStore.addFiles(input.files)
  input.value = ''
}

function openReverse() {
  fileJson.value?.click()
}
function onJsonPicked(ev: Event) {
  const input = ev.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  pendingReverse.value = { json: f }
  filePng.value?.click()
}
async function onPngPicked(ev: Event) {
  const input = ev.target as HTMLInputElement
  const png = input.files?.[0]
  input.value = ''
  const json = pendingReverse.value.json
  pendingReverse.value = { json: null }
  if (!json || !png) return
  try {
    await atlasStore.reverseFromFiles(json, png)
  } catch (e) {
    atlasStore.state.statusMessage = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <div class="menu-bar">
    <input
      ref="fileImport"
      type="file"
      class="hidden"
      accept="image/*"
      multiple
      @change="onImportChange"
    />
    <input ref="fileJson" type="file" class="hidden" accept=".json,application/json" @change="onJsonPicked" />
    <input ref="filePng" type="file" class="hidden" accept="image/png" @change="onPngPicked" />

    <div class="menu-root">
      <span class="menu-label">文件(F)</span>
      <div class="menu-drop">
        <button type="button" class="menu-item" @click="openImport">导入图片…</button>
        <button type="button" class="menu-item" @click="openReverse">逆向拆分…</button>
        <div class="menu-sep" />
        <button type="button" class="menu-item" disabled>退出</button>
      </div>
    </div>
    <div class="menu-root">
      <span class="menu-label">编辑(E)</span>
      <div class="menu-drop">
        <button type="button" class="menu-item" @click="atlasStore.removeSelected()">删除选中</button>
        <button type="button" class="menu-item" @click="atlasStore.clearAll()">清空列表</button>
      </div>
    </div>
    <div class="menu-root">
      <span class="menu-label">视图(V)</span>
      <div class="menu-drop">
        <button type="button" class="menu-item" @click="atlasStore.runPack()">重新打包</button>
      </div>
    </div>
    <div class="menu-root">
      <span class="menu-label">帮助(H)</span>
      <div class="menu-drop">
        <button type="button" class="menu-item disabled" disabled>关于 Texture Atlas 编辑器</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hidden {
  display: none;
}
.menu-bar {
  display: flex;
  align-items: stretch;
  height: 24px;
  background: var(--win-bg);
  border-bottom: 1px solid var(--win-border);
  padding: 0 4px;
  user-select: none;
}
.menu-root {
  position: relative;
  display: flex;
  align-items: center;
}
.menu-label {
  padding: 2px 8px;
  font-size: 12px;
  cursor: default;
}
.menu-root:hover .menu-label {
  background: var(--win-menu-hover);
  border: 1px solid #6ab5e7;
  border-radius: 2px;
  padding: 1px 7px;
}
.menu-drop {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 180px;
  background: #f0f0f0;
  border: 1px solid var(--win-border-dark);
  box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
  z-index: 200;
  padding: 2px 0;
}
.menu-root:hover .menu-drop {
  display: block;
}
.menu-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 4px 24px 4px 12px;
  border: none;
  background: transparent;
  font: inherit;
  cursor: pointer;
}
.menu-item:hover:not(:disabled) {
  background: #91c9f7;
}
.menu-item:disabled,
.menu-item.disabled {
  color: #888;
  cursor: default;
}
.menu-sep {
  height: 1px;
  background: var(--win-border);
  margin: 4px 0;
}
</style>
