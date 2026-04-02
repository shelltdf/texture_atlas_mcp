# 物理规格：texture-atlas-editor-spa

## VS Code / Cursor 扩展（宿主行为，实现见 `frontend-vue/vscode-extension/`）

- **入口**：`extension.cjs`（`package.json` 的 `main`）；侧栏 Webview id `textureAtlas.webview`，命令 **`textureAtlas.openBuiltIn`** 打开编辑器内嵌面板。
- **内置 UI**：打 VSIX / `install.py` 前将 `frontend-vue/dist/` 同步至 **`vscode-extension/dist/`**（`scripts/sync-dist-to-extension.mjs`）；Webview 通过 **`asWebviewUri`** 加载静态资源，**不依赖**本机 `http` 预览。
- **HTML 注入**：去掉 Vite 的 **`crossorigin`**；写入 **CSP**（含 **`script-src … 'unsafe-eval'`**、**`img-src … blob:`** 等）与 **`<base href>`**；为 `<body>` 追加 **`ta-vscode-webview`**，供前端收紧边距/去边框（与浏览器独立页区分）。
- **状态栏**：**右侧**对齐，**`priority: 0`**（尽量处于状态栏**最右**）；图标 **`$(layout)`**，文字 **TextureAtlas**，前景色 **`#FFCC00`**。

## 清单 JSON（version 1）

**权威结构（导出始终使用）**：单个 `atlas.json`，根对象含 `version: 1` 与 **`sheets` 数组**；每一页一项：

| 字段 | 类型 | 说明 |
|------|------|------|
| sheets | array | 多页图集的全部页面 |
| sheets[].index | number | 页码，从 `0` 起，与 `atlas-00.png` 等文件名序号一致 |
| sheets[].width / height | number | 该页图集像素尺寸 |
| sheets[].sprites | array | 该页内精灵矩形列表 |
| sprites[].id | string | 唯一 id |
| sprites[].name | string | 显示名/文件名 |
| sprites[].x, y, w, h | number | 左上角与宽高（像素） |

**兼容导入（旧版单页）**：若无 `sheets`，但存在顶层 `width`、`height`、`sprites`，则视为仅一页（`index === 0`）。解析实现见 `frontend-vue/src/lib/manifest.ts` 中 `parseManifestJson`。

## 打包算法 ID

| id | 说明 |
|----|------|
| `grid` | 网格：列数 `ceil(sqrt(n))`，按顺序填充，单元尺寸为该行/列最大边 |
| `rows` | 按行贪心：从左到右，超出最大宽度则换行 |
| `skyline` | 天际线简化：从左到右找最低可用 y 放置 |

## 单张图集尺寸上限（用户可配）

- **单张最大宽**、**单张最大高**（像素）：分别约束单张图集的宽与高；合法范围各 `64`～`16384`，默认均为 `4096`；在 UI 中于「打包算法」**上方**分两栏输入。
- 若当前算法在**单张**内无法排下全部图片，则自动拆成**多张图集**（多页）；**画布标题栏**显示页码与当前页输出边界尺寸，并提供翻页与**全部总览**。
- 任一张素材自身宽或高大于对应上限时，打包报错，需提高上限或缩小素材。
- **画布预览**：在每张图集左上角对齐绘制 **maxW×maxH** 的紫色示意外框（与设置一致）；橙色为当前页实际输出边界。**预览用画布尺寸**在逻辑内容 `max(当前页输出, maxW)×max(当前页输出, maxH)`（+1px）之外再留 **bleed 边距**（随线宽/选中框外扩计算），使描边一半线宽与金色选中框不被 canvas 位图边缘裁切；导出 PNG 仍以实际输出为准。
- **辅助线（分项开关，默认全开）**：`canvasHelperShowGrid`（灰网格）、`canvasHelperShowMaxBounds`（紫单张上限）、`canvasHelperShowOutputBounds`（橙当前页输出）、`canvasHelperShowSpriteBounds`（青/黑图块描边）。另可调 `canvasHelperStrokePx`（纹理像素，**1～128**）、`canvasHelperGridStep`（**8～512**，步进 8）。
- **线宽默认值同步**：`canvasHelperStrokePx` 初始为 `max(1, round(DEFAULT_MAX_ATLAS_EDGE/256))`。用户修改「单张最大宽/高」并写入 store 时，若数值相对原值有变化，则按 `max(1, round(max(maxW,maxH)/256))` 重算线宽。执行「运行打包」时，仅当 `clampBounds` 修正后的宽/高与打包前不一致时再次同步；**上限未变则保留用户手调线宽**。
- **选中对象金框**（`selectedId`）：不计入上述辅助线开关，有选中即绘制。**双击列表项**在 `ImageThumbnails.vue` 中打开**原图全尺寸预览**（`objectUrl`），不再驱动画布平移。

## 打包图集面板（侧栏 `AtlasPanel.vue`）

- 标题为「打包图集」；包含单张最大宽/高、打包算法与 **运行打包**。
- **不包含**「导入图集」「导出图集」「逆向拆分」按钮；上述命令由**菜单「文件」**与**工具栏**提供（均先经格式选择再选文件）。

## 导出

- UI **导出图集**须先选择产物类型：`png+json`（默认）、`png-only`、`json-only`；避免与「仅 JSON」类混淆。
- **含 JSON 时**（`png+json` / `json-only`）须再选**清单目标格式**（与业界工具对齐的选项列表，见前端 `formatTargets.ts`）：当前仅 **本应用 v1 JSON** 已实现；其余为占位，选中后导出应提示未实现或禁用选择。
- PNG：每页与对应 `sheets[i].width`×`sheets[i].height` 一致，**RGBA 透明底**（未占用像素 alpha=0），精灵按该页 `sprites` 矩形从源图绘制（保留素材 alpha）。
- **清单文件**：**仅一个** `atlas.json`，包含全部页的 `sheets`（见上表）。
- **单页**（`png+json`）：`atlas.json` + `atlas.png`。
- **多页**（`png+json`）：`atlas.json` + `atlas-00.png`、`atlas-01.png`…（两位序号从 0 起，与 `sheets[].index` 一致）。
- **保存对话框**：每个文件依次触发浏览器下载/「另存为」，文件之间插入约 **650ms** 间隔（`atlasIo.SAVE_DIALOG_STAGGER_MS`），避免同时弹出多个对话框。

## 导入图集到列表

- **导入图集**（与「逆向拆分」区分）：在对话框中选择**清单来源格式**，再在系统文件框中 **一次多选** `atlas.json` 与全部页面对应的 PNG（张数须等于 `sheets.length`；按扩展名识别，且仅允许 1 个 `.json`）。当前仅 **本应用 v1** 已实现；其余格式占位。
- 按清单逐页裁切子图并 **加入左侧图片列表**（`importAtlasIntoList` / `importAtlasFromBundle`），不触发浏览器批量下载子图；成功后 **自动执行「运行打包」**（`runPack`），使图集画布显示预览。

## 逆向

- 输入：与所选格式一致的清单与 PNG（本应用 v1：**一次多选** 与导入相同：1×`.json` + N×`.png`）。
- 校验：每一页 `image.naturalWidth === sheets[i].width` 且 `image.naturalHeight === sheets[i].height`，否则报错。
- 输出：每张精灵依次触发下载（文件名 `name` 净化后 + `.png`），文件之间同上间隔，避免同时弹出多个保存对话框。

## 退出码（CLI 脚本）

- Python 包装脚本：`build.py`/`test.py` 以进程退出码 0 表示成功，非 0 表示失败（见 `03-ops`）。
