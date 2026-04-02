# 开发维护说明书

## 仓库结构

- `ai-software-engineering/`：四阶段工程文档（AI 维护）。
- `frontend-vue/`：Vue 3 + Vite 实现（**不在**文档目录内）。

## 依赖

- Node.js 与 npm（建议 LTS）。
- **首次或克隆后**在 `frontend-vue` 下执行 `npm install`（生成 `node_modules`，否则 `vue-tsc` / `vite` 不可用）。若未安装，运行 `build.py` / `run.py` 等会先提示执行 `npm install`。
- **MCP**：`frontend-vue/mcp-server/` 需单独 `npm install`（或由 `install.py` 执行）。Cursor 使用仓库根目录 `.cursor/mcp.json` 中的 **`TextureAtlas`** 键（`install.py` 会合并写入并移除旧键名）。

## VS Code / Cursor 扩展（内置 UI）

- **`npm run package:vsix`** / **`build.py`（默认流程）** / **`install.py`** 在打包或复制扩展前会执行 **`scripts/sync-dist-to-extension.mjs`**：将 `frontend-vue/dist/` 复制到 **`vscode-extension/dist/`**，再随 VSIX 或扩展目录分发。
- 扩展运行时通过 Webview **`asWebviewUri`** 加载上述静态资源；**用户无需**依赖本机 `run_web.py` 或 localhost 预览即可使用侧栏/编辑器 UI。
- 注入 HTML 时会去掉 Vite 生成的 **`crossorigin`**（否则样式/模块脚本按 CORS 加载，Webview 本地资源常无 ACAO，会导致**样式表不生效、整页白屏**），并写入 **`<base href>`** 指向 `dist/`，以便运行时 `./icon.png` 等与文档基准一致。
- Webview 的 CSP 在 **`script-src`** 中含 **`'unsafe-eval'`**：Vue 3 运行时部分路径会使用 `new Function()`，在仅允许 `vscode-cdn` 脚本时会在控制台出现 **EvalError**，应用无法挂载；此为扩展内嵌前端常见取舍。
- **`img-src`** 中含 **`blob:`**：本地导入图片常用 **`URL.createObjectURL()`**，对应 `blob:` 源，否则控制台会报 “Loading the image 'blob:…' violates … img-src” 且缩略图/预览不显示。
- `run_web.py`（`vite preview`，默认 `127.0.0.1:4174`）仍用于**本地开发热更新**，与扩展设置项 `textureAtlas.previewPort` 对齐（可选）。
- **状态栏**：`extension.cjs` 中 **`StatusBarAlignment.Right`**、**`priority: 0`**（尽量靠**屏幕最右**）；**`status.color = '#FFCC00'`**；文案 **`$(layout) TextureAtlas`**。
- **Webview 内布局**：注入 **`body.ta-vscode-webview`**；`App.vue` 与 `style.css` 中对 Webview 去掉 `.win-app` 双边框感、铺满 **`html/body/#app`**（避免侧向露底）。详见 `02-physical/texture-atlas-editor-spa/spec.md` 扩展小节。
- **工作区**：仓库根 `.vscode/settings.json` 中 **`npm.exclude`** 排除 `vscode-extension`，避免内置 NPM 扩展误解析扩展目录下的 `package.json`。

## 脚本（Python 封装，位于 `frontend-vue/`）

| 脚本 | 行为 |
|------|------|
| `build.py` | **无参数**：`npm run build` + **打 VSIX**（`frontend-vue/vsix/<name>-<version>.vsix`，勿放 `dist/`——Vite 会清空）+ `install.py`；**`--dist-only`**：`npm run build` + 打 VSIX，**不**跑 `install.py`；**`--web`** / **`--electron`** 为构建后仅预览或开发态 Electron；**`--electron-exe`** 为构建 + VSIX + **electron-builder**（输出 `frontend-vue/release/`，主程序在 `win-unpacked/` 下）。`npm run build` 会先执行 `scripts/bump-patch.mjs`，将 `package.json` 的 **patch 版本号 +1**。扩展：`npm run package:vsix`；桌面 exe：`npm run package:electron` 或 `package:exe` |
| `test.py` | 类型检查 + 构建（冒烟） |
| `run_web.py` | `npm run build` 后 **`deps_check.verify_frontend_dist`**，再 `vite preview`（默认 **`127.0.0.1:4174`**，`--strictPort`；与扩展 `textureAtlas.previewPort` 一致，避免与 4173 上其他项目混淆） |
| `run.py` | 同上校验通过后 **`npm run electron`**（加载 `dist/index.html`） |
| `dev.py` | `npm run dev` |
| `publish.py` | 构建并将 `dist` 复制到 `frontend-vue/publish/` |
| `install.py` | 默认 **`npm run test`** + **`verify_frontend_dist`** + **`sync-dist-to-extension`**（写入 `vscode-extension/dist/`），再复制扩展、`package-vsix`、`mcp-server`、`mcp.json`。**`--skip-frontend-build`** 跳过前端编译校验；**`--skip-vsix-register`** 跳过 VSIX/CLI。 |

## 发布

- 将 `dist/` 或 `publish/` 内容部署到静态托管即可。

## 与物理规格、映射

- 对外行为与数据字段以 `ai-software-engineering/02-physical/texture-atlas-editor-spa/spec.md` 为准。
- 导入/导出/逆向对话框中的「清单格式」选项与 `frontend-vue/src/lib/formatTargets.ts` 中 `ATLAS_IO_FORMATS` 一致；当前仅 **本应用 v1 JSON** 完整实现，其余为 UI 占位（待适配器）。
- 主要 UI ↔ 源码路径见同目录 `mapping.md`；`atlasStore` 画布相关字段亦列于该文件。
