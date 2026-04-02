<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AtlasExportMode } from '../stores/atlasStore'
import { atlasStore } from '../stores/atlasStore'
import {
  exportDialogOpen,
  exportJsonFormatChoice,
  exportModeChoice,
  importAtlasDialogOpen,
  importAtlasFormatChoice,
  pendingFileFlow,
  pendingIoFormat,
  reverseDialogOpen,
  reverseFormatChoice,
} from '../atlasDialogsState'
import { ATLAS_IO_FORMATS, getFormatDef } from '../lib/formatTargets'

const { t } = useI18n()

/** 导入图集 / 逆向：一次多选 .json + .png */
const fileAtlasBundle = ref<HTMLInputElement | null>(null)

const exportModes = computed((): { id: AtlasExportMode; title: string; desc: string }[] => [
  { id: 'png+json', title: t('exportModes.pngJsonTitle'), desc: t('exportModes.pngJsonDesc') },
  { id: 'png-only', title: t('exportModes.pngOnlyTitle'), desc: t('exportModes.pngOnlyDesc') },
  { id: 'json-only', title: t('exportModes.jsonOnlyTitle'), desc: t('exportModes.jsonOnlyDesc') },
])

const showJsonFormatPicker = computed(
  () => exportModeChoice.value === 'png+json' || exportModeChoice.value === 'json-only',
)

function confirmExport() {
  if (showJsonFormatPicker.value) {
    const def = getFormatDef(exportJsonFormatChoice.value)
    if (!def?.implemented) {
      atlasStore.state.statusMessage = t('formatsIo.notImplemented')
      return
    }
  }
  exportDialogOpen.value = false
  void atlasStore.exportPublish(exportModeChoice.value, exportJsonFormatChoice.value)
}

async function confirmImportAtlas() {
  const def = getFormatDef(importAtlasFormatChoice.value)
  if (!def?.implemented) {
    atlasStore.state.statusMessage = t('formatsIo.notImplemented')
    return
  }
  pendingIoFormat.value = importAtlasFormatChoice.value
  importAtlasDialogOpen.value = false
  pendingFileFlow.value = 'import-atlas'
  await nextTick()
  fileAtlasBundle.value?.click()
}

async function confirmReverse() {
  const def = getFormatDef(reverseFormatChoice.value)
  if (!def?.implemented) {
    atlasStore.state.statusMessage = t('formatsIo.notImplemented')
    return
  }
  pendingIoFormat.value = reverseFormatChoice.value
  reverseDialogOpen.value = false
  pendingFileFlow.value = 'reverse'
  await nextTick()
  fileAtlasBundle.value?.click()
}

async function onAtlasBundlePicked(ev: Event) {
  const input = ev.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  const flow = pendingFileFlow.value
  const fmt = pendingIoFormat.value ?? 'app-v1'
  pendingFileFlow.value = null
  pendingIoFormat.value = null
  if (!flow || files.length === 0) return
  try {
    if (flow === 'import-atlas') {
      await atlasStore.importAtlasFromBundle(files, fmt)
    } else {
      await atlasStore.reverseFromBundle(files, fmt)
    }
  } catch (e) {
    atlasStore.state.statusMessage = e instanceof Error ? e.message : String(e)
  }
}

</script>

<template>
  <div>
    <input
      ref="fileAtlasBundle"
      type="file"
      class="hidden"
      multiple
      accept=".json,.png,application/json,image/png"
      @change="onAtlasBundlePicked"
    />

    <Teleport to="body">
      <div
        v-if="exportDialogOpen"
        class="dlg-overlay"
        role="dialog"
        aria-modal="true"
        @click.self="exportDialogOpen = false"
      >
        <div class="dlg-box dlg-box-wide">
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
          <template v-if="showJsonFormatPicker">
            <div class="dlg-subtitle">{{ t('dialogs.formatJsonSection') }}</div>
            <p class="dlg-hint dlg-hint-tight">{{ t('dialogs.formatJsonHint') }}</p>
            <ul class="fmt-list">
              <li v-for="fmt in ATLAS_IO_FORMATS" :key="fmt.id">
                <label class="fmt-row" :class="{ 'fmt-disabled': !fmt.implemented }">
                  <input
                    v-model="exportJsonFormatChoice"
                    type="radio"
                    name="exjf"
                    :value="fmt.id"
                    :disabled="!fmt.implemented"
                  />
                  <span>
                    <strong>{{ t(fmt.i18nTitle) }}</strong>
                    <span class="fmt-desc">{{ t(fmt.i18nDesc) }}</span>
                    <span v-if="!fmt.implemented" class="fmt-badge">{{ t('formatsIo.comingSoon') }}</span>
                  </span>
                </label>
              </li>
            </ul>
          </template>
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
        <div class="dlg-box dlg-box-wide">
          <div class="dlg-title">{{ t('dialogs.importTitle') }}</div>
          <p class="dlg-hint">{{ t('dialogs.importHint') }}</p>
          <ul class="fmt-list">
            <li v-for="fmt in ATLAS_IO_FORMATS" :key="fmt.id">
              <label class="fmt-row" :class="{ 'fmt-disabled': !fmt.implemented }">
                <input
                  v-model="importAtlasFormatChoice"
                  type="radio"
                  name="ima"
                  :value="fmt.id"
                  :disabled="!fmt.implemented"
                />
                <span>
                  <strong>{{ t(fmt.i18nTitle) }}</strong>
                  <span class="fmt-desc">{{ t(fmt.i18nDesc) }}</span>
                  <span v-if="!fmt.implemented" class="fmt-badge">{{ t('formatsIo.comingSoon') }}</span>
                </span>
              </label>
            </li>
          </ul>
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
        <div class="dlg-box dlg-box-wide">
          <div class="dlg-title">{{ t('dialogs.reverseTitle') }}</div>
          <p class="dlg-hint">{{ t('dialogs.reverseHint') }}</p>
          <ul class="fmt-list">
            <li v-for="fmt in ATLAS_IO_FORMATS" :key="fmt.id">
              <label class="fmt-row" :class="{ 'fmt-disabled': !fmt.implemented }">
                <input
                  v-model="reverseFormatChoice"
                  type="radio"
                  name="rev"
                  :value="fmt.id"
                  :disabled="!fmt.implemented"
                />
                <span>
                  <strong>{{ t(fmt.i18nTitle) }}</strong>
                  <span class="fmt-desc">{{ t(fmt.i18nDesc) }}</span>
                  <span v-if="!fmt.implemented" class="fmt-badge">{{ t('formatsIo.comingSoon') }}</span>
                </span>
              </label>
            </li>
          </ul>
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
.dlg-box-wide {
  width: min(520px, 96vw);
}
.dlg-title {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--win-border);
}
.dlg-subtitle {
  font-size: 12px;
  font-weight: 600;
  margin: 12px 0 4px;
  color: var(--win-text);
}
.dlg-hint {
  margin: 0 0 10px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--win-text);
}
.dlg-hint-tight {
  margin-bottom: 6px;
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
  padding: 6px 8px;
  background: var(--win-inset-bg);
  border: 1px solid var(--win-border);
  border-radius: 2px;
}
.fmt-row.fmt-disabled {
  cursor: not-allowed;
  opacity: 0.82;
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
.fmt-badge {
  display: inline-block;
  margin-top: 4px;
  font-size: 10px;
  color: var(--win-text-muted);
  font-style: italic;
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
