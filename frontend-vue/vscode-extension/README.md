# TextureAtlas（VS Code / Cursor 扩展）

在 **VS Code / Cursor** 内通过 **Webview** 运行与浏览器版相同的编辑器 UI。**界面静态资源随扩展安装**（扩展目录内 `dist/`，由构建流程从 `frontend-vue/dist` 同步打入），**安装后无需**在本机运行 `run_web.py`、也**无需**打开 `http://127.0.0.1:…` 预览即可使用侧栏与「在编辑器中打开」。

**可选（仅开发）**：在克隆的仓库里可用 **TextureAtlas: Start Dev Server in Terminal** 启动 `python run_web.py`，便于浏览器或热更新调试；与侧栏内置界面相互独立。

侧栏活动区有 **TextureAtlas** 图标。状态栏**最右侧**为 **`$(layout) TextureAtlas`**（黄色 **`#FFCC00`**），与命令 **TextureAtlas: Open in Editor** 一致。

由 `install.py` 复制到 `extensions` 并尽量打 `frontend-vue/vsix/<name>-<version>.vsix` 后执行 `cursor` / `code --install-extension`（扩展面板才稳定可见）。

**手动安装**：扩展 ⋮ → **Install from VSIX…** → 选 `frontend-vue/vsix/` 下对应 `.vsix`。

**命令**：`TextureAtlas: Open in Editor`、`TextureAtlas: Refresh`、`TextureAtlas: Show MCP Paths`、`TextureAtlas: Start Dev Server in Terminal (optional)`。

设置项 `textureAtlas.previewPort`（默认 **4174**）仅在与 **本地开发预览**（`run_web.py`）对齐时使用；主界面不依赖该端口。

MCP：`.cursor/mcp.json` 中键名为 **TextureAtlas**（`install.py` 会合并并移除旧键 `texture-atlas` / `texture_atlas_mcp`）。服务端为 `frontend-vue/mcp-server/server.mjs`。
