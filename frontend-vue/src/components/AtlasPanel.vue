<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PackAlgorithmId } from '../lib/packing'
import { atlasStore } from '../stores/atlasStore'

const { t } = useI18n()

const algorithms = computed((): { id: PackAlgorithmId; label: string }[] => [
  { id: 'rows', label: t('atlasPanel.algoRows') },
  { id: 'grid', label: t('atlasPanel.algoGrid') },
  { id: 'skyline', label: t('atlasPanel.algoSkyline') },
])

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

function onPackGapChange(ev: Event) {
  const el = ev.target as HTMLInputElement
  atlasStore.setPackGap(parseInt(el.value, 10))
  el.value = String(atlasStore.state.packGap)
}

function onAtlasMarginChange(ev: Event) {
  const el = ev.target as HTMLInputElement
  atlasStore.setAtlasMargin(parseInt(el.value, 10))
  el.value = String(atlasStore.state.atlasMargin)
}
</script>

<template>
  <div class="atlas-panel">
    <div class="win-panel-title">{{ t('atlasPanel.title') }}</div>
    <div class="inner">
      <div class="field-row">
        <label class="field half">
          <span>{{ t('atlasPanel.maxW') }}</span>
          <input
            type="number"
            class="win-input"
            :value="atlasStore.state.maxAtlasWidth"
            min="64"
            max="16384"
            step="1"
            :title="t('atlasPanel.maxWTitle')"
            @change="onMaxWidthChange"
          />
        </label>
        <label class="field half">
          <span>{{ t('atlasPanel.maxH') }}</span>
          <input
            type="number"
            class="win-input"
            :value="atlasStore.state.maxAtlasHeight"
            min="64"
            max="16384"
            step="1"
            :title="t('atlasPanel.maxHTitle')"
            @change="onMaxHeightChange"
          />
        </label>
      </div>
      <div class="field-row">
        <label class="field half">
          <span>{{ t('atlasPanel.atlasMargin') }}</span>
          <input
            type="number"
            class="win-input"
            :value="atlasStore.state.atlasMargin"
            min="0"
            max="512"
            step="1"
            :title="t('atlasPanel.atlasMarginTitle')"
            @change="onAtlasMarginChange"
          />
        </label>
        <label class="field half">
          <span>{{ t('atlasPanel.packGap') }}</span>
          <input
            type="number"
            class="win-input"
            :value="atlasStore.state.packGap"
            min="0"
            max="128"
            step="1"
            :title="t('atlasPanel.packGapTitle')"
            @change="onPackGapChange"
          />
        </label>
      </div>
      <label class="field">
        <span>{{ t('atlasPanel.algorithm') }}</span>
        <select class="win-select" :value="atlasStore.state.algorithm" @change="onAlgo">
          <option v-for="a in algorithms" :key="a.id" :value="a.id">{{ a.label }}</option>
        </select>
      </label>
      <p class="tip sheet-hint">{{ t('atlasPanel.tipSheet') }}</p>
      <div class="err" v-if="atlasStore.state.packError">{{ atlasStore.state.packError }}</div>
      <div class="btns">
        <button type="button" class="win-btn primary" @click="atlasStore.runPack()">{{ t('atlasPanel.runPack') }}</button>
      </div>
      <p class="tip">{{ t('atlasPanel.tipIo') }}</p>
    </div>
  </div>
</template>

<style scoped>
.atlas-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
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
  background: var(--win-inset-bg);
  color: var(--win-text);
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}
.win-select {
  font-family: inherit;
  font-size: 12px;
  height: 23px;
  border: 1px solid var(--win-border-dark, #707070);
  background: var(--win-inset-bg);
  color: var(--win-text);
  width: 100%;
  box-sizing: border-box;
}
.btns {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tip {
  margin: 0;
  font-size: 10px;
  color: var(--win-text-muted);
  line-height: 1.35;
}
.sheet-hint {
  margin: 0;
}
.err {
  font-size: 11px;
  color: #b00020;
}
</style>
