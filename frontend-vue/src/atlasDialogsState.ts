import { ref } from 'vue'
import type { AtlasExportMode } from './stores/atlasStore'
import type { AtlasIoFormatId } from './lib/formatTargets'

export const exportDialogOpen = ref(false)
export const exportModeChoice = ref<AtlasExportMode>('png+json')
/** 导出含 JSON 时的目标清单格式（与业界工具对齐） */
export const exportJsonFormatChoice = ref<AtlasIoFormatId>('app-v1')

export const importAtlasDialogOpen = ref(false)
/** 导入图集：来源格式 */
export const importAtlasFormatChoice = ref<AtlasIoFormatId>('app-v1')

export const reverseDialogOpen = ref(false)
/** 逆向拆分：清单来源格式 */
export const reverseFormatChoice = ref<AtlasIoFormatId>('app-v1')

/** 文件选择完成后：导入到列表 或 逆向下载 */
export const pendingFileFlow = ref<'import-atlas' | 'reverse' | null>(null)

/** 与 pendingFileFlow 配套的清单格式（选完描述文件后读此值） */
export const pendingIoFormat = ref<AtlasIoFormatId | null>(null)

export function openExportDialog() {
  exportModeChoice.value = 'png+json'
  exportJsonFormatChoice.value = 'app-v1'
  exportDialogOpen.value = true
}

export function openImportAtlasDialog() {
  importAtlasFormatChoice.value = 'app-v1'
  importAtlasDialogOpen.value = true
}

export function openReverseDialog() {
  reverseFormatChoice.value = 'app-v1'
  reverseDialogOpen.value = true
}
