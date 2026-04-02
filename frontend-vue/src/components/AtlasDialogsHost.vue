<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AtlasExportMode } from '../stores/atlasStore'
import { atlasStore } from '../stores/atlasStore'
import {
  exportDialogOpen,
  exportModeChoice,
  importAtlasDialogOpen,
  pendingFileFlow,
  reverseDialogOpen,
} from '../atlasDialogsState'

const { t } = useI18n()

const fileJson = ref<HTMLInputElement | null>(null)
const filePng = ref<HTMLInputElement | null>(null)
const pendingJson = ref<File | null>(null)

const exportModes = computed((): { id: AtlasExportMode; title: string; desc: string }[] => [
  { id: 'png+json', title: t('exportModes.pngJsonTitle'), desc: t('exportModes.pngJsonDesc') },
  { id: 'png-only', title: t('exportModes.pngOnlyTitle'), desc: t('exportModes.pngOnlyDesc') },
  { id: 'json-only', title: t('exportModes.jsonOnlyTitle'), desc: t('exportModes.jsonOnlyDesc') },
])

function confirmExport() {
  exportDialogOpen.value = false
  void atlasStore.exportPublish(exportModeChoice.value)
}

function confirmImportAtlas() {
  importAtlasDialogOpen.value = false
  pendingFileFlow.value = 'import-atlas'
  pendingJson.value = null
  fileJson.value?.click()
}

function confirmReverse() {
  reverseDialogOpen.value = false
  pendingFileFlow.value = 'reverse'
  pendingJson.value = null
  fileJson.value?.click()
}

function onJsonPicked(ev: Event) {
  const input = ev.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) {
    pendingFileFlow.value = null
    return
  }
  pendingJson.value = f
  filePng.value?.click()
}

async function onPngPicked(ev: Event) {
  const input = ev.target as HTMLInputElement
  const png = input.files?.[0]
  input.value = ''
  const json = pendingJson.value
  const flow = pendingFileFlow.value
  pendingJson.value = null
  pendingFileFlow.value = null
  if (!json || !png || !flow) return
  try {
    if (flow === 'import-atlas') {
      await atlasStore.importAtlasIntoList(json, png)
    } else {
      await atlasStore.reverseFromFiles(json, png)
    }
  } catch (e) {
    atlasStore.state.statusMessage = e instanceof Error ? e.message : String(e)
  }
}

</script>

<template>
  <div>
    <input
      ref="fileJson"
      type="file"
      class="hidden"
      accept=".json,application/json"
      @change="onJsonPicked"
    />
    <input ref="filePng" type="file" class="hidden" accept="image/png" @change="onPngPicked" />

    <Teleport to="body">
      <div
        v-if="exportDialogOpen"
        class="dlg-overlay"
        role="dialog"
        aria-modal="true"
        @click.self="exportDialogOpen = false"
      >
        <div class="dlg-box">
          <div class="dlg-title">{{ t('dialogs.exportTitle') }}</div>
          <p class="dlg-hint">{{ t('dialogs.exportHint') }}</p>
          <ul class="fmt-list">
            <li v-for="m in exportModes" :key="m.id">
              <label class="fmt-row">
                <input v-model="exportModeChoice" type="radio" name="exm" :value="m.id" />
                <span>
                  <strong>{{ m.title }}</strong>
                  <span class="fmt-desc">{{ m.desc }}</span>
                </span>
              </label>
            </li>
          </ul>
          <div class="dlg-actions">
            <button type="button" class="win-btn" @click="exportDialogOpen = false">{{ t('dialogs.cancel') }}</button>
            <button type="button" class="win-btn primary" @click="confirmExport">{{ t('dialogs.ok') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="importAtlasDialogOpen"
        class="dlg-overlay"
        role="dialog"
        aria-modal="true"
        @click.self="importAtlasDialogOpen = false"
      >
        <div class="dlg-box">
          <div class="dlg-title">{{ t('dialogs.importTitle') }}</div>
          <p class="dlg-hint">{{ t('dialogs.importHint') }}</p>
          <label class="fmt-row block">
            <input type="radio" name="ima" checked disabled class="radio-ro" />
            <span>
              <strong>{{ t('dialogs.appV1Title') }}</strong>
              <span class="fmt-desc">{{ t('dialogs.importV1Desc') }}</span>
            </span>
          </label>
          <p class="dlg-note">{{ t('dialogs.importNote') }}</p>
          <div class="dlg-actions">
            <button type="button" class="win-btn" @click="importAtlasDialogOpen = false">{{ t('dialogs.cancel') }}</button>
            <button type="button" class="win-btn primary" @click="confirmImportAtlas">{{ t('dialogs.nextFiles') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="reverseDialogOpen"
        class="dlg-overlay"
        role="dialog"
        aria-modal="true"
        @click.self="reverseDialogOpen = false"
      >
        <div class="dlg-box">
          <div class="dlg-title">{{ t('dialogs.reverseTitle') }}</div>
          <p class="dlg-hint">{{ t('dialogs.reverseHint') }}</p>
          <label class="fmt-row block">
            <input type="radio" name="rev" checked disabled class="radio-ro" />
            <span>
              <strong>{{ t('dialogs.appV1Title') }}</strong>
              <span class="fmt-desc">{{ t('dialogs.reverseV1Desc') }}</span>
            </span>
          </label>
          <p class="dlg-note">{{ t('dialogs.reverseNote') }}</p>
          <div class="dlg-actions">
            <button type="button" class="win-btn" @click="reverseDialogOpen = false">{{ t('dialogs.cancel') }}</button>
            <button type="button" class="win-btn primary" @click="confirmReverse">{{ t('dialogs.nextFiles') }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.hidden {
  display: none;
}
.dlg-overlay {
  position: fixed;
  inset: 0;
  z-index: 5000;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.dlg-box {
  width: min(440px, 96vw);
  max-height: 90vh;
  overflow: auto;
  background: var(--win-dialog-bg);
  border: 1px solid var(--win-border-dark);
  box-shadow: 4px 4px 16px rgba(0, 0, 0, 0.3);
  padding: 12px 14px;
  color: var(--win-text);
}
.dlg-title {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--win-border);
}
.dlg-hint {
  margin: 0 0 10px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--win-text);
}
.dlg-hint code {
  font-size: 10px;
  background: var(--win-code-bg);
  padding: 0 3px;
}
.dlg-note {
  margin: 10px 0 0;
  font-size: 10px;
  color: var(--win-text-muted);
}
.fmt-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.fmt-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
  font-size: 11px;
  margin-bottom: 8px;
}
.fmt-row.block {
  cursor: default;
  padding: 6px 8px;
  background: var(--win-inset-bg);
  border: 1px solid var(--win-border);
  border-radius: 2px;
}
.fmt-row strong {
  display: block;
  margin-bottom: 2px;
}
.fmt-desc {
  display: block;
  color: var(--win-text-muted);
  font-weight: 400;
  line-height: 1.35;
}
.radio-ro {
  margin-top: 3px;
}
.dlg-actions {
  margin-top: 14px;
  padding-top: 8px;
  border-top: 1px solid var(--win-border);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
button.win-btn.primary {
  border-color: #005a9e;
  background: linear-gradient(180deg, #42a5f5 0%, #0078d4 100%);
  color: #fff;
  font-weight: 600;
}
button.win-btn.primary:hover {
  background: linear-gradient(180deg, #5cb0f6 0%, #1084e0 100%);
}
</style>
