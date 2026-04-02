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
  width: 100%;
  min-width: 0;
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

<style>
  /* 扩展 Webview：.win-app 原有 border + inset box-shadow 会与面板内缘叠成「两条边」 */
  body.ta-vscode-webview .win-app {
    border: none;
    box-shadow: none;
  }
  /* Webview 宿主有时会带默认 padding，或 body 背景与 .win-app 不一致，看起来像 #app 两侧露灰条 */
  body.ta-vscode-webview {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    min-height: 100%;
    background: var(--win-bg);
  }
  body.ta-vscode-webview #app {
    width: 100%;
    min-width: 0;
  }
</style>
