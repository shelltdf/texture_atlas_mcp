<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { atlasStore } from '../stores/atlasStore'

const { t } = useI18n()

const selected = computed(() => {
  const id = atlasStore.state.selectedId
  if (!id) return null
  return atlasStore.state.images.find((x) => x.id === id) ?? null
})
</script>

<template>
  <div class="props win-inset">
    <div class="win-panel-title">{{ t('props.title') }}</div>
    <div class="body" v-if="selected">
      <div class="row"><span class="k">{{ t('props.name') }}</span><span class="v">{{ selected.name }}</span></div>
      <div class="row">
        <span class="k">{{ t('props.width') }}</span><span class="v">{{ selected.width }} px</span>
      </div>
      <div class="row">
        <span class="k">{{ t('props.height') }}</span><span class="v">{{ selected.height }} px</span>
      </div>
      <div class="row"><span class="k">ID</span><span class="v mono">{{ selected.id }}</span></div>
    </div>
    <div class="empty" v-else>{{ t('props.empty') }}</div>
  </div>
</template>

<style scoped>
.props {
  display: flex;
  flex-direction: column;
  min-height: 100px;
  background: var(--win-inset-bg-soft);
  color: var(--win-text);
}
.body {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.row {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 6px;
  font-size: 11px;
}
.k {
  color: var(--win-text-muted);
}
.v {
  word-break: break-all;
}
.mono {
  font-family: Consolas, monospace;
  font-size: 10px;
}
.empty {
  padding: 12px;
  color: var(--win-text-dim);
  font-size: 11px;
}
</style>
