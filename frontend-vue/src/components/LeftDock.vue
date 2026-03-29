<script setup lang="ts">
import AtlasPanel from './AtlasPanel.vue'
import ImagePropertyPanel from './ImagePropertyPanel.vue'
import ImageThumbnails from './ImageThumbnails.vue'
</script>

<template>
  <aside class="dock">
    <ImagePropertyPanel class="props-block" />
    <ImageThumbnails />
    <AtlasPanel />
  </aside>
</template>

<style scoped>
.dock {
  width: var(--win-dock-width);
  min-width: 220px;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--win-border-dark);
  background: var(--win-panel);
  box-shadow: inset -1px 0 0 var(--win-border-light);
}
.props-block {
  flex-shrink: 0;
}
</style>
