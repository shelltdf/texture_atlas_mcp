# 模型元素 → 源码映射

| 元素 | 路径 |
|------|------|
| 应用入口 | `frontend-vue/src/main.ts` |
| 主布局 | `frontend-vue/src/App.vue`（含 `body.ta-vscode-webview` 下 Webview 样式） |
| VS Code / Cursor 扩展宿主 | `frontend-vue/vscode-extension/extension.cjs`、`package.json` |
| 菜单栏（含帮助「支持的格式」对话框） | `frontend-vue/src/components/MenuBar.vue` |
| 工具栏（导入图片 / 导入图集 / 打包 / 导出图集） | `frontend-vue/src/components/ToolBar.vue` |
| 状态栏 | `frontend-vue/src/components/StatusBar.vue` |
| 左侧 Dock | `frontend-vue/src/components/LeftDock.vue` |
| 属性区 | `frontend-vue/src/components/ImagePropertyPanel.vue` |
| 缩略图列表 | `frontend-vue/src/components/ImageThumbnails.vue` |
| 打包图集面板 | `frontend-vue/src/components/AtlasPanel.vue` |
| 图集格式对话框（导入/导出/逆向） | `frontend-vue/src/components/AtlasDialogsHost.vue`、`frontend-vue/src/atlasDialogsState.ts` |
| 图集预览区（CanvasArea） | `frontend-vue/src/components/CanvasArea.vue` |
| 应用状态 | `frontend-vue/src/stores/atlasStore.ts` |
| 打包算法 | `frontend-vue/src/lib/packing.ts` |
| 导出/逆向 | `frontend-vue/src/lib/atlasIo.ts` |
| 清单类型 | `frontend-vue/src/lib/manifest.ts` |

## atlasStore 画布与辅助线（与 `spec.md` 一致）

| 状态字段 | 说明 |
|----------|------|
| `maxAtlasWidth` / `maxAtlasHeight` | 单张上限（各 `clampAtlasDimension`，64～16384，默认 4096） |
| `canvasHelperShowGrid` | 辅助网格 |
| `canvasHelperShowMaxBounds` | 紫色单张上限框 |
| `canvasHelperShowOutputBounds` | 橙色当前页输出框 |
| `canvasHelperShowSpriteBounds` | 图块描边（青/黑） |
| `canvasHelperStrokePx` | 辅助线线宽（纹理 px，1～128），默认随上限同步规则见 `spec.md` |
| `canvasHelperGridStep` | 网格步长（纹理 px，8～512） |
| `selectedId` | 当前选中图块 id；金框独立绘制 |
| 列表双击原图预览 | `ImageThumbnails.vue` 弹窗展示 `objectUrl` |
