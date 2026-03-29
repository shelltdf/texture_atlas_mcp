<script setup lang="ts">
import { ref } from 'vue'
import type { PackAlgorithmId } from '../lib/packing'
import { atlasStore } from '../stores/atlasStore'

const fileJson = ref<HTMLInputElement | null>(null)
const filePng = ref<HTMLInputElement | null>(null)
const pendingJson = ref<File | null>(null)

const algorithms: { id: PackAlgorithmId; label: string }[] = [
  { id: 'rows', label: '按行贪心 (Rows)' },
  { id: 'grid', label: '网格 (Grid)' },
  { id: 'skyline', label: '天际线 (Skyline)' },
]

function onAlgo(ev: Event) {
  const v = (ev.target as HTMLSelectElement).value as PackAlgorithmId
  atlasStore.setAlgorithm(v)
}

function onMaxWidthChange(ev: Event) {
  const el = ev.target as HTMLInputElement
  atlasStore.setMaxAtlasWidth(parseInt(el.value, 10))
  el.value = String(atlasStore.state.maxAtlasWidth)
}

function onMaxHeightChange(ev: Event) {
  const el = ev.target as HTMLInputElement
  atlasStore.setMaxAtlasHeight(parseInt(el.value, 10))
  el.value = String(atlasStore.state.maxAtlasHeight)
}

function startReverse() {
  pendingJson.value = null
  fileJson.value?.click()
}
function onJson(ev: Event) {
  const input = ev.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  pendingJson.value = f
  filePng.value?.click()
}
async function onPng(ev: Event) {
  const input = ev.target as HTMLInputElement
  const png = input.files?.[0]
  input.value = ''
  const json = pendingJson.value
  pendingJson.value = null
  if (!json || !png) return
  try {
    await atlasStore.reverseFromFiles(json, png)
  } catch (e) {
    atlasStore.state.statusMessage = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <div class="atlas-panel">
    <div class="win-panel-title">Atlas 图集</div>
    <div class="inner">
      <div class="field-row">
        <label class="field half">
          <span>单张最大宽 (px)</span>
          <input
            type="number"
            class="win-input"
            :value="atlasStore.state.maxAtlasWidth"
            min="64"
            max="16384"
            step="1"
            title="单张图集最大宽度；与高度独立"
            @change="onMaxWidthChange"
          />
        </label>
        <label class="field half">
          <span>单张最大高 (px)</span>
          <input
            type="number"
            class="win-input"
            :value="atlasStore.state.maxAtlasHeight"
            min="64"
            max="16384"
            step="1"
            title="单张图集最大高度；与宽度独立"
            @change="onMaxHeightChange"
          />
        </label>
      </div>
      <label class="field">
        <span>打包算法</span>
        <select class="win-select" :value="atlasStore.state.algorithm" @change="onAlgo">
          <option v-for="a in algorithms" :key="a.id" :value="a.id">{{ a.label }}</option>
        </select>
      </label>
      <p class="tip sheet-hint">
        多页时请在<strong>画布标题栏</strong>翻页或使用「全部总览」。画布上可分项开关<strong>辅助线</strong>（网格、单张上限、输出边界、图块描边），并调节<strong>线宽 (px)</strong>与<strong>网格步长</strong>。
      </p>
      <div class="err" v-if="atlasStore.state.packError">{{ atlasStore.state.packError }}</div>
      <div class="btns">
        <button type="button" class="win-btn" @click="atlasStore.runPack()">运行打包</button>
        <button type="button" class="win-btn primary" @click="atlasStore.exportPublish()">导出发布</button>
      </div>
      <div class="btns">
        <button type="button" class="win-btn" @click="startReverse">逆向拆分</button>
      </div>
      <p class="tip">多页导出时为 atlas-00.json/png、atlas-01…（页码从 0）；单页仍为 atlas.json/png。逆向：先选清单再选 PNG。</p>
    </div>
    <input ref="fileJson" type="file" class="hidden" accept=".json,application/json" @change="onJson" />
    <input ref="filePng" type="file" class="hidden" accept="image/png" @change="onPng" />
  </div>
</template>

<style scoped>
.hidden {
  display: none;
}
.atlas-panel {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--win-border);
  background: var(--win-panel);
  flex-shrink: 0;
}
.inner {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.field-row {
  display: flex;
  gap: 8px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: #444;
}
.field.half {
  flex: 1;
  min-width: 0;
}
.win-input {
  font-family: inherit;
  font-size: 12px;
  height: 23px;
  padding: 2px 6px;
  border: 1px solid var(--win-border-dark, #707070);
  background: #fff;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}
.win-select {
  font-family: inherit;
  font-size: 12px;
  height: 23px;
  border: 1px solid var(--win-border-dark, #707070);
  background: #fff;
  width: 100%;
  box-sizing: border-box;
}
.sheet-hint {
  margin: -4px 0 0;
}
.err {
  font-size: 11px;
  color: #c42b1c;
}
.btns {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.win-btn.primary {
  border-color: #005a9e;
  background: linear-gradient(180deg, #42a5ff 0%, var(--win-accent) 100%);
  color: #fff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.win-btn.primary:hover {
  background: linear-gradient(180deg, #5cb3ff 0%, #1a86e0 100%);
}
.tip {
  margin: 0;
  font-size: 10px;
  color: #666;
  line-height: 1.35;
}
</style>
