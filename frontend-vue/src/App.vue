<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import LeftDock from './components/LeftDock.vue'
import MenuBar from './components/MenuBar.vue'
import StatusBar from './components/StatusBar.vue'
import ToolBar from './components/ToolBar.vue'
import CanvasArea from './components/CanvasArea.vue'
import AtlasDialogsHost from './components/AtlasDialogsHost.vue'

const { t } = useI18n()
</script>

<template>
  <div class="win-app">
    <AtlasDialogsHost />
    <header class="title-strip">
      <span class="title-icon" aria-hidden="true">▣</span>
      <span class="title-text">{{ t('app.title') }}</span>
    </header>
    <MenuBar />
    <ToolBar />
    <div class="work">
      <LeftDock />
      <main class="main">
        <CanvasArea />
      </main>
    </div>
    <StatusBar />
  </div>
</template>

<style scoped>
.win-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--win-bg);
  border: 1px solid var(--win-border-dark);
  box-shadow: 0 0 0 1px #fff inset;
}
.title-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 10px;
  background: linear-gradient(180deg, var(--win-inset-bg-soft) 0%, var(--win-panel) 100%);
  border-bottom: 1px solid var(--win-border);
  font-size: 12px;
  font-weight: 600;
  color: var(--win-title);
  user-select: none;
}
.title-icon {
  color: var(--win-accent);
  font-size: 14px;
}
.work {
  flex: 1;
  display: flex;
  min-height: 0;
}
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--win-main-canvas-bg);
  padding: 0;
}
</style>
