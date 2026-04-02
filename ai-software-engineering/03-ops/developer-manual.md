# 开发维护说明书

## 仓库结构

- `ai-software-engineering/`：四阶段工程文档（AI 维护）。
- `frontend-vue/`：Vue 3 + Vite 实现（**不在**文档目录内）。

## 依赖

- Node.js 与 npm（建议 LTS）。
- **首次或克隆后**在 `frontend-vue` 下执行 `npm install`（生成 `node_modules`，否则 `vue-tsc` / `vite` 不可用）。若未安装，运行 `build.py` / `run.py` 等会先提示执行 `npm install`。
- **MCP**：`frontend-vue/mcp-server/` 需单独 `npm install`（或由 `install.py` 执行）。Cursor 使用仓库根目录 `.cursor/mcp.json` 中的 `texture-atlas` 条目（`install.py` 会合并写入）。

## 脚本（Python 封装，位于 `frontend-vue/`）

| 脚本 | 行为 |
|------|------|
| `build.py` | **无参数**：`npm run build` + **打 VSIX**（`frontend-vue/vsix/<name>-<version>.vsix`，勿放 `dist/`——Vite 会清空）+ `install.py`；**`--dist-only`** 仅构建 + VSIX；**`--web`** / **`--electron`** 为构建后仅预览或开发态 Electron；**`--electron-exe`** 为构建 + VSIX + **electron-builder**（输出 `frontend-vue/release/`，主程序在 `win-unpacked/` 下）。`npm run build` 会先执行 `scripts/bump-patch.mjs`，将 `package.json` 的 **patch 版本号 +1**。扩展：`npm run package:vsix`；桌面 exe：`npm run package:electron` 或 `package:exe` |
| `test.py` | 类型检查 + 构建（冒烟） |
| `run_web.py` | `npm run build` 后 **`deps_check.verify_frontend_dist`**（`dist/index.html`、`dist/assets` 下 `.js`/`.css`），再 `vite preview`（默认 `127.0.0.1:4173`） |
| `run.py` | 同上校验通过后 **`npm run electron`**（加载 `dist/index.html`） |
| `dev.py` | `npm run dev` |
| `publish.py` | 构建并将 `dist` 复制到 `frontend-vue/publish/` |
| `install.py` | 默认 **`npm run test`** + **`verify_frontend_dist`**，再复制扩展、`package-vsix`、`mcp-server`、`mcp.json`。**`--skip-frontend-build`** 跳过前端编译校验；**`--skip-vsix-register`** 跳过 VSIX/CLI。 |

## 发布

- 将 `dist/` 或 `publish/` 内容部署到静态托管即可。

## 与物理规格、映射

- 对外行为与数据字段以 `ai-software-engineering/02-physical/texture-atlas-editor-spa/spec.md` 为准。
- 主要 UI ↔ 源码路径见同目录 `mapping.md`；`atlasStore` 画布相关字段亦列于该文件。
