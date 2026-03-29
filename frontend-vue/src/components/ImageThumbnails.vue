<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { atlasStore } from '../stores/atlasStore'

const ctxMenu = ref<{ x: number; y: number; id: string } | null>(null)

function openCtx(imId: string, e: MouseEvent) {
  e.preventDefault()
  atlasStore.select(imId)
  const pad = 4
  const mw = 160
  const mh = 36
  let x = e.clientX
  let y = e.clientY
  x = Math.max(pad, Math.min(x, window.innerWidth - mw - pad))
  y = Math.max(pad, Math.min(y, window.innerHeight - mh - pad))
  ctxMenu.value = { x, y, id: imId }
}

function closeCtx() {
  ctxMenu.value = null
}

function deleteCtxTarget() {
  const id = ctxMenu.value?.id
  closeCtx()
  if (id) atlasStore.removeImage(id)
}

function onGlobalPointerDown(e: MouseEvent) {
  const t = e.target as Node
  const el = document.querySelector('.ctx-menu-host')
  if (el && el.contains(t)) return
  closeCtx()
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeCtx()
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
    <div class="win-panel-title">图片列表</div>
    <div class="list win-inset">
      <button
        v-for="im in atlasStore.state.images"
        :key="im.id"
        type="button"
        class="item"
        :class="{ on: atlasStore.state.selectedId === im.id }"
        @click="atlasStore.select(im.id)"
        @contextmenu="openCtx(im.id, $event)"
      >
        <img :src="im.thumbDataUrl" class="thumb" alt="" />
        <span class="name">{{ im.name }}</span>
      </button>
      <div v-if="atlasStore.state.images.length === 0" class="hint">拖入或点击工具栏「导入」</div>
    </div>

    <Teleport to="body">
      <div
        v-if="ctxMenu"
        class="ctx-menu-host ctx-menu"
        :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
        @mousedown.stop
        @contextmenu.prevent
      >
        <button type="button" class="ctx-item" @click="deleteCtxTarget">删除</button>
      </div>
    </Teleport>
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

<style>
/* Teleport 到 body，需非 scoped */
.ctx-menu-host.ctx-menu {
  position: fixed;
  z-index: 10000;
  min-width: 140px;
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
  padding: 4px 24px 4px 12px;
  border: none;
  background: transparent;
  font: inherit;
  cursor: pointer;
}
.ctx-menu-host .ctx-item:hover {
  background: #91c9f7;
}
</style>
