# Texture Atlas 编辑器（Vue 3 + Vite）

浏览器内纹理图集编辑：导入图片、选择打包算法、预览画布、导出 `atlas.json` + `atlas.png`、逆向拆分。

## 依赖

- Node.js LTS、npm

## 命令

- `npm install`：安装依赖
- `npm run dev`：开发服务器
- `npm run build`：先将 `package.json` 的 **patch 版本 +1**，再生产构建 → `dist/`
- `npm run package:vsix`：仅将 `vscode-extension/` 打成 VS Code 扩展包 → **`vsix/<name>-<version>.vsix`**（不放 `dist/`，否则下次 `vite build` 会清空删掉；版本与 `vscode-extension/package.json` 一致）
- `npm run package:electron`：在已有 `dist/` 的前提下用 **electron-builder** 打 Windows 桌面包 → `release/win-unpacked/Texture Atlas Editor.exe`（主程序；整目录可拷贝分发）
- `npm run package:exe`：先 `npm run build` 再 `package:electron`（一键出 exe 目录）
- `npm run preview`：预览构建结果
- `npm run test`：类型检查 + 构建（冒烟）

## Python 封装

同目录下 `build.py`、`test.py`、`run_web.py`、`run.py`、`dev.py`、`publish.py`、`install.py` 封装 npm / 安装逻辑（Windows 下对 npm 使用 `shell=True`）。

| 脚本 | 说明 |
|------|------|
| `build.py` | **无参数**：`npm run build` + **打 `.vsix`** + **`install.py`**；**`--dist-only`** 仅构建 dist + `.vsix`；**`--web`** / **`--electron`** 为构建后只开预览或开发态 Electron；**`--electron-exe`** 为构建 + `.vsix` + **electron-builder**（`release/`，不跑 `install.py`） |
| `run_web.py` | `npm run build` 后 **校验 `dist/` 产物**，再 `vite preview`（默认 **`127.0.0.1:4174`**，`--strictPort`；与扩展 `textureAtlas.previewPort` 一致） |
| `run.py` | `npm run build` 后 **校验 `dist/`**，再 **Electron** 打开桌面窗口（加载 `dist/index.html`） |
| `install.py` | 默认先 **`npm run test`**（`vue-tsc` + `vite build`，不 bump 版本）并 **校验 `dist/`**，再装扩展 / `mcp-server` / VSIX / `.cursor/mcp.json`；可用 **`--skip-frontend-build`** 跳过仅当你已构建过 |

### MCP 与编辑器扩展

- MCP 实现：`mcp-server/server.mjs`（依赖见 `mcp-server/package.json`）。
- 扩展：`vscode-extension/`（命令：打开预览、查看 MCP 路径）。安装后需重启编辑器。

## 文档

四阶段说明见仓库根目录 `ai-software-engineering/`。
