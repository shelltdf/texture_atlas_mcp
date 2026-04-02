# TextureAtlas（本地扩展）

在 **VS Code / Cursor 内**用 **Webview 面板**嵌入本地预览（`127.0.0.1:4173`），**不是**打开系统浏览器；侧栏活动区有 **TextureAtlas** 图标，与 **状态栏右侧** `$(grid) TextureAtlas` 均可打开同一内置编辑器。

由 `install.py` 复制到 `extensions` 并尽量打 `frontend-vue/vsix/<name>-<version>.vsix` 后执行 `cursor` / `code --install-extension`（扩展面板才稳定可见）。

**手动安装**：扩展 ⋮ → **Install from VSIX…** → 选 `frontend-vue/vsix/` 下对应 `.vsix`。

**使用前**：在 `frontend-vue` 执行 `python run_web.py`（或 `npm run preview`）。若未启动预览，内置页会提示；可用 **TextureAtlas: Refresh** 或侧栏标题栏刷新按钮重试。

**命令**：`TextureAtlas: Open in Editor`、`TextureAtlas: Refresh`、`TextureAtlas: Show MCP Paths`。

MCP：`.cursor/mcp.json` 中键名为 **TextureAtlas**（`install.py` 会合并并移除旧键 `texture-atlas` / `texture_atlas_mcp`）。服务端为 `frontend-vue/mcp-server/server.mjs`。
