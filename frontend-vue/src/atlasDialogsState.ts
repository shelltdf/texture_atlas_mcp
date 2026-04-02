import { ref } from 'vue'
import type { AtlasExportMode } from './stores/atlasStore'

export const exportDialogOpen = ref(false)
export const exportModeChoice = ref<AtlasExportMode>('png+json')

export const importAtlasDialogOpen = ref(false)
export const reverseDialogOpen = ref(false)

/** 文件选择完成后：导入到列表 或 逆向下载 */
export const pendingFileFlow = ref<'import-atlas' | 'reverse' | null>(null)

export function openExportDialog() {
  exportModeChoice.value = 'png+json'
  exportDialogOpen.value = true
}

export function openImportAtlasDialog() {
  importAtlasDialogOpen.value = true
}

export function openReverseDialog() {
  reverseDialogOpen.value = true
}
