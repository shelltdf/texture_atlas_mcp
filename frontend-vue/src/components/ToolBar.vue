<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { atlasStore } from '../stores/atlasStore'
import { openExportDialog, openImportAtlasDialog, openReverseDialog } from '../atlasDialogsState'

const { t } = useI18n()
</script>

<template>
  <div class="tool-bar">
    <div class="tb-group" :title="t('toolbar.groupAtlas')">
      <button type="button" class="tb-btn" :title="t('toolbar.importAtlasTitle')" @click="openImportAtlasDialog()">
        <span class="ico">📥</span> {{ t('toolbar.importAtlas') }}
      </button>
      <button type="button" class="tb-btn" :title="t('toolbar.exportAtlasTitle')" @click="openExportDialog()">
        <span class="ico">💾</span> {{ t('toolbar.exportAtlas') }}
      </button>
    </div>
    <span class="sep" />
    <div class="tb-group" :title="t('toolbar.groupLayout')">
      <button type="button" class="tb-btn" :title="t('toolbar.runPackTitle')" @click="atlasStore.runPack()">
        <span class="ico">⚙</span> {{ t('toolbar.runPack') }}
      </button>
    </div>
    <span class="sep" />
    <div class="tb-group" :title="t('toolbar.groupReverse')">
      <button type="button" class="tb-btn" :title="t('toolbar.reverseTitle')" @click="openReverseDialog()">
        <span class="ico">📤</span> {{ t('toolbar.reverse') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.tool-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 2px 6px;
  background: linear-gradient(180deg, var(--win-inset-bg-soft) 0%, var(--win-toolbar) 100%);
  border-bottom: 1px solid var(--win-border);
  color: var(--win-text);
}
.tb-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0 2px;
  border-radius: 2px;
  border: 1px solid transparent;
}
.tb-group:hover {
  border-color: #c8c8c8;
  background: rgba(255, 255, 255, 0.35);
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
.ico {
  font-size: 12px;
  line-height: 1;
}
.sep {
  width: 1px;
  height: 18px;
  background: var(--win-border);
  margin: 0 2px;
  flex-shrink: 0;
}
</style>
