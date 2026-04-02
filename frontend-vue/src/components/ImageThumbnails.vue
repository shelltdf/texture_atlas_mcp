<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { atlasStore } from '../stores/atlasStore'

const { t } = useI18n()

/** 右键：条目上为 item；空白处为 list */
type CtxState = { x: number; y: number; mode: 'item' | 'list'; itemId?: string }

const ctxMenu = ref<CtxState | null>(null)
const fileImport = ref<HTMLInputElement | null>(null)
const preview = ref<{ name: string; url: string } | null>(null)
const listRef = ref<HTMLElement | null>(null)

function scrollSelectedIntoView() {
  const id = atlasStore.state.selectedId
  const root = listRef.value
  if (!id || !root) return
  const el = root.querySelector(`[data-id="${id}"]`)
  if (el instanceof HTMLElement) {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }
}

watch(
  () => atlasStore.state.selectedId,
  () => {
    nextTick(() => scrollSelectedIntoView())
  },
)

function clampMenuPos(x: number, y: number, mw: number, mh: number) {
  const pad = 4
  return {
    x: Math.max(pad, Math.min(x, window.innerWidth - mw - pad)),
    y: Math.max(pad, Math.min(y, window.innerHeight - mh - pad)),
  }
}

function onListContextMenu(e: MouseEvent) {
  const el = (e.target as HTMLElement).closest('.item')
  e.preventDefault()
  const mw = 200
  const mh = ctxMenuHeight(el ? 'item' : 'list')
  const { x, y } = clampMenuPos(e.clientX, e.clientY, mw, mh)
  if (el) {
    const id = el.getAttribute('data-id')
    if (!id) return
    atlasStore.select(id)
    ctxMenu.value = { x, y, mode: 'item', itemId: id }
  } else {
    ctxMenu.value = { x, y, mode: 'list' }
  }
}

function ctxMenuHeight(mode: 'item' | 'list'): number {
  return mode === 'item' ? 92 : 64
}

function closeCtx() {
  ctxMenu.value = null
}

function pickImportImages() {
  closeCtx()
  fileImport.value?.click()
}

function onImportFiles(ev: Event) {
  const input = ev.target as HTMLInputElement
  if (input.files?.length) atlasStore.addFiles(input.files)
  input.value = ''
}

function deleteCtxTarget() {
  const id = ctxMenu.value?.itemId
  closeCtx()
  if (id) atlasStore.removeImage(id)
}

function clearAllFromMenu() {
  closeCtx()
  if (atlasStore.state.images.length === 0) return
  if (!confirm(t('thumbnails.confirmClearAll'))) return
  atlasStore.clearAll()
}

function onDblClick(id: string) {
  const e = atlasStore.state.images.find((x) => x.id === id)
  if (!e) return
  preview.value = { name: e.name, url: e.objectUrl }
}

function closePreview() {
  preview.value = null
}

function onGlobalPointerDown(e: MouseEvent) {
  const t = e.target as Node
  const el = document.querySelector('.ctx-menu-host')
  if (el && el.contains(t)) return
  closeCtx()
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    closeCtx()
    closePreview()
  }
}

onMounted(() => {
  window.addEventListener('mousedown', onGlobalPointerDown)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('scroll', closeCtx, true)
})
onUnmounted(() => {
  window.removeEventListener('mousedown', onGlobalPointerDown)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('scroll', closeCtx, true)
})
</script>

<template>
  <div class="list-wrap">
    <input ref="fileImport" type="file" class="hidden" accept="image/*" multiple @change="onImportFiles" />
    <div class="win-panel-title">{{ t('thumbnails.title') }}</div>
    <div ref="listRef" class="list win-inset" @contextmenu="onListContextMenu">
      <button
        v-for="im in atlasStore.state.images"
        :key="im.id"
        type="button"
        class="item"
        :data-id="im.id"
        :class="{ on: atlasStore.state.selectedId === im.id }"
        @click="atlasStore.select(im.id)"
        @dblclick.prevent="onDblClick(im.id)"
      >
        <img :src="im.thumbDataUrl" class="thumb" alt="" />
        <span class="name">{{ im.name }}</span>
      </button>
      <div v-if="atlasStore.state.images.length === 0" class="hint">{{ t('thumbnails.hint') }}</div>
    </div>

    <Teleport to="body">
      <div
        v-if="ctxMenu"
        class="ctx-menu-host ctx-menu"
        :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
        @mousedown.stop
        @contextmenu.prevent
      >
        <template v-if="ctxMenu.mode === 'item'">
          <button type="button" class="ctx-item" @click="pickImportImages">{{ t('thumbnails.import') }}</button>
          <button type="button" class="ctx-item" @click="deleteCtxTarget">{{ t('thumbnails.delete') }}</button>
          <button
            type="button"
            class="ctx-item"
            :disabled="atlasStore.state.images.length === 0"
            @click="clearAllFromMenu"
          >
            {{ t('thumbnails.clearAll') }}
          </button>
        </template>
        <template v-else>
          <button type="button" class="ctx-item" @click="pickImportImages">{{ t('thumbnails.import') }}</button>
          <button
            type="button"
            class="ctx-item"
            :disabled="atlasStore.state.images.length === 0"
            @click="clearAllFromMenu"
          >
            {{ t('thumbnails.clearAll') }}
          </button>
        </template>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="preview"
        class="preview-overlay"
        role="dialog"
        aria-modal="true"
        @click.self="closePreview"
      >
        <div class="preview-dialog">
          <div class="preview-title">{{ preview.name }}</div>
          <div class="preview-img-wrap">
            <img :src="preview.url" class="preview-img" alt="" />
          </div>
          <div class="preview-actions">
            <button type="button" class="win-btn primary" @click="closePreview">{{ t('thumbnails.close') }}</button>
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
.list-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 120px;
}
.list {
  flex: 1;
  overflow: auto;
  background: var(--win-inset-bg);
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
  background: var(--win-inset-bg);
  color: var(--win-text);
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

.preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 12000;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.preview-dialog {
  max-width: min(96vw, 1200px);
  max-height: 92vh;
  background: #f0f0f0;
  border: 1px solid var(--win-border-dark);
  box-shadow: 4px 4px 20px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  min-width: 200px;
}
.preview-title {
  flex-shrink: 0;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  border-bottom: 1px solid var(--win-border);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preview-img-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px;
  text-align: center;
  background: repeating-conic-gradient(#c8c8c8 0% 25%, #dcdcdc 0% 50%) 0 0 / 16px 16px;
}
.preview-img {
  max-width: 100%;
  height: auto;
  vertical-align: middle;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15);
}
.preview-actions {
  flex-shrink: 0;
  padding: 8px 12px;
  border-top: 1px solid var(--win-border);
  text-align: right;
}
button.win-btn.primary {
  border-color: #005a9e;
  background: linear-gradient(180deg, #42a5f5 0%, #0078d4 100%);
  color: #fff;
  font-weight: 600;
  font-size: 12px;
  padding: 4px 16px;
  min-height: 24px;
  cursor: pointer;
  border-radius: 2px;
}
button.win-btn.primary:hover {
  background: linear-gradient(180deg, #5cb0f6 0%, #1084e0 100%);
}
</style>

<style>
.ctx-menu-host.ctx-menu {
  position: fixed;
  z-index: 10000;
  min-width: 160px;
  padding: 2px 0;
  background: #f0f0f0;
  border: 1px solid #707070;
  box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.25);
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 12px;
}
.ctx-menu-host .ctx-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 5px 24px 5px 12px;
  border: none;
  background: transparent;
  font: inherit;
  cursor: pointer;
}
.ctx-menu-host .ctx-item:hover:not(:disabled) {
  background: #91c9f7;
}
.ctx-menu-host .ctx-item:disabled {
  opacity: 0.45;
  cursor: default;
}
</style>
