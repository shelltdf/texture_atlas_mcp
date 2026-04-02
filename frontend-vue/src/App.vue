<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import LeftDock from './components/LeftDock.vue'
import MenuBar from './components/MenuBar.vue'
import StatusBar from './components/StatusBar.vue'
import ToolBar from './components/ToolBar.vue'
import CanvasArea from './components/CanvasArea.vue'
import AtlasDialogsHost from './components/AtlasDialogsHost.vue'
import { APP_ICON_URL } from './appIconUrl'
import { APP_VERSION } from './version'

const { t, locale } = useI18n()

function syncDocumentTitle() {
  document.title = `${t('app.title')} ${APP_VERSION}`
}

onMounted(syncDocumentTitle)
watch(locale, syncDocumentTitle)
</script>

<template>
  <div class="win-app">
    <AtlasDialogsHost />
    <header class="title-strip">
      <img class="title-icon" :src="APP_ICON_URL" width="18" height="18" alt="" />
      <span class="title-text"
        >{{ t('app.title') }} <span class="title-ver">{{ APP_VERSION }}</span></span
      >
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
  display: block;
  flex-shrink: 0;
  object-fit: contain;
  border-radius: 3px;
}
.title-ver {
  font-weight: 500;
  color: var(--win-text-muted, #555);
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
