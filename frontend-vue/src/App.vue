<script setup lang="ts">
import LeftDock from './components/LeftDock.vue'
import MenuBar from './components/MenuBar.vue'
import StatusBar from './components/StatusBar.vue'
import ToolBar from './components/ToolBar.vue'
import CanvasArea from './components/CanvasArea.vue'
</script>

<template>
  <div class="win-app">
    <header class="title-strip">
      <span class="title-icon" aria-hidden="true">▣</span>
      <span class="title-text">Texture Atlas 编辑器</span>
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
  background: linear-gradient(180deg, #ffffff 0%, #e8e8e8 100%);
  border-bottom: 1px solid var(--win-border);
  font-size: 12px;
  font-weight: 600;
  color: #000;
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
  background: #b8b8b8;
  padding: 0;
}
</style>
